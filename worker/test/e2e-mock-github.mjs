/**
 * worker/test/e2e-mock-github.mjs —— mock GitHub API（仅本地 E2E 用，端口 8788）
 * 记录全部请求供断言；行为贴近真实 Git Data API 流程。
 */
import { createServer } from 'node:http';

export function startMockGithub() {
  const calls = { blobs: [], trees: [], commits: [], refGets: [], refPatch: [], contentGets: [], contentPuts: [] };
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
      req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
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
      // Actions
      if (req.method === 'POST' && path.includes('/actions/workflows/')) {
        return send(204, {});
      }
      send(404, { message: `mock: unhandled ${req.method} ${path}` });
    })().catch((e) => send(500, { error: String(e) }));
  });

  return new Promise((resolve) => {
    server.listen(8788, '127.0.0.1', () => resolve({ server, calls }));
  });
}
