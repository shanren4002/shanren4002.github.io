---
title: AiMVP · AI 事件复盘引擎
slug: aimvp
category: AI 产品
tags: [AI 产品, FSM, Next.js, 复盘]
date: 2026-08-21
status: published
summary: 规则驱动的 AI 事件复盘产品：七阶段有限状态机引导用户把一次具体事件重构为可保存的认知资产。
tech_stack: [Next.js, React, TypeScript, Tailwind CSS, SQLite, DeepSeek, Zod]
demo_type: none
featured: true
source: 项目/AiMVP
---

## 项目简介

AiMVP 是一个事件复盘工具：通过规则驱动的 AI 对话，引导用户将一次具体事件重新组织为事实、目标、结果、关键节点、因果关系、洞察与行动原则，并保存为个人认知资产。

## 核心能力

- **协议即流程**：`protocol/*.json` 定义 FSM 七阶段、迁移规则（required / threshold / max_followup / next_stage）与完整度评分，改流程不改代码
- **三角色分工**：interviewer（信息采集）/ analyst（因果分析）/ reviewer（逻辑审核），LLM 只负责表达，不参与状态决策
- **完整度评分**：每阶段总分 100，阈值未达标时自动追问，不放过模糊表述
- **结构化报告**：复盘结束生成报告页，对话全过程可回溯

## 技术架构

Next.js 14 App Router + React 18 + TypeScript，Tailwind + shadcn/ui，SQLite（node:sqlite 内置驱动，无原生编译），DeepSeek 直连 HTTP，Zod 全链路校验。架构上分为 Protocol（决定流程）→ Engine（决定状态）→ LLM（决定表达）三层，边界清晰。

## 复盘

这个项目最核心的决策是「状态机不交给 LLM」：阶段迁移、评分、追问逻辑全部由确定性代码驱动，模型只做语言表达。结果是对话节奏稳定、可测试、可回归——如果用自由对话实现同样的复盘流程，质量会随模型波动而不可控。protocol 与 engine 分离也让产品经理可以直接改 JSON 调流程。
