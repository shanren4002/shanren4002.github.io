/**
 * worker/test/e2e-mock-github.mjs —— mock GitHub API（仅本地 E2E 用，端口 8788）
 * 记录全部请求供断言；行为贴近真实 Git Data API 流程。
 */
import { createServer } from 'node:http';

export function startMockGithub() {
  const calls = { blobs: [], trees: [], commits: [], refGets: [], refPatch: [], contentGets: [], contentPuts: [], tokenExchanges: [], userFetches: [] };
  let blobN = 0;

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const path = url.pathname;
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    const readBody = () => new Promise((resolve) => {
      let d = '';
      req.on('data', (c) => (d += c));
      req.on('end', () => {
        try {
          if ((req.headers['content-type'] || '').includes('x-www-form-urlencoded')) {
            resolve(Object.fromEntries(new URLSearchParams(d)));
          } else {
            resolve(JSON.parse(d || '{}'));
          }
        } catch { resolve({}); }
      });
    });

    (async () => {
      // Contents API
      if (req.method === 'GET' && path.includes('/contents/public/images/gallery') && !path.includes('/contents/public/images/gallery/')) {
        calls.contentGets.push(path);
        return send(200, [
          { name: '20261031-old-art-01.webp', size: 1000, type: 'file' },
          { name: '20261031-old-art-01-thumb.webp', size: 500, type: 'file' },
        ]);
      }
      if (req.method === 'GET' && path.endsWith('/contents/src/content/gallery.json')) {
        calls.contentGets.push(path);
        const existing = {
          items: [
            { slug: '20261031-old-art-01', src: '20261031-old-art-01.webp', title: '旧作', date: '2026-10-31', status: 'published' },
          ],
        };
        return send(200, { sha: 'gallery-json-sha', size: 100, encoding: 'base64', content: Buffer.from(JSON.stringify(existing)).toString('base64') });
      }
      if (req.method === 'GET' && path.includes('/contents/src/content/notes/')) {
        calls.contentGets.push(path);
        return send(404, { message: 'Not Found' });
      }
      if (req.method === 'PUT' && path.includes('/contents/')) {
        const body = await readBody();
        calls.contentPuts.push({ path, body });
        return send(201, { commit: { sha: 'put-commit-sha' } });
      }
      // Git Data API
      if (req.method === 'GET' && path.endsWith('/git/ref/heads/main')) {
        calls.refGets.push(path);
        return send(200, { object: { sha: 'base-commit-sha' } });
      }
      if (req.method === 'GET' && path.includes('/git/commits/')) {
        return send(200, { sha: 'base-commit-sha', tree: { sha: 'base-tree-sha' } });
      }
      if (req.method === 'POST' && path.endsWith('/git/blobs')) {
        const body = await readBody();
        calls.blobs.push(body);
        return send(201, { sha: `blob-sha-${++blobN}` });
      }
      if (req.method === 'POST' && path.endsWith('/git/trees')) {
        const body = await readBody();
        calls.trees.push(body);
        return send(201, { sha: 'new-tree-sha' });
      }
      if (req.method === 'POST' && path.endsWith('/git/commits')) {
        const body = await readBody();
        calls.commits.push(body);
        return send(201, { sha: 'new-commit-sha' });
      }
      if (req.method === 'PATCH' && path.endsWith('/git/refs/heads/main')) {
        const body = await readBody();
        calls.refPatch.push(body);
        return send(200, { object: { sha: body.sha } });
      }
      // OAuth token 交换 + user（auth.js 经 GITHUB_TOKEN_URL / GITHUB_API_BASE 注入）
      if (req.method === 'POST' && path === '/login/oauth/access_token') {
        const body = await readBody();
        calls.tokenExchanges.push(body);
        if (body.code === 'bad-code') {
          return send(200, { error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' });
        }
        if (body.code === 'stranger-code') return send(200, { access_token: 'gho_mock_stranger' });
        return send(200, { access_token: 'gho_mock_whitelisted' });
      }
      if (req.method === 'GET' && path === '/user') {
        const authz = req.headers.authorization || '';
        calls.userFetches.push(authz);
        if (authz.includes('gho_mock_stranger')) return send(200, { id: 999, login: 'stranger' });
        return send(200, { id: 213465035, login: 'shanren4002' });
      }
      // Actions
      if (req.method === 'POST' && path.includes('/actions/workflows/')) {
        return send(204, {});
      }
      // 智能预填 fixture（fetch-meta / fetch-image；经 .dev.vars FETCH_ALLOW_PRIVATE=1 放开内网）
      if (req.method === 'GET' && path === '/mock-page') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><html><head><title>Mock 页面</title>' +
          '<meta property="og:title" content="Mock OG 标题">' +
          '<meta name="description" content="Mock 描述">' +
          '<meta property="og:image" content="/img/cover.png">' +
          '</head><body></body></html>');
      }
      if (req.method === 'GET' && path === '/img/cover.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
      }
      if (req.method === 'GET' && path === '/mock-not-image') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<html><body>不是图片</body></html>');
      }
      send(404, { message: `mock: unhandled ${req.method} ${path}` });
    })().catch((e) => send(500, { error: String(e) }));
  });

  return new Promise((resolve) => {
    server.listen(8788, '127.0.0.1', () => resolve({ server, calls }));
  });
}
