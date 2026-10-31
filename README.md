# portfolio

个人 GitHub 作品集：笔记档案 · 项目展示 · 艺术画廊。

对 AI 说一句「**帮我把这 xxx 上传到我的作品集**」即完成归档（主通道）；网页后台自助上传为辅通道。

## 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 站点 | Astro 5（零 JS 默认 + Islands） | 内容站性能预算 FCP ≤2s / JS ≤50KB |
| 搜索 | Pagefind（构建期索引，按需加载） | 不占首屏，无服务端 |
| 内容契约 | Zod（`src/content.config.ts`）+ `scripts/check_content.py` | 唯一事实源，CI 双门禁 |
| 部署 | GitHub Pages + Actions 自定义工作流 | 双门禁失败即中止，线上保持上一版本 |
| 后台 | Cloudflare Worker 同源（`/admin` + `/api/v1/*`） | 无 CORS 面；GitHub OAuth + PAT 写仓库 |
| 主题 | 彩铅笔感亮主题（`src/styles/tokens.css`，全站唯一主题） | 纸感底色 + 手绘气质，无切换零 JS 开销 |

## 目录结构

```
portfolio/
├── .github/workflows/deploy.yml   # CI/CD：双门禁 → build → Pages 部署
├── src/
│   ├── content.config.ts          # Zod 内容契约（唯一事实源）
│   ├── content/                   # notes/ projects/ gallery.json（AI 只写这里）
│   ├── layouts/Base.astro         # 全局骨架（页脚版权行）
│   ├── pages/                     # index / about（M1+ 扩充列表页）
│   └── styles/tokens.css          # 亮主题设计令牌（全站唯一主题）
├── public/images/                 # notes/ projects/ gallery/ 图片资产
├── scripts/check_content.py       # CI 门禁①：schema + 敏感信息 + 图片体积
├── worker/                        # Cloudflare Worker 同源后台（M0 空壳）
├── AGENTS.md                      # AI 协作者操作契约（第一公民机制）
└── astro.config.mjs               # site: https://USERNAME.github.io（M0 待替换）
```

## 快速开始

```bash
pnpm install        # 安装依赖
pnpm dev            # 本地开发 → localhost:4321
pnpm check          # 内容契约预检（push 前必跑）
pnpm build          # 构建 + Pagefind 索引
```

## CI/CD 双门禁

push 到 `main` 触发 `Deploy Pages`：

1. **门禁①** `python3 scripts/check_content.py` —— schema 预校验 + 敏感信息扫描 + 图片体积（>2MB 即失败）
2. **门禁②** `pnpm build` —— `astro build` + `pagefind`，Zod 构建期二次校验
3. 体积监控（软告警不阻断）→ 上传制品 → 部署 Pages

任一硬门禁失败 → `deploy` job 不运行（`needs: build`）→ **线上保持上一可用版本**。

## 施工路线图

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 项目骨架：亮主题 + CI/CD 双门禁 + Worker 空壳 | ✅ 已完成 |
| M1 | 内容迁移：53 篇笔记 → `src/content/notes/` | ✅ 已完成（52 篇上线） |
| M2 | 项目档案 + demo 静态副本 | ✅ 已完成（9 个项目上线） |
| M3 | 艺术画廊 + 图片管线（`optimize_image.py`） | ✅ 已完成（首批 4 张上线） |
| M3.5 | 网页后台上传通道（OAuth + PAT） | ⬜ |
| M4 | 验收上线（G1~G12 质量门禁） | ⬜ |

完整方案见 `.workbuddy/plans/全栈系统交付全案.md`。
