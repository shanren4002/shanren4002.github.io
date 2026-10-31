/**
 * worker/test/fetchmeta.test.mjs —— fetchmeta.js 单测（node 直跑，无依赖）
 * 运行：node worker/test/fetchmeta.test.mjs
 * 覆盖：isSafeUrl 矩阵 / decodeEntities / extractMeta / handleFetchMeta / handleFetchImage
 */
import { createServer } from 'node:http';
import {
  isSafeUrl,
  decodeEntities,
  extractMeta,
  handleFetchMeta,
  handleFetchImage,
} from '../src/fetchmeta.js';

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ✓', label); }
  else { fail++; console.log('  ✗', label, '\n    期望:', e, '\n    实际:', a); }
}
function ok(cond, label) { eq(Boolean(cond), true, label); }

// 1x1 透明 PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const PAGE_FULL = `<!doctype html><html><head>
<title>页面标题 &amp; 兜底</title>
<meta property="og:title" content="OG 标题">
<meta name="description" content="这是描述 &lt;Important&gt;">
<meta property="og:description" content="OG 描述">
<meta property="og:image" content="/img/cover.png">
<meta name="viewport" content="width=device-width">
</head><body><h1>正文</h1></body></html>`;

const PAGE_BARE = `<!doctype html><html><head><title>  只有 <b>标题</b> 标签  </title></head><body></body></html>`;

const PAGE_ENTITIES = `<html><head>
<meta property="og:title" content="&quot;引号&quot; &amp; &#39;单引号&#39; &#x4F60;&#x597D;">
<meta name="description" content="&nbsp;空白实体&nbsp;">
</head></html>`;

// —— 本地 fixture 服务器（E2E 成功路径；守卫经 FETCH_ALLOW_PRIVATE 显式放开）——
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/page') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(PAGE_FULL);
  }
  if (path === '/page-bare') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(PAGE_BARE);
  }
  if (path === '/page-entities') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(PAGE_ENTITIES);
  }
  if (path === '/img/cover.png') {
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(PNG_1PX);
  }
  if (path === '/not-image') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<html><body>不是图片</body></html>');
  }
  if (path === '/big') {
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(Buffer.concat([PNG_1PX, Buffer.alloc(8 * 1024 * 1024 + 16, 0x89)]));
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});
const PORT = 18799;
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;
const envAllow = { FETCH_ALLOW_PRIVATE: '1' };
const envDeny = {};

const post = (url, body) =>
  new Request(`http://worker.local${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

console.log('— isSafeUrl：协议 —');
ok(isSafeUrl('https://example.com/a?b=1').ok, 'https 放行');
ok(isSafeUrl('http://example.com').ok, 'http 放行');
ok(!isSafeUrl('ftp://example.com').ok, 'ftp 拒绝');
ok(!isSafeUrl('javascript:alert(1)').ok, 'javascript: 拒绝');
ok(!isSafeUrl('file:///etc/passwd').ok, 'file: 拒绝');
ok(!isSafeUrl('not a url').ok, '非 URL 拒绝');
ok(!isSafeUrl('').ok, '空串拒绝');

console.log('— isSafeUrl：内网（默认拒绝）—');
ok(!isSafeUrl('http://127.0.0.1:8080/x').ok, '127.0.0.1 拒绝');
ok(!isSafeUrl('http://localhost/x').ok, 'localhost 拒绝');
ok(!isSafeUrl('http://foo.localhost/x').ok, '*.localhost 拒绝');
ok(!isSafeUrl('http://printer.local/x').ok, '*.local 拒绝');
ok(!isSafeUrl('http://svc.internal/x').ok, '*.internal 拒绝');
ok(!isSafeUrl('http://10.1.2.3/x').ok, '10/8 拒绝');
ok(!isSafeUrl('http://192.168.1.1/x').ok, '192.168/16 拒绝');
ok(!isSafeUrl('http://172.16.0.1/x').ok, '172.16/12 起点拒绝');
ok(!isSafeUrl('http://172.31.255.255/x').ok, '172.16/12 终点拒绝');
ok(isSafeUrl('http://172.32.0.1/x').ok, '172.32 放行（段外）');
ok(!isSafeUrl('http://169.254.169.254/latest/meta-data').ok, '云元数据地址拒绝');
ok(!isSafeUrl('http://100.64.0.1/x').ok, 'CGNAT 100.64/10 拒绝');
ok(!isSafeUrl('http://0.0.0.0/x').ok, '0.0.0.0 拒绝');
ok(!isSafeUrl('http://[::1]/x').ok, 'IPv6 环回拒绝');
ok(!isSafeUrl('http://[fe80::1]/x').ok, 'IPv6 链路本地拒绝');
ok(!isSafeUrl('http://[fc00::1]/x').ok, 'IPv6 唯一本地拒绝');
ok(!isSafeUrl('http://[::ffff:127.0.0.1]/x').ok, 'IPv4 映射 IPv6 拒绝');

console.log('— isSafeUrl：测试开关 —');
ok(isSafeUrl('http://127.0.0.1:8788/x', { allowPrivate: '1' }).ok, 'allowPrivate=1 放开内网');
ok(isSafeUrl('http://127.0.0.1:8788/x', { allowPrivate: true }).ok, 'allowPrivate=true 放开内网');
ok(!isSafeUrl('ftp://127.0.0.1/x', { allowPrivate: '1' }).ok, 'allowPrivate 不放开协议');

console.log('— decodeEntities —');
eq(decodeEntities('a &amp; b'), 'a & b', '命名实体');
eq(decodeEntities('&lt;tag&gt;'), '<tag>', '尖角实体');
eq(decodeEntities('&#39;q&#39;'), "'q'", '十进制数字实体');
eq(decodeEntities('&#x4F60;&#x597D;'), '你好', '十六进制数字实体');
eq(decodeEntities('&quot;&apos;&nbsp;'), "\"'\u00a0", '引号/空格实体');
eq(decodeEntities('&#xZZ;坏'), '&#xZZ;坏', '非法实体原样保留');

console.log('— extractMeta —');
const m1 = extractMeta(PAGE_FULL, 'https://example.com/post/1');
eq(m1.title, 'OG 标题', 'og:title 优先于 title 标签');
eq(m1.summary, '这是描述 <Important>', 'description 优先于 og:description 且实体解码');
eq(m1.cover, 'https://example.com/img/cover.png', '相对 og:image 解析为绝对 URL');
eq(m1.site, 'example.com', 'site 取主机名');

const m2 = extractMeta(PAGE_BARE, 'https://example.com/');
eq(m2.title, '只有 标题 标签', '无 og 时回退 title 标签（去标签+折叠空白）');
eq(m2.summary, '', '无描述 → 空');
eq(m2.cover, '', '无封面 → 空');

const m3 = extractMeta(PAGE_ENTITIES, 'https://example.com/');
eq(m3.title, '"引号" & \'单引号\' 你好', '标题实体解码');
eq(m3.summary, '\u00a0空白实体\u00a0', '描述实体解码');

const m4 = extractMeta('<html><head></head></html>', 'https://example.com/');
eq(m4, { title: '', summary: '', cover: '', site: 'example.com' }, '空页面全空');

const m5 = extractMeta('<meta property="og:image" content="https://cdn.example.com/x.jpg"><title>t</title>', 'https://example.com/');
eq(m5.cover, 'https://cdn.example.com/x.jpg', '绝对 og:image 原样');

const m6 = extractMeta('<meta content="属性在前" property="og:title"><title>t</title>', 'https://example.com/');
eq(m6.title, '属性在前', 'content 在 property 之前的属性顺序');

console.log('— handleFetchMeta（本地 fixture）—');
{
  const res = await handleFetchMeta(post('/api/v1/fetch-meta', { url: `${BASE}/page` }), envAllow);
  eq(res.status, 200, '成功 200');
  const d = await res.json();
  eq(d.ok, true, 'ok=true');
  eq(d.title, 'OG 标题', '标题');
  eq(d.summary, '这是描述 <Important>', '摘要');
  eq(d.cover, `${BASE}/img/cover.png`, '封面绝对 URL');
  eq(d.site, '127.0.0.1', 'site');
}
{
  const res = await handleFetchMeta(post('/api/v1/fetch-meta', { url: `${BASE}/page-bare` }), envAllow);
  const d = await res.json();
  eq(d.title, '只有 标题 标签', '兜底标题页');
}
{
  const res = await handleFetchMeta(post('/api/v1/fetch-meta', { url: `${BASE}/missing` }), envAllow);
  eq(res.status, 502, '目标 404 → 502');
  const d = await res.json();
  eq(d.ok, false, 'ok=false');
  ok(/404/.test(d.message), '错误信息带状态码');
}
{
  const res = await handleFetchMeta(post('/api/v1/fetch-meta', { url: 'ftp://x/y' }), envAllow);
  eq(res.status, 400, 'ftp → 400');
}
{
  const res = await handleFetchMeta(post('/api/v1/fetch-meta', {}), envAllow);
  eq(res.status, 400, '缺 url → 400');
}
{
  const bad = new Request('http://worker.local/api/v1/fetch-meta', { method: 'POST', body: 'not-json', headers: { 'content-type': 'application/json' } });
  const res = await handleFetchMeta(bad, envAllow);
  eq(res.status, 400, '非 JSON 体 → 400');
}
{
  // 默认环境（无 allowPrivate）访问本地 → 被 SSRF 护栏拦截
  const res = await handleFetchMeta(post('/api/v1/fetch-meta', { url: `${BASE}/page` }), envDeny);
  eq(res.status, 400, '默认环境拦内网 → 400');
  const d = await res.json();
  ok(/内网/.test(d.message), '拦截原因=内网');
}

console.log('— handleFetchImage（本地 fixture）—');
{
  const res = await handleFetchImage(post('/api/v1/fetch-image', { url: `${BASE}/img/cover.png` }), envAllow);
  eq(res.status, 200, '成功 200');
  const d = await res.json();
  eq(d.ok, true, 'ok=true');
  eq(d.name, 'cover.png', '文件名取自路径');
  eq(d.type, 'image/png', 'type 透传');
  const bytes = Buffer.from(d.content, 'base64');
  ok(bytes.equals(PNG_1PX), 'base64 内容与原图一致');
}
{
  const res = await handleFetchImage(post('/api/v1/fetch-image', { url: `${BASE}/not-image` }), envAllow);
  eq(res.status, 502, '非图片 → 502');
  const d = await res.json();
  eq(d.error, 'not_image', '错误码 not_image');
}
{
  const res = await handleFetchImage(post('/api/v1/fetch-image', { url: `${BASE}/big` }), envAllow);
  eq(res.status, 502, '超限(>8MB) → 502');
}
{
  const res = await handleFetchImage(post('/api/v1/fetch-image', { url: `${BASE}/page` }), envDeny);
  eq(res.status, 400, '默认环境拦内网 → 400');
}
{
  const res = await handleFetchImage(post('/api/v1/fetch-image', {}), envAllow);
  eq(res.status, 400, '缺 url → 400');
}

server.close();
console.log(`\nfetchmeta 单测：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
