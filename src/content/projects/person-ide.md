---
title: PersonIDE · 知识库关键词分析
slug: person-ide
category: 工具
tags: [Python, CLI, DeepSeek, SiliconFlow]
date: 2026-10-17
status: published
summary: 本地 Python CLI 知识库分析工具：三策略问答路由（全量/摘要/自适应）+ 低置信度澄清追问，产出可离线打开的静态 HTML 报告。
tech_stack: [Python, DeepSeek, SiliconFlow, CLI]
demo_type: static
demo_url: /demos/person-ide/index.html
featured: false
source: 项目/PersonIDE
---

## 项目简介

一个本地运行的 Python 命令行程序：读取 Markdown 个人知识库，调用在线大模型回答问题，并生成可直接在浏览器打开的静态 HTML 报告。核心设计是三种问答策略的路由——同一份文档、同一个 query，可以按不同策略分别回答并对比。

## 核心能力

- **三策略路由**：`full_read`（全量原文直接回答）/ `summary`（结构化摘要上下文）/ `adaptive`（默认，按意图自动选择），三策略共用同一个回答函数与回答指令，区别只在传入的文档上下文
- **compare 对比模式**：同一次运行中，用同一份文档和 query 分别调用全量与总结策略，在一份 HTML 报告里并排呈现
- **低置信度澄清**：自适应策略置信度低于 70% 时，围绕用户问题提出针对性澄清；每三轮比较一次置信度增幅，增幅不足 10 个百分点且仍低于阈值，则停止追问并降级为全量读取——宁可多读，不可遗漏
- **Token 级可观测**：报告按阶段汇总输入 / 输出 / 总 Token，API 返回缓存命中字段时单独拆分显示；某次请求用量缺失时显示「未知」，不估算为 0
- **上下文留痕**：每次运行将实际用于回答的文档上下文存档到 `analysis_documents/`，回答依据可追溯
- **双模型提供方**：DeepSeek（默认）/ SiliconFlow 可切换，`AI_BASE_URL`、`AI_MODEL` 可覆盖默认值

## 技术架构

Python 3.10+ 单体 CLI：`main.py` 为入口，`person_knowledge` 包内含 `file_loader` / `keyword_extractor` / `keyword_stats` 三个可独立运行的模块。HTML 报告为纯静态单文件，AI 答案中的 Markdown 会被格式化为标题、列表、代码块，原始 HTML 作为文本处理，无需启动任何服务。全部测试不依赖 API 密钥与网络，离线可跑。

## 复盘

「置信度增幅不足就降级全量」这个阈值规则，体现的是一种保守的工程哲学：意图分类不确定时，宁可多花 Token 也不冒漏答案的风险。而 compare 模式把「哪种上下文更靠谱」从主观感觉变成了可并排查看的证据——策略对比不该靠感觉，应该放进同一次运行里。
