---
title: AI Design Skills：AI 编码工具的设计技能合集
slug: ai-design-skills
kind: Skill 包
tags: [AI 设计, Skill, Claude Code, Cursor, Figma, 落地页]
date: 2026-11-09
status: draft
summary: 给 AI 编码工具用的设计 Skill 合集：landing-page-design 从零起落地页、figma-designer 在 Figma 里做结构化设计，一行 npx 即装，MIT。附本站用它生成的落地页案例。
link_url: https://github.com/elayadesign/ai-design-skills
link_label: 访问仓库
links: [{ label: "案例 Demo（技能生成）", url: "/demos/ai-design-skills/" }, { label: "skills.sh 页面", url: "https://skills.sh/elayadesign/ai-design-skills" }]
source: https://github.com/elayadesign/ai-design-skills
---

## 它是什么

一套**给 AI 编码工具用的设计 Skill 合集**：每个 skill 都是一个自包含的文件夹，核心是一份 `SKILL.md` 规则文件——Claude Code、Cursor、Codex、Windsurf，任何读 markdown 规则文件的 AI 工具都能直接吃下去。MIT 协议，一行命令安装，按需取用。

它解决的痛点很明确：AI 写代码已经够好了，但**没人告诉它什么是好的设计**。这些 skill 就是把「设计系统」翻译成 AI 能执行的规则。

## 收录的两个技能

### landing-page-design —— 从零起一个落地页

完整链路：intake 提问厘清需求 → 页面结构 → 转化文案 → 一整套视觉系统（字体、间距、圆角、动效）。不是给你一个模板，而是逼着 AI 先把问题问对再动手。

所有设计价值观（字体、颜色、间距、动效）集中在文件底部单独一节——fork 之后只改那一节，skill 的其余部分自动跟随。

### figma-designer —— 在 Figma 里做真正的结构化设计

和「让 AI 画个图」完全两回事：它建的是**真结构**——spacing / radius / color 变量、命名文字样式、auto layout、带全部状态的组件，外加一个随令牌更新的 Foundations 画板。产出是能改能复用的设计系统，不是一张截图。

## 安装方式

用 skills CLI（需要 Node.js）：

```bash
# 列出全部技能，不安装
npx skills add elayadesign/ai-design-skills --list

# 装一个、并指定给哪些 agent 用
npx skills add elayadesign/ai-design-skills --skill landing-page-design -a claude-code -a cursor

# 用户级安装（对所有项目生效）
npx skills add elayadesign/ai-design-skills -g
```

技能会落进 `.claude/skills/`（Claude Code）或 `.agents/skills/`（Cursor / Codex 等）。也可以手动安装：把对应 skill 文件夹拷进 `.claude/skills/`，或把 `SKILL.md` 贴进 Cursor 的 Rules for AI、Codex 的 `AGENTS.md`。

## 同生态

- **redesign-skill**（`elayadesign/redesign-skill`）：给已有网站做改版的技能，比本合集更早，所以独立成库
- **SlopScan**（slopscan.co）：拿这套规则审计线上现有站点，直接给 agent 一份修复提示——先诊断，再动手

## 为什么收录

这两个 skill 已经装在我的环境里日常在用。收录标准很简单：**不是转过就等于收藏，是真的在帮干活才算**。landing-page-design 那套「intake → 结构 → 文案 → 视觉系统」的方法论，把「做个落地页」这种模糊需求拆成了 AI 可执行的步骤，是目前见过最像样的落地页 skill；figma-designer 则补上了「AI 出的 Figma 文件能不能改」这块短板。

MIT 协议，可自由 fork 改造——设计价值观集中在一节里，就是为了让人改的。

## 使用案例：用它给自己的仓库做了个落地页

收录当天（2026-11-09）我就真跑了一遍：直接加载 `landing-page-design` 技能，按它的流程从零生成了一个完整落地页——**[打开案例 Demo](/demos/ai-design-skills/)**（站内页面，Geist 字体已本地化，无外部依赖，`noindex`）。figma-designer 需要 Figma 环境，沙箱里跑不了，本次案例只覆盖前者。

**怎么来的**（提示词 / 模型 / 参数，如实记录）：

- **提示词**：给技能的任务只有一句——「为 ai-design-skills 仓库生成一个落地页，作为资源库收录条目的使用案例」。intake 环节的答案由我基于仓库公开信息代填：主行动=安装（跑 npx 命令）、受众=用 AI 编码工具又在意出品质量的开发者、三大异议（「又是提示词合集？」「我的工具支持吗？」「能改吗？」）、语气=开发者对开发者
- **模型**：step-5-preview（本次对话的执行模型）
- **技能版本**：`elayadesign/ai-design-skills` @ main（2026-11-01 最后推送），SKILL.md 22,115 字节；本地安装版与仓库内容逐字一致（仅行尾符差异）
- **关键参数**（技能底部「设计价值观」一节的原值）：字体 Geist + Geist Mono（等宽仅用于代码与数据）、暗色色板 `#000000 / #181818 / #1F1F1F / #272727 / #313131 / #131209`、间距十二档 2~96px、圆角走 Tailwind 阶（嵌套半径 = 外半径 − 间隙）、动效基础曲线 `cubic-bezier(0.22, 1, 0.36, 1)`、hero 标题白到灰渐变且上限 680px
- **数据来源**：页面上每个数字都是真的——15,045 stars / 1,144 forks 取自 GitHub API（2026-11-09 抓取）。仓库没有任何用户证言，按技能「禁止编造」的规则，证言节整节删除，没有用占位符糊弄

**技能输出的策略层**（它要求先定战略再写代码，这部分原样保留）：布局选 A（经典 hero 加分区，产品一个 hero 就能讲清）；SEO 结论 noindex（案例副本，canonical 在仓库和 skills.sh，不跟原版抢搜索）；标语揭示区逐字点亮。

**中文化**（站长要求，生成后执行的本地化）：全页说明文案转中文，命令（`npx skills add ...`）、技能名（landing-page-design / figma-designer / redesign-skill）、品牌（GitHub / Figma / Claude Code / Cursor / Codex / Windsurf / Cline / SlopScan）、许可（MIT）与终端输出等「本来就要用英文的」保留原文；标语逐词点亮的切分逻辑同步改为「中文逐字、西文按词」。

**执行中的判断**（偏离与原因，一并记录）：隐私条款 / 独立 404 / 表单验证未做——单页案例副本，法务链接用项目真实的 MIT 许可代替；无证言节；终端窗口里的输出是按 README 原句排的示意 UI。整页 22 项自动验收全过（桌面 + 390px + reduced-motion + 交互状态），验收脚本留档在工作区 `.workbuddy/qa/demo-check.mjs`。
