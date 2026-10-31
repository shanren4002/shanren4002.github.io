/**
 * worker/test/e2e.test.mjs —— 后台发布链路 E2E（wrangler dev + mock GitHub）
 *
 * 前置：wrangler dev 已在 8787 运行（读取 worker/.dev.vars：JWT_SECRET 本地值 +
 *       GITHUB_API_BASE 指向本 mock 8788）。
 * 运行：node worker/test/e2e.test.mjs
 */
import { startMockGithub } from './e2e-mock-github.mjs';
import { signJwt } from '../src/auth.js';

const WORKER = 'http://127.0.0.1:8787';
const JWT_SECRET = 'local-dev-test-secret-do-not-use-in-prod';

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  ✓', label); }
  else { fail++; console.log('  ✗', label, extra === undefined ? '' : '\n    ', JSON.stringify(extra)); }
}

const { server, calls } = await startMockGithub();
console.log('mock GitHub API 已启动 :8788');

async function api(path, options = {}) {
  const res = await fetch(WORKER + path, { ...options });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* HTML */ }
  return { status: res.status, data, headers: res.headers };
}

// 1. 未登录门禁
{
  const r = await api('/api/v1/me');
  ok(r.status === 401, '未登录 GET /me → 401', r.data);
  const p = await api('/api/v1/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  ok(p.status === 401, '未登录 POST /publish → 401', p.data);
  const c = await api('/api/v1/contents/src/content/gallery.json');
  ok(c.status === 401, '未登录 GET /contents → 401', c.data);
}

// 2. 登录态（本地同密钥签 JWT，等价白名单账号会话）
const jwt = await signJwt({ sub: '213465035', login: 'shanren4002' }, JWT_SECRET);
const cookie = `admin_session=${jwt}`;
{
  const r = await api('/api/v1/me', { headers: { cookie } });
  ok(r.status === 200 && r.data.login === 'shanren4002', '已登录 GET /me → 200 + login', r.data);
}

// 3. GET /contents（读仓库文件）
{
  const r = await api('/api/v1/contents/src/content/gallery.json', { headers: { cookie } });
  ok(r.status === 200 && r.data.sha === 'gallery-json-sha', 'GET /contents 返回 sha 与 base64 内容', { status: r.status });
  const decoded = JSON.parse(atob(r.data.content));
  ok(decoded.items.length === 1 && decoded.items[0].slug === '20261031-old-art-01', 'gallery.json 内容解码正确');
}

// 4. PUT /contents —— 路径白名单
{
  const okPath = await api('/api/v1/contents/src/content/notes/test.md', {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'test', content: btoa('# hi') }),
  });
  ok(okPath.status === 200 && okPath.data.ok, 'PUT 允许路径 src/content/** → 200', okPath.data);
  const badPath = await api('/api/v1/contents/README.md', {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'test', content: btoa('x') }),
  });
  ok(badPath.status === 403, 'PUT 非白名单路径 → 403', badPath.data);
}

// 5. POST /publish —— 画廊（主图+thumb+gallery.json 单 commit）
{
  const before = calls.blobs.length;
  const payload = {
    kind: 'gallery',
    meta: {
      title: 'E2E 测试画作', slug: 'e2e-test-art', date: '2026-10-31',
      category: '', tags: [], summary: 'E2E 测试', status: 'published', series: '测试系列', prompt: 'a test prompt',
    },
    markdown: '',
    images: [
      {
        name: 'photo.webp',
        data: Buffer.from('MAIN-IMAGE-BYTES').toString('base64'),
        thumb: { name: 'photo-thumb.webp', data: Buffer.from('THUMB-BYTES').toString('base64') },
      },
    ],
  };
  const r = await api('/api/v1/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  ok(r.status === 200 && r.data.ok, '画廊 publish → 200', r.data);
  ok(r.data.commit === 'new-commit-sha', '返回新 commit sha', r.data);
  ok(r.data.added && r.data.added[0] === '20261031-e2e-test-art-01.webp', '序号递增命名正确（接在 old-art 后取 01）', r.data.added);
  ok(r.data.visit_url === 'https://shanren4002.github.io/gallery/', '返回访问链接', r.data.visit_url);

  const newBlobs = calls.blobs.slice(before);
  ok(newBlobs.length === 3, '单 commit 含 3 个 blob（主图+thumb+gallery.json）', newBlobs.length);
  const tree = calls.trees[calls.trees.length - 1];
  const treePaths = tree.tree.map((t) => t.path).sort();
  ok(JSON.stringify(treePaths) === JSON.stringify([
    'public/images/gallery/20261031-e2e-test-art-01-thumb.webp',
    'public/images/gallery/20261031-e2e-test-art-01.webp',
    'src/content/gallery.json',
  ].sort()), 'tree 含全部文件路径', treePaths);
  ok(tree.base_tree === 'base-tree-sha', 'tree 基于 HEAD（增量不丢历史文件）');
  const commit = calls.commits[calls.commits.length - 1];
  ok(commit.parents[0] === 'base-commit-sha' && commit.message.includes('content(backend):'), 'commit 父节点与消息前缀正确', commit.message);
  const patch = calls.refPatch[calls.refPatch.length - 1];
  ok(patch.sha === 'new-commit-sha', 'main 引用已更新到新 commit');

  // gallery.json 追加内容验证（从最后一个 blob 反推）
  const galleryBlob = newBlobs.find((b) => b.content === Buffer.from(JSON.stringify({ items: [] })).toString('base64')) || newBlobs[newBlobs.length - 1];
  const galleryJson = JSON.parse(Buffer.from(galleryBlob.content, 'base64').toString('utf8'));
  ok(galleryJson.items.length === 2, 'gallery.json 追加后 2 条（旧 1 + 新 1）', galleryJson.items.length);
  const last = galleryJson.items[galleryJson.items.length - 1];
  ok(last.slug === '20261031-e2e-test-art-01' && last.src === '20261031-e2e-test-art-01.webp' && last.series === '测试系列' && last.prompt === 'a test prompt' && last.status === 'published', '新条目字段完整（slug/src/series/prompt/status）', last);
}

// 6. POST /publish —— 笔记（md + 封面图对）
{
  const payload = {
    kind: 'note',
    meta: {
      title: 'E2E 测试笔记', slug: 'e2e-test-note', date: '2026-10-31',
      category: 'Python', tags: ['测试'], summary: 'E2E 笔记摘要', status: 'draft',
    },
    markdown: '## 标题\n\n正文。',
    images: [
      {
        name: 'cover.webp',
        data: Buffer.from('COVER-BYTES').toString('base64'),
        thumb: { name: 'cover-thumb.webp', data: Buffer.from('COVER-THUMB-BYTES').toString('base64') },
      },
    ],
  };
  const r = await api('/api/v1/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  ok(r.status === 200 && r.data.ok, '笔记 publish → 200', r.data);
  ok(r.data.visit_url === 'https://shanren4002.github.io/notes/e2e-test-note/', '笔记访问链接', r.data.visit_url);
  const tree = calls.trees[calls.trees.length - 1];
  const treePaths = tree.tree.map((t) => t.path).sort();
  ok(treePaths.includes('src/content/notes/e2e-test-note.md'), 'md 文件路径正确', treePaths);
  ok(treePaths.some((p) => p.startsWith('public/images/notes/20261031-e2e-test-note-01.')), '封面图路径正确', treePaths);
  ok(treePaths.some((p) => p.includes('-thumb.')), '封面缩略图路径正确', treePaths);
  // md 内容验证
  const mdBlob = calls.blobs[calls.blobs.length - 1];
  const md = Buffer.from(mdBlob.content, 'base64').toString('utf8');
  ok(md.includes('title: "E2E 测试笔记"') && md.includes('slug: "e2e-test-note"') && md.includes('category: "Python"'), 'md front-matter 正确');
  ok(md.includes('cover: "/images/notes/20261031-e2e-test-note-01-thumb.webp"'), 'cover 指向 -thumb.webp', md.split('\n').find((l) => l.startsWith('cover')));
  ok(r.data.overwrote === false, '新文件 overwrote=false', r.data.overwrote);
}

// 7. 非法载荷
{
  const r = await api('/api/v1/publish', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'note', meta: { title: 'x', slug: 'Bad', date: '2026-10-31', category: 'Python' }, markdown: '', images: [] }),
  });
  ok(r.status === 400 && r.data.errors && r.data.errors.length > 0, '非法 slug → 400 + errors', r.data);
}

// 8. redeploy（mock 204）
{
  const r = await api('/api/v1/redeploy', { method: 'POST', headers: { cookie } });
  ok(r.status === 200 && r.data.ok, 'redeploy → 200', r.data);
}

server.close();
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
