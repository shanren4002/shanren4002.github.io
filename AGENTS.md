# AGENTS.md —— AI 协作者操作契约（本仓库第一公民机制）

> 本文件是 AI（本助手及任何协作者）更新本站内容的**唯一操作规范**。
> 核心诉求：对 AI 说一句「帮我把这 xxx 上传到我的作品集」即完成归档。
> 违反安全红线的操作，`scripts/check_content.py` 与 `.gitignore` 会双重拦截。

## 1. 项目速览

- **形态**：静态作品集站（Astro 5 构建 → GitHub Pages 托管，Pagefind 站内搜索）
- **内容**：`src/content/notes`（笔记）、`src/content/projects`（项目档案）、`src/content/gallery.json`（艺术画廊）、`src/content/resources`（资源库：外部资源收录，2026-11-09 开区）
- **主题**：彩铅笔感亮主题（`src/styles/tokens.css`，全站唯一主题；用户 2026-10-30 决策移除暗主题）
- **两条上传通道**：① 对 AI 说话（主通道，commit 前缀 `content(notes|projects|gallery):`）② 网页后台自助上传（辅通道，Worker 生成 commit，前缀 `content(backend):`）——git log 即两条通道的事实源
- **部署**：push 到 `main` 触发 `.github/workflows/deploy.yml`（双门禁：内容预检 + 构建校验）

## 2. AI 只允许写这些路径

| 内容类型 | 写入路径 |
|---|---|
| 笔记 | `src/content/notes/<slug>.md` |
| 项目档案 | `src/content/projects/<slug>.md` |
| 画廊条目 | 追加 `src/content/gallery.json` + 图片落 `public/images/gallery/` |
| 资源条目 | `src/content/resources/<slug>.md`（仅主通道；Worker 后台暂不支持，见 §1） |
| 笔记/项目配图 | `public/images/notes/<slug>/`、`public/images/projects/<slug>/` |
| demo 静态副本 | `public/demos/<slug>/` |

**禁止 AI 修改**：`src/pages/`、`src/components/`、`src/layouts/`、`src/styles/`、`src/content.config.ts`、`astro.config.mjs`、`.github/workflows/`、`worker/`、`scripts/`——除非用户明确要求改版式/功能。需要改时，向用户说明原因并等待确认。

**单一事实源**：站点构建只读 `src/content/`、`public/`；工作区根的 `笔记/`、`项目/` 是素材 inbox，AI 更新内容时只写 `src/content/`，不反向修改 inbox。

## 3. 文件命名规范

- 内容文件：`<slug>.md`，slug = kebab-case ASCII 小写（如 `fastapi-request-body.md`）；**中文标题只进 front-matter `title`，不进文件名**（避免 URL 百分号编码）
- 图片：`YYYYMMDD-<slug>-<序号>.webp`（如 `20261029-cyber-city-01.webp`），列表页缩略图为同名 `-thumb.webp`（宽 640，由 `scripts/optimize_image.py` 生成）

## 4. front-matter 模板（schema 见 `src/content.config.ts`）

```yaml
---
title: 中文标题
slug: kebab-case-slug
category: AI knowledge        # 仅 notes；projects 不需要
tags: [tag1, tag2]
date: 2026-10-29              # ISO YYYY-MM-DD
updated: 2026-10-29           # 选填
status: draft                 # draft → published → archived（AI 默认 draft，用户说"发布"才 published）
cover: /images/notes/<slug>/20261029-xxx-01-thumb.webp   # 选填，指向 public/ 下
summary: 一句话摘要（≤120 字符，AI 生成，用于列表页）
pinned: false
source: 笔记/FastAPI/xxx.md   # 选填，溯源原文路径
---
```

projects 追加字段：`repo_url`（选填）、`demo_type: static|external|none`、`demo_url`（选填）、`tech_stack: []`、`featured: false`。

resources 追加字段：`kind`（资源类型，推荐：Skill 包 / 工具站 / 开源库 / 课程 / 文章）、`link_url`（必填，主链接外链）、`link_label`（主链接按钮文案，默认「前往资源」）、`links`（选填，附加链接数组 `[{label, url}]`）。resources 无 category 字段，类型即 kind。

## 5. 自动归类规则

- 用户指定分类 → 从命
- 用户未指定 → AI 按语义归入既有分类（笔记现有 9 类：AI knowledge / AI prompt / AIPERSON / FastAPI / HTTP knowledges / Python / agent ai / code_knowledge / 后端基础学习），并**在回复中显式声明归类结果**，用户可否决
- 无法归类 → 允许新分类名，回复中提示「新建了分类 X」，由用户决定去留

## 6. 提交信息规范（Conventional Commits）

```
content(notes): 添加 <title>
content(projects): 更新 <slug>
content(gallery): 添加 N 张图片
content(resources): 收录 <title>
fix(content): 修正 <slug> 的分类
```

后台通道由 Worker 统一生成 `content(backend):` 前缀。**每次更新一个主题一个 commit**，禁止把无关修改混在一个 commit（回滚粒度 = 单篇内容）。

## 7. 安全红线（写进契约 + check 脚本 + .gitignore 三重拦截）

1. **禁止提交**：`.env*`（除 `.env.example`）、API key、`*.db` / `*.sqlite3`、`node_modules/`、`.venv/`、`__pycache__/`
2. 图片上传前必须执行 `python3 scripts/optimize_image.py <文件>`，**禁止直接提交 >2MB 的原始图**
3. **push 前必须执行 `python3 scripts/check_content.py`**（schema 预校验 + 敏感信息扫描 + 图片体积），全绿才允许 `git push`
4. 每次更新一个主题一个 commit（见 §6）

## 8. 常用命令

```bash
pnpm dev                          # 本地开发（默认 localhost:4321）
pnpm build                        # 构建（astro build + pagefind 索引）
pnpm check                        # 内容契约预检（push 前必跑）
python3 scripts/check_content.py  # 同上，CI 门禁①同款
```

## 9. M0 用户侧配置清单（完成后逐项勾销）

> 顺序刚性（全案 §4）：先拿 Worker 域名 → 再注册 OAuth App → 最后建仓推送。

- [x] GitHub 用户名已确认（**shanren4002**）→ 已替换 `astro.config.mjs` 中 site 与 `worker/wrangler.toml` 中 `ALLOWED_ORIGIN`
- [x] Cloudflare 账号就绪 → wrangler login 已完成（用户终端执行，OAuth token 存 `C:\Users\Ljk\AppData\Roaming\xdg.config\.wrangler\config\default.toml`）
- [x] Worker 空壳已部署 → 域名 **`https://portfolio-backend.3506328561.workers.dev`**（版本 dd3124b2，2026-10-29 13:30 UTC；沙箱 DNS 不可达 workers.dev，浏览器可达性待用户验证）
- [x] 仓库已建（`shanren4002.github.io`，public 空仓）并推送 → Actions 双门禁触发并全绿 → **站点已上线**（https://shanren4002.github.io）
- [x] GitHub OAuth App 已注册（callback = `https://portfolio-backend.3506328561.workers.dev/api/v1/auth/callback`），Client ID `Ov23lijqsOF9BX5xnW8S` 已入 [vars]；**Secret 曾意外出现在对话/截图中，已要求用户轮换（旧 secret 从未成功注入，无清理负担）**，新 secret 待用户终端注入
- [x] 白名单 user id 已取得（**213465035**，已入 `ALLOWED_USERS` vars，M3.5 生效）
- [x] PAT 已注入：`pnpm exec wrangler secret put GITHUB_PAT --config worker/wrangler.toml`（Contents:write + Actions:write，90 天，仅作品集仓）
- [x] GITHUB_CLIENT_SECRET 已注入：同上命令（轮换后的新 secret，2026-10-29 深夜完成）
- [x] **M0 全部完成**：站点上线 + Worker 部署 + 3 vars + 2 secrets 就位 → 进入 M1

## 10. 开机动画开关（用户一句话控制）

- **开关点（唯一）**：`src/layouts/Base.astro` 内联配置 `window.__DSH_STARTUP__.enabled`（`true`=开 / `false`=关）。**默认 `true`（开）**，2026-11-11 应用户要求设立。
- **触发形式**：用户直接对话说「开机动画关了 / 开了 / 打开开机动画 / 关闭开机动画」——无需用户自己改代码，AI 执行切换。
- **AI 操作流程**（翻转该布尔值属配置调整，不构成 §2 禁止的版式修改）：
  1. 改 `enabled` 值 → 2. `python3 scripts/check_content.py` + `pnpm build` → 3. commit（前缀 `feat(global):` / `fix(global):`，一主题一 commit）→ 4. push → 5. 等 Actions 双门禁全绿 → 6. 回复用户「已生效」
  6. **生效时延**：push 后约 1-2 分钟部署完成即全站生效；对本会话已播过的用户，`mode:'session'` 下新开会话才会再播（关闭则任何会话都不播）
- **关闭路径行为**（与 `?nosplash` / webdriver / reduced-motion 豁免同一 off 分支）：移除挂载点、不加载 `/startup/splash.js`、无黑幕无锁滚动，站点正常直开——专项 e2e 已覆盖该分支
- **调试后门**（不受 enabled 影响，永远可用）：URL 加 `?nosplash=1` 临时不播；控制台 `__DSH_STARTUP_API__.replay()` 重播
- 其余动画参数（频率/音量/音色/玻璃态等）见 Base.astro 配置块注释，用户要调时同理对话触发
