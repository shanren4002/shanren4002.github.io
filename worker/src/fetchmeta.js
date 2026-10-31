/**
 * worker/src/fetchmeta.js —— 网页后台「粘贴链接，自动填写」（M4 智能预填）
 *
 * 路由：
 *   POST /api/v1/fetch-meta  { url } → { ok, title, summary, cover, site }
 *   POST /api/v1/fetch-image { url } → { ok, name, type, content(base64) }
 *
 * 安全（单用户后台也按公网服务标准设防）：
 *   - 仅 http/https；拒绝 localhost / .local / .internal / IPv4 内网段 / IPv6 内网
 *   - 10s 超时；响应体限量读取（HTML 512KB / 图片 8MB）；图片按魔术字节嗅探类型
 *   - 两个路由均要求登录态（index.js 层 requireAuth）
 *   - FETCH_ALLOW_PRIVATE=1 仅限本地测试放开内网限制（.dev.vars 测试用，生产禁设）
 * 注：DNS 重绑定（域名解析到内网 IP）不在防护范围——白名单单人使用，风险可接受。
 */

const UA = 'Mozilla/5.0 (compatible; portfolio-prefill/1.0; +https://shanren4002.github.io)';
const HTML_MAX = 512 * 1024;
const IMAGE_MAX = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

/**
 * 校验目标 URL 是否可公网抓取。返回 { ok, url } 或 { ok:false, reason }
 * opts.allowPrivate：仅本地测试用（生产环境禁止设置）——放开内网地址限制，
 * 以便 E2E 对 127.0.0.1 上的 mock 服务器跑通成功路径；协议校验始终生效。
 */
export function isSafeUrl(input, opts = {}) {
  const allowPrivate = opts.allowPrivate === true || opts.allowPrivate === '1';
  let u;
  try {
    u = new URL(String(input));
  } catch {
    return { ok: false, reason: 'URL 格式不正确' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: '仅支持 http/https 链接' };
  }
  if (allowPrivate) return { ok: true, url: u };
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return { ok: false, reason: '缺少主机名' };
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: '不允许访问内网地址' };
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    const isPrivate =
      a === 0 || a === 127 || a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127);
    if (isPrivate) return { ok: false, reason: '不允许访问内网地址' };
  }
  if (host.includes(':')) {
    // IPv6 字面量：环回 / 唯一本地(fc00::/7) / 链路本地(fe80::/10) / IPv4 映射
    if (
      host === '::1' || host === '::' ||
      host.startsWith('fc') || host.startsWith('fd') ||
      host.startsWith('fe80') || host.startsWith('fe9') ||
      host.startsWith('fea') || host.startsWith('feb') ||
      host.startsWith('::ffff:')
    ) {
      return { ok: false, reason: '不允许访问内网地址' };
    }
  }
  return { ok: true, url: u };
}

/** HTML 实体解码（覆盖常见命名实体 + 十进制/十六进制数字实体） */
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'");
}

function safeCodePoint(n) {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return '';
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

/** 解析单个标签的全部属性为小写键 map */
function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/** 收集全部 <meta> 标签属性 */
function allMetas(html) {
  const out = [];
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) out.push(parseAttrs(m[0]));
  return out;
}

/** 去标签 + 折叠空白 + 解码实体（先剥标签再解码：防止实体解码产生的假标签被误剥） */
function cleanText(s) {
  return decodeEntities(
    String(s || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/**
 * 从 HTML 提取 og/meta 信息。返回 { title, summary, cover, site }
 * title/summary 截断；cover 解析为绝对 URL（解析失败留空）。
 */
export function extractMeta(html, baseUrl) {
  const text = String(html || '');
  const metas = allMetas(text);
  const byKey = (key) => metas.filter((a) => (a.name || '').toLowerCase() === key || (a.property || '').toLowerCase() === key);

  const ogTitle = byKey('og:title').map((a) => cleanText(a.content)).find(Boolean) || '';
  const titleTag = (() => {
    const m = text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return m ? cleanText(m[1]) : '';
  })();
  const title = ogTitle || titleTag || '';

  const desc = byKey('description').map((a) => cleanText(a.content)).find(Boolean) || '';
  const ogDesc = byKey('og:description').map((a) => cleanText(a.content)).find(Boolean) || '';
  const summary = desc || ogDesc || '';

  let cover = byKey('og:image').map((a) => decodeEntities(a.content).trim()).find(Boolean) || '';
  if (cover) {
    try {
      cover = new URL(cover, baseUrl).href;
    } catch {
      cover = '';
    }
  }

  let site = '';
  try {
    site = new URL(baseUrl).hostname;
  } catch {
    site = '';
  }

  return {
    title: title.slice(0, 120),
    summary: summary.slice(0, 300),
    cover,
    site,
  };
}

/** 限量读取响应体（超出上限即中止，防止超大响应打满内存） */
async function readCapped(res, maxBytes) {
  if (!res.body) {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      const e = new Error('响应体超过大小上限');
      e.status = 502;
      throw e;
    }
    return new Uint8Array(buf);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      const e = new Error('响应体超过大小上限');
      e.status = 502;
      throw e;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** 带护栏地抓取目标（协议/内网校验 + 超时 + 限量） */
async function guardedFetch(urlStr, env, { maxBytes, accept }) {
  const check = isSafeUrl(urlStr, { allowPrivate: env && env.FETCH_ALLOW_PRIVATE });
  if (!check.ok) {
    const e = new Error(check.reason);
    e.status = 400;
    throw e;
  }
  const res = await fetch(check.url.href, {
    headers: { 'user-agent': UA, accept: accept || '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const e = new Error(`目标站点返回 ${res.status}`);
    e.status = 502;
    throw e;
  }
  const bytes = await readCapped(res, maxBytes);
  return { bytes, contentType: res.headers.get('content-type') || '', finalUrl: res.url || check.url.href };
}

function bytesToBase64(bytes) {
  // 分块 btoa，避免超长字符串参数
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** 魔术字节嗅探图片类型 → 扩展名 */
function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif';
  return '';
}

/** POST /api/v1/fetch-meta */
export async function handleFetchMeta(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonErr(400, 'bad_request', '请求体必须是 JSON');
  }
  const url = body && body.url ? String(body.url).trim() : '';
  if (!url) return jsonErr(400, 'bad_request', '缺少 url');
  try {
    const { bytes, finalUrl } = await guardedFetch(url, env, { maxBytes: HTML_MAX, accept: 'text/html,application/xhtml+xml' });
    const html = new TextDecoder().decode(bytes);
    const meta = extractMeta(html, finalUrl);
    return json({ ok: true, ...meta });
  } catch (err) {
    return jsonErr(err.status || 502, 'fetch_failed', err.message || '抓取失败');
  }
}

/** POST /api/v1/fetch-image（og:image 等封面图下载，走既有压缩管线） */
export async function handleFetchImage(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonErr(400, 'bad_request', '请求体必须是 JSON');
  }
  const url = body && body.url ? String(body.url).trim() : '';
  if (!url) return jsonErr(400, 'bad_request', '缺少 url');
  try {
    const { bytes, contentType } = await guardedFetch(url, env, { maxBytes: IMAGE_MAX, accept: 'image/*' });
    const ext = sniffImage(bytes);
    if (!ext) return jsonErr(502, 'not_image', '目标不是可识别的图片（jpg/png/webp/gif）');
    let name = 'cover';
    try {
      const path = new URL(url).pathname;
      const stem = path.split('/').filter(Boolean).pop() || '';
      const cleaned = stem.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      if (cleaned) name = cleaned.slice(0, 40);
    } catch {
      /* 保留默认名 */
    }
    return json({
      ok: true,
      name: `${name}.${ext}`,
      type: contentType.startsWith('image/') ? contentType : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      content: bytesToBase64(bytes),
    });
  } catch (err) {
    return jsonErr(err.status || 502, 'fetch_failed', err.message || '下载失败');
  }
}

function jsonErr(status, error, message) {
  return json({ ok: false, error, message }, status);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
