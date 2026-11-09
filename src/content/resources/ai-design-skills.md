---
title: AI Design Skills：AI 编码工具的设计技能合集
slug: ai-design-skills
kind: Skill 包
tags: [AI 设计, Skill, Claude Code, Cursor, Figma, 落地页]
date: 2026-11-09
status: draft
summary: 给 AI 编码工具用的设计 Skill 合集：landing-page-design 从零起落地页、figma-designer 在 Figma 里做结构化设计，一行 npx 即装，MIT。
link_url: https://github.com/elayadesign/ai-design-skills
link_label: 访问仓库
links: [{ label: "skills.sh 页面", url: "https://skills.sh/elayadesign/ai-design-skills" }]
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
