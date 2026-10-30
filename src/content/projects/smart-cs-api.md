---
title: 智能客服 API
slug: smart-cs-api
category: 后端服务
tags: [FastAPI, RAG, 智能客服]
date: 2026-10-01
status: draft
summary: FastAPI 分层架构的智能客服后端：api / cache / db / llm / rag / services 多层分离，Chroma 检索 + 完整测试。
tech_stack: [FastAPI, Chroma, Python, pytest]
demo_type: none
featured: false
source: 项目/FastAPIProjectTestAi
---

## 项目简介

一个按分层架构组织的 FastAPI 智能客服后端，对应学习过程中的「智能客服」主题实践：从 HTTP 入口到向量检索的完整链路，每一层职责单一、可独立替换。

## 核心能力

- **分层架构**：`app/` 下 api（HTTP 层）/ cache / data / db / llm / rag / services 各司其职，入口只做装配
- **RAG 检索**：基于 Chroma 的向量检索增强生成，知识库可独立更新
- **流式对话**：`/api/chat` 路由提供对话能力，测试覆盖流式输出（stream_test）
- **可测试性**：test/ 下覆盖 embeddings、JSON 输出解析、流式响应等多类用例

## 技术架构

FastAPI + uvicorn，python-dotenv 管理配置，Chroma 做向量存储，pytest 做测试。配套的 `.http` 文件可直接在 IDE 里手工验证接口。

## 复盘

这个项目是「分层」思想的练习场：api 层只收参校验转发、rag 层只做检索、llm 层只做模型调用。回头看，最大的收益不是性能而是可维护性——换模型只动 llm 层，换检索策略只动 rag 层。测试文件里对 JSON 输出解析的专项覆盖，也是被真实踩坑逼出来的。
