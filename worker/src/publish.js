/**
 * worker/src/publish.js —— 发布载荷校验 + 文件构建 + 单 commit 入库
 *
 * 对齐全案 §6.3 POST /api/v1/publish 与 PRD 流程② S4~S7：
 *   - 前端已做 Canvas 压缩（≤1920 WebP + thumb 640）；Worker 侧二次校验
 *     （格式/体积/数量），超限文件拒绝、其余继续（批量部分失败语义）
 *   - 命名契约与 scripts/optimize_image.py 一致：YYYYMMDD-<slug>-<序号>.webp
 *     （画廊页 thumbOf = src.replace(/\.webp$/, '-thumb.webp')，命名保持一致）
 *   - md + N 图片对（主图+缩略图）+ gallery.json 更新经 Git Data API 组成单 commit（原子）
 *   - 产出必须过 scripts/check_content.py 门禁（slug=kebab、文件名=slug、
 *     summary≤120、gallery src 同 commit 落地）
 */

import { publishCommit, getFile, listDir } from './github.js';
import { json } from './auth.js';

export const ALLOWED_IMAGE_EXTS = ['.webp', '.jpg', '.jpeg', '.png'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 单文件 10MB（PRD S3）
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 门禁①：public/images 下 >2MB 即失败
export const MAX_FILES_PER_BATCH = 20; // 单次 ≤20 个
const MAX_SUMMARY_LEN = 120;
const SITE_BASE = 'https://shanren4002.github.io';

// ---------- 纯函数（可单测） ----------

/** 标题 → slug 建议（仅 ASCII 可转；中文标题返回 ''，由用户手填） */
export function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0;
}

/** 今天（UTC+8）YYYY-MM-DD */
export function todayCN(now = Date.now()) {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function yamlQuote(v) {
  const s = String(v);
  if (/[\\"]/.test(s)) return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return `"${s}"`;
}

function yamlList(arr) {
  return '[' + arr.map((s) => yamlQuote(s)).join(', ') + ']';
}

/** 构建 front-matter + 正文（字段对齐 src/content.config.ts 契约） */
export function buildMarkdown(kind, meta, body) {
  const fm = [
    `title: ${yamlQuote(meta.title)}`,
    `slug: ${yamlQuote(meta.slug)}`,
    `date: ${yamlQuote(meta.date)}`,
    `status: ${yamlQuote(meta.status || 'draft')}`,
    `tags: ${yamlList(meta.tags || [])}`,
    `summary: ${yamlQuote(meta.summary || '')}`,
  ];
  if (kind === 'note' || kind === 'project') {
    fm.push(`category: ${yamlQuote(meta.category || '')}`);
  }
  if (kind === 'project') {
    if (meta.repo_url) fm.push(`repo_url: ${yamlQuote(meta.repo_url)}`);
    fm.push(`demo_type: ${yamlQuote(meta.demo_type || 'none')}`);
    if (meta.demo_url) fm.push(`demo_url: ${yamlQuote(meta.demo_url)}`);
    fm.push(`tech_stack: ${yamlList(meta.tech_stack || [])}`);
    fm.push(`featured: ${meta.featured ? 'true' : 'false'}`);
  }
  if (meta.cover) fm.push(`cover: ${yamlQuote(meta.cover)}`);
  if (meta.source) fm.push(`source: ${yamlQuote(meta.source)}`);
  return `---\n${fm.join('\n')}\n---\n\n${body || ''}`;
}

/**
 * 从目录列表计算下一个序号（与 optimize_image.py _next_seq 同规则）。
 * @param {string[]} names 目录内文件名（含本批已占用的名字）
 * @param {string} day YYYYMMDD
 * @param {string} slug
 */
export function nextSeq(names, day, slug) {
  const re = new RegExp(`^${day}-${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)`);
  let max = 0;
  for (const n of names) {
    const m = n.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return String(max + 1).padStart(2, '0');
}

export function base64Length(b64) {
  const s = String(b64).replace(/\s/g, '');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - pad;
}

function normalizeBase64(b64) {
  // 剥离 data URL 前缀，统一为纯 base64
  const i = String(b64).indexOf('base64,');
  return i > -1 ? String(b64).slice(i + 7) : String(b64);
}

function checkImageEntry(img, label, errors) {
  if (!img || !img.name || !img.data) {
    errors.push(`${label}: 缺少 name/data`);
    return false;
  }
  const ext = '.' + String(img.name).split('.').pop().toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
    errors.push(`${label}: 不支持的格式 ${img.name}`);
    return false;
  }
  const bytes = base64Length(img.data);
  if (bytes > MAX_FILE_BYTES) {
    errors.push(`${label}: ${img.name} 超过 10MB 上限`);
    return false;
  }
  return true;
}

/** 载荷校验（kind/meta/status/摘要长度/图片数与体积） */
export function validatePayload(payload) {
  const errors = [];
  const kind = payload.kind;
  if (!['note', 'project', 'gallery'].includes(kind)) errors.push('kind 须为 note / project / gallery');

  const meta = payload.meta || {};
  if (!meta.title || !String(meta.title).trim()) errors.push('标题必填');
  if (!isValidSlug(meta.slug || '')) errors.push('slug 不合规（kebab-case：小写字母/数字/连字符）');
  if (!meta.date || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) errors.push('date 须为 YYYY-MM-DD');
  if (meta.summary && String(meta.summary).length > MAX_SUMMARY_LEN) {
    errors.push(`summary 超长（${String(meta.summary).length} > ${MAX_SUMMARY_LEN}）`);
  }
  if (!['draft', 'published', 'archived'].includes(meta.status || 'draft')) errors.push('status 非法');
  if ((kind === 'note' || kind === 'project') && !meta.category) errors.push('分类必填');

  const images = Array.isArray(payload.images) ? payload.images : [];
  if (images.length > MAX_FILES_PER_BATCH) errors.push(`单次最多 ${MAX_FILES_PER_BATCH} 张图片`);
  for (const img of images) {
    if (checkImageEntry(img, '图片', errors) && img.thumb) {
      checkImageEntry(img.thumb, '缩略图', errors);
    }
  }
  if (kind === 'gallery' && images.length === 0) errors.push('画廊发布至少需要 1 张图片');
  if (kind !== 'gallery' && images.length > 5) errors.push('笔记/项目封面图最多 5 张');

  return errors;
}

export function utf8ToBase64(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

/** 组装一对（主图 + 缩略图）文件名：YYYYMMDD-<slug>-<序号>[.-thumb].<ext> */
export function imagePairNames(day, slug, seq, ext) {
  return {
    main: `${day}-${slug}-${seq}.${ext}`,
    thumb: `${day}-${slug}-${seq}-thumb.${ext}`,
  };
}

// ---------- 发布主流程 ----------

/**
 * @param {Request} request
 * @param {object} env
 * @param {object} session JWT payload（已过 requireAuth）
 */
export async function handlePublish(request, env, session) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request', message: '请求体须为 JSON' }, 400);
  }

  const errors = validatePayload(payload);
  if (errors.length) return json({ error: 'invalid_payload', errors }, 400);

  const kind = payload.kind;
  const meta = { ...payload.meta };
  meta.slug = String(meta.slug).toLowerCase();
  meta.tags = Array.isArray(meta.tags) ? meta.tags.map(String) : [];
  meta.status = meta.status || 'draft';
  const images = (payload.images || []).map((img) => ({
    name: img.name,
    data: normalizeBase64(img.data),
    thumb: img.thumb ? { name: img.thumb.name, data: normalizeBase64(img.thumb.data) } : null,
  }));

  const files = []; // {path, contentBase64}
  let visitUrl = '';
  const rejected = [];

  try {
    if (kind === 'gallery') {
      const day = meta.date.replace(/-/g, '');
      const dir = 'public/images/gallery';
      const existing = await listDir(env, dir);
      const usedNames = existing.map((it) => it.name);

      // 1) 逐图配对命名（序号目录内递增，与 optimize_image.py 同规则）
      const pairs = [];
      for (const img of images) {
        const seq = nextSeq(usedNames, day, meta.slug);
        const ext = String(img.name).split('.').pop().toLowerCase();
        const { main, thumb } = imagePairNames(day, meta.slug, seq, ext);
        usedNames.push(main, thumb);
        pairs.push({ img, main, thumb });
      }

      // 2) 门禁①体积闸：压缩后仍 >2MB 的拒收（该图跳过，其余继续）
      const accepted = [];
      for (const p of pairs) {
        if (base64Length(p.img.data) > MAX_IMAGE_BYTES) {
          rejected.push({ name: p.main, reason: '压缩后仍超过 2MB（门禁①硬限）' });
        } else {
          accepted.push(p);
        }
      }
      for (const p of accepted) {
        files.push({ path: `${dir}/${p.main}`, contentBase64: p.img.data });
        if (p.img.thumb) files.push({ path: `${dir}/${p.thumb}`, contentBase64: p.img.thumb.data });
      }

      // 3) gallery.json 追加条目（与图片同 commit，保证 check_content.py 的 src 存在性校验通过）
      const current = await getFile(env, 'src/content/gallery.json');
      let galleryData = { items: [] };
      if (current && current.content) {
        try {
          galleryData = JSON.parse(atob(current.content));
        } catch { /* 损坏则重建 */ }
      }
      if (!galleryData || !Array.isArray(galleryData.items)) galleryData = { items: [] };
      const added = [];
      for (const p of accepted) {
        galleryData.items.push({
          slug: p.main.replace(/\.[^.]+$/, ''),
          src: p.main,
          title: meta.title,
          date: meta.date,
          status: meta.status,
          ...(meta.series ? { series: meta.series } : {}),
          ...(meta.prompt ? { prompt: meta.prompt } : {}),
        });
        added.push(p.main);
      }
      files.push({
        path: 'src/content/gallery.json',
        contentBase64: utf8ToBase64(JSON.stringify(galleryData, null, 2) + '\n'),
      });

      const commitSha = await publishCommit(env, files, `content(backend): 画廊 +${accepted.length} 张（${meta.title}）`);
      visitUrl = `${SITE_BASE}/gallery/`;
      return json({ ok: true, commit: commitSha, visit_url: visitUrl, added, rejected, eta: '约 1~3 分钟线上生效', user: session.login });
    }

    // note / project：封面图入库 public/images/<kind>s/，cover 指向 -thumb.webp
    if (images.length) {
      const day = meta.date.replace(/-/g, '');
      const dir = kind === 'note' ? 'public/images/notes' : 'public/images/projects';
      const existing = await listDir(env, dir);
      const usedNames = existing.map((it) => it.name);
      let coverSet = false;
      for (const img of images) {
        const seq = nextSeq(usedNames, day, meta.slug);
        const ext = String(img.name).split('.').pop().toLowerCase();
        const { main, thumb } = imagePairNames(day, meta.slug, seq, ext);
        usedNames.push(main, thumb);
        if (base64Length(img.data) > MAX_IMAGE_BYTES) {
          rejected.push({ name: main, reason: '压缩后仍超过 2MB（门禁①硬限）' });
          continue;
        }
        files.push({ path: `${dir}/${main}`, contentBase64: img.data });
        if (img.thumb) files.push({ path: `${dir}/${thumb}`, contentBase64: img.thumb.data });
        if (!coverSet) {
          meta.cover = `/images/${kind === 'note' ? 'notes' : 'projects'}/${thumb}`;
          coverSet = true;
        }
      }
    }

    const md = buildMarkdown(kind, meta, payload.markdown || '');
    const dir = kind === 'note' ? 'src/content/notes' : 'src/content/projects';
    const dup = await getFile(env, `${dir}/${meta.slug}.md`);
    files.push({ path: `${dir}/${meta.slug}.md`, contentBase64: utf8ToBase64(md) });

    const commitSha = await publishCommit(env, files, `content(backend): ${kind === 'note' ? '笔记' : '项目'}《${meta.title}》`);
    visitUrl = `${SITE_BASE}/${kind === 'note' ? 'notes' : 'projects'}/${meta.slug}/`;
    return json({
      ok: true,
      commit: commitSha,
      visit_url: visitUrl,
      overwrote: Boolean(dup),
      rejected,
      eta: meta.status === 'published' ? '约 1~3 分钟线上生效' : '已存为草稿，抽查后可在后台改状态发布',
      user: session.login,
    });
  } catch (err) {
    return json({ error: 'publish_failed', message: String(err && err.message ? err.message : err) }, 502);
  }
}
