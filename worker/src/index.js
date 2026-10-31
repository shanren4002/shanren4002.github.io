/**
 * worker/src/index.js —— Cloudflare Worker 同源后台（M3.5 全量）
 *
 * 路由（全案 §6.3，7 API + 1 工作台页）：
 *   GET  /                     → 存活探针
 *   GET  /admin                → 上传工作台（单文件页，内联亮主题 tokens）
 *   GET  /api/v1/auth/login    → 302 GitHub OAuth authorize（state 存 KV，携带回跳目标）
 *   GET  /api/v1/auth/callback → code→token→白名单(user id)→签 24h JWT→302 回跳
 *   GET  /api/v1/auth/logout   → 清除会话 cookie
 *   GET  /api/v1/me            → 登录态 + GitHub login
 *   GET  /api/v1/contents/*    → 读仓库文件（查重/覆盖 sha/预览）
 *   PUT  /api/v1/contents/*    → 单文件写（仅 src/content/**、public/images/**）
 *   POST /api/v1/publish       → 主发布通道：md+N 图片 Git Data API 单 commit 原子入库
 *   POST /api/v1/fetch-meta    → 智能预填：抓取目标页 og/meta，返回标题/摘要/封面图 URL
 *   POST /api/v1/fetch-image   → 智能预填：下载封面图（SSRF 防护 + 魔术字节校验，base64 回传）
 *   POST /api/v1/redeploy      → workflow_dispatch 手动重新部署（作者自救通道）
 */

import {
  json,
  redirect,
  requireAuth,
  isWhitelisted,
  handleLogin,
  handleCallback,
  handleLogout,
} from './auth.js';
import { getFile, putFile, dispatchDeploy } from './github.js';
import { handlePublish } from './publish.js';
import { handleFetchMeta, handleFetchImage } from './fetchmeta.js';
import { ADMIN_HTML } from './admin-html.js';

const ALLOWED_WRITE_PREFIXES = ['src/content/', 'public/images/'];

function isAllowedWritePath(path) {
  return ALLOWED_WRITE_PREFIXES.some((p) => path.startsWith(p));
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      // 错误边界：未捕获异常返回可诊断 JSON（避免裸 1101 页；M4 验收后不再透出堆栈，细节经 wrangler tail 观察）
      return json({
        error: 'internal_error',
        message: String((err && err.message) || err),
      }, 500);
    }
  },
};

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/') {
      return json({
        ok: true,
        service: 'portfolio-backend',
        stage: 'M3.5-backend',
        time: new Date().toISOString(),
      });
    }

    if (pathname === '/admin') {
      return new Response(ADMIN_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (pathname === '/api/v1/auth/login') return handleLogin(request, env);
    if (pathname === '/api/v1/auth/callback') return handleCallback(request, env);
    if (pathname === '/api/v1/auth/logout') return handleLogout(request, env);

    if (pathname === '/api/v1/me') {
      const auth = await requireAuth(request, env);
      if (!auth.ok) return auth.response;
      return json({ login: auth.session.login, id: auth.session.sub, expires_in_hint: '24h' });
    }

    if (pathname.startsWith('/api/v1/contents/')) {
      const auth = await requireAuth(request, env);
      if (!auth.ok) return auth.response;
      const filePath = decodeURIComponent(pathname.slice('/api/v1/contents/'.length));
      if (!filePath || filePath.includes('..')) {
        return json({ error: 'bad_path', message: '非法路径' }, 400);
      }

      if (request.method === 'GET') {
        try {
          const file = await getFile(env, filePath);
          if (!file) return json({ error: 'not_found' }, 404);
          return json({ path: filePath, sha: file.sha, size: file.size, encoding: file.encoding, content: file.content });
        } catch (err) {
          return json({ error: 'github_error', message: String(err.message || err) }, 502);
        }
      }

      if (request.method === 'PUT') {
        if (!isWhitelisted(auth.session.sub, env)) {
          return json({ error: 'forbidden', message: '该账号无写入权限' }, 403);
        }
        if (!isAllowedWritePath(filePath)) {
          return json({ error: 'forbidden_path', message: '仅允许写 src/content/** 与 public/images/**' }, 403);
        }
        try {
          const body = await request.json();
          if (!body || !body.content) return json({ error: 'bad_request', message: '缺少 content（base64）' }, 400);
          const sha = await putFile(env, filePath, body.content, body.message || `content(backend): 更新 ${filePath}`);
          return json({ ok: true, commit: sha });
        } catch (err) {
          return json({ error: 'github_error', message: String(err.message || err) }, 502);
        }
      }

      return json({ error: 'method_not_allowed' }, 405);
    }

    if (pathname === '/api/v1/publish') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      const auth = await requireAuth(request, env);
      if (!auth.ok) return auth.response;
      if (!isWhitelisted(auth.session.sub, env)) {
        return json({ error: 'forbidden', message: '该账号无访问权限' }, 403);
      }
      return handlePublish(request, env, auth.session);
    }

    if (pathname === '/api/v1/redeploy') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      const auth = await requireAuth(request, env);
      if (!auth.ok) return auth.response;
      if (!isWhitelisted(auth.session.sub, env)) {
        return json({ error: 'forbidden', message: '该账号无访问权限' }, 403);
      }
      try {
        await dispatchDeploy(env);
        return json({ ok: true, message: '已触发重新部署，约 1~3 分钟生效' });
      } catch (err) {
        return json({ error: 'redeploy_failed', message: String(err.message || err) }, 502);
      }
    }

    if (pathname === '/api/v1/fetch-meta' || pathname === '/api/v1/fetch-image') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      const auth = await requireAuth(request, env);
      if (!auth.ok) return auth.response;
      if (!isWhitelisted(auth.session.sub, env)) {
        return json({ error: 'forbidden', message: '该账号无访问权限' }, 403);
      }
      return pathname === '/api/v1/fetch-meta'
        ? handleFetchMeta(request, env)
        : handleFetchImage(request, env);
    }

    return json({ error: 'not_found', path: pathname }, 404);
}
