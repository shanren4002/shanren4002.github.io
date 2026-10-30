---
title: 艾爱 · AI 陪伴助手
slug: aiperson
category: 智能体
tags: [AI, LangGraph, 智能体, CLI]
date: 2026-09-15
status: published
summary: 基于 LangGraph 的本地 CLI AI 陪伴助手：多轮对话、Function Calling 工具调用、定时提醒与 AI 决策的主动消息推送。
tech_stack: [Python, LangGraph, LangChain, DeepSeek, SQLite]
demo_type: none
featured: false
source: 项目/AIPERSON
---

## 项目简介

AIPERSON 是一个本地运行的命令行 AI 陪伴助手，内置「艾爱」角色人格——融合 YoRHa 型安卓角色卡的纪律、克制与内在关怀；当用户明确进行系统开发或测试时，自动切换为系统协作模式。

## 核心能力

- **多轮对话**：基于 LangGraph 状态图管理对话流转，MemorySaver 做 checkpoint，上下文不丢失
- **工具调用**：通过 DeepSeek 兼容的 Function Calling 机制调用工具（当前时间、定时提醒）
- **主动互动**：后台线程周期性判断是否需要主动联系用户，由 AI 决策而非定时器硬触发
- **本地持久化**：SQLite 存储对话历史，支持按 `conversation_id` 分组恢复
- **快捷指令**：仅对「现在几点」等明确时间查询走本地快速响应，其余全部交给模型

## 技术架构

Python 3 + LangGraph 1.2 + DeepSeek（OpenAI 兼容 API），配置管理走 python-dotenv，并发模型为多线程（threading + queue.Queue）分离输入线程与事件分发。项目附带完整的 CODE_WIKI.md，目录结构、模块职责、数据流时序均可追溯。

## 复盘

最有意思的设计是「主动互动」：把「要不要说话」的判断交给 AI，而不是写死规则——这让陪伴感真正来自模型而非脚本。Function Calling 与状态图的结合也印证了一点：智能体的复杂度应该由框架的状态机承担，而不是散落在 if-else 里。
