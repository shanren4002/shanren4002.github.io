/**
 * worker/test/publish.test.mjs —— publish.js 纯函数单测（node 直跑，无依赖）
 * 运行：node worker/test/publish.test.mjs
 */
import {
  slugify, isValidSlug, todayCN, buildMarkdown, nextSeq,
  base64Length, validatePayload, imagePairNames, utf8ToBase64,
} from '../src/publish.js';

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ✓', label); }
  else { fail++; console.log('  ✗', label, '\n    期望:', e, '\n    实际:', a); }
}
function ok(cond, label) { eq(Boolean(cond), true, label); }

console.log('— slugify —');
eq(slugify('My Note Title'), 'my-note-title', 'ASCII 标题转 kebab');
eq(slugify('中文标题'), '', '中文标题返回空（需手填）');
eq(slugify('Hello, World! 2026'), 'hello-world-2026', '去标点');

console.log('— isValidSlug —');
ok(isValidSlug('my-note-01'), '合法 slug');
ok(!isValidSlug('My_Note'), '非法 slug（大写/下划线）');
ok(!isValidSlug(''), '空 slug');

console.log('— nextSeq（与 optimize_image.py 同规则）—');
eq(nextSeq([], '20261031', 'my-art'), '01', '空目录 → 01');
eq(nextSeq(['20261031-my-art-01.webp'], '20261031', 'my-art'), '02', '已有 01 → 02');
eq(nextSeq(['20261031-my-art-01.webp', '20261031-my-art-02.webp'], '20261031', 'my-art'), '03', '取 max+1');
eq(nextSeq(['20261031-other-05.webp'], '20261031', 'my-art'), '01', '不同 slug 不干扰');
eq(nextSeq(['20261030-my-art-09.webp'], '20261031', 'my-art'), '01', '不同日期不干扰');
eq(nextSeq(['20261031-my-art-01.webp', '20261031-my-art-01-thumb.webp'], '20261031', 'my-art'), '02', 'thumb 后缀不算主序号');

console.log('— imagePairNames —');
eq(imagePairNames('20261031', 'my-art', '02', 'webp'), { main: '20261031-my-art-02.webp', thumb: '20261031-my-art-02-thumb.webp' }, '主图+缩略图命名');

console.log('— buildMarkdown（front-matter 契约）—');
const md = buildMarkdown('note', {
  title: '测试笔记', slug: 'test-note', date: '2026-10-31', status: 'draft',
  tags: ['Python', '学习'], summary: '一句摘要', category: 'Python',
}, '正文内容');
ok(md.startsWith('---\ntitle: "测试笔记"\n'), '标题进 front-matter');
ok(md.includes('slug: "test-note"'), 'slug 字段');
ok(md.includes('tags: ["Python", "学习"]'), 'tags 行内数组');
ok(md.includes('summary: "一句摘要"'), 'summary 字段');
ok(md.includes('category: "Python"'), 'category 字段');
ok(md.endsWith('\n---\n\n正文内容'), '正文拼接');
const mdProj = buildMarkdown('project', {
  title: '测试项目', slug: 'test-proj', date: '2026-10-31', status: 'published',
  tags: [], summary: '', category: '工具', repo_url: 'https://github.com/x/y',
  demo_type: 'static', demo_url: '/demos/x/index.html', tech_stack: ['Astro'], featured: true,
}, '项目正文');
ok(mdProj.includes('demo_type: "static"'), '项目 demo_type');
ok(mdProj.includes('tech_stack: ["Astro"]'), '项目 tech_stack');
ok(mdProj.includes('featured: true'), '项目 featured');
ok(mdProj.includes('repo_url: "https://github.com/x/y"'), '项目 repo_url');

console.log('— base64Length —');
eq(base64Length(utf8ToBase64('hello')), 5, 'base64 长度解码');
eq(base64Length(btoa('a')), 1, '单字符');

console.log('— validatePayload —');
const base = {
  kind: 'note',
  meta: { title: '标题', slug: 'ok-slug', date: '2026-10-31', category: 'Python', summary: 'x', status: 'draft', tags: [] },
  markdown: '正文',
  images: [],
};
eq(validatePayload(base), [], '合法 note 载荷');
eq(validatePayload({ ...base, meta: { ...base.meta, slug: 'Bad_Slug' } }).length > 0, true, '非法 slug 被拒');
eq(validatePayload({ ...base, meta: { ...base.meta, summary: 'x'.repeat(121) } }).length > 0, true, 'summary 超长被拒');
eq(validatePayload({ ...base, meta: { ...base.meta, category: '' } }).length > 0, true, '缺分类被拒');
eq(validatePayload({ kind: 'gallery', meta: { ...base.meta, title: '画' }, images: [] }).length > 0, true, '画廊无图被拒');
const img1 = { name: 'a.webp', data: utf8ToBase64('x'.repeat(100)) };
eq(validatePayload({ ...base, images: [img1] }), [], '带封面图的 note 合法');
eq(validatePayload({ ...base, images: [{ name: 'a.gif', data: 'xxx' }] }).length > 0, true, 'gif 格式被拒');
eq(validatePayload({ kind: 'note', meta: { title: 't', slug: 's', date: '2026-10-31', category: 'c' }, images: Array.from({ length: 6 }, () => img1) }).length > 0, true, 'note 超 5 图被拒');

console.log('— todayCN —');
ok(/^\d{4}-\d{2}-\d{2}$/.test(todayCN()), 'UTC+8 日期格式');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
