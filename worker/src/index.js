/**
 * worker/src/index.js —— Cloudflare Worker 同源后台骨架（M0）
 *
 * 目标形态（全案 §2/§4）：站点与后台同源（/admin + /api/v1/*），无 CORS 面；
 * GitHub OAuth 登录 → PAT 写仓库 → commit 前缀 content(backend): 反推北极星。
 * M0 只交付空壳：存活探针 + 占位路由，验证部署链路、拿到 workers.dev 域名。
 *
 * 路由：
 *   GET  /                     → 存活探针（JSON）
 *   GET  /admin                → 后台占位页（M3.5 实现）
 *   GET  /api/v1/me            → 401（会话未实现）
 *   *    /api/v1/auth/callback → 501（OAuth 回调未实现）
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/') {
      return json(
        {
          ok: true,
          service: 'portfolio-backend',
          stage: 'M0-skeleton',
          time: new Date().toISOString(),
        },
        200,
      );
    }

    if (pathname === '/admin') {
      return new Response(ADMIN_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    if (pathname === '/api/v1/me') {
      return json({ error: 'unauthorized', message: '会话尚未实现（M3.5）' }, 401);
    }

    if (pathname === '/api/v1/auth/callback') {
      return json({ error: 'not_implemented', message: 'OAuth 回调尚未实现（M3.5）' }, 501);
    }

    return json({ error: 'not_found', path: pathname }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>后台 · 施工中</title>
<style>
  body { font-family: system-ui, sans-serif; background:#2D3E52; color:#F0EAE3;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#354961; border-radius:16px; padding:40px 48px; text-align:center; }
  h1 { margin:0 0 12px; font-size:1.4rem; }
  p { margin:0; color:#A9B5CA; }
  code { font-size:.85em; background:#26313D; border-radius:4px; padding:0 6px; }
</style>
</head>
<body>
  <div class="card">
    <h1>作品集后台</h1>
    <p>M0 骨架运行正常。上传通道将在 <code>M3.5</code> 上线。</p>
  </div>
</body>
</html>`;
