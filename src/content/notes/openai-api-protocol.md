---
title: "OpenAI API 协议：Chat Completions 与 Responses"
slug: openai-api-protocol
category: "智能客服"
tags: [OpenAI, API]
date: 2026-09-25
status: published
summary: "两大核心接口对比：无状态对话补全与新一代 Responses API"
source: "笔记/FastAPI/智能客服/openai协议.md"
---
OpenAI 协议本身主要包含两个核心接口：

#### Chat Completions API (`/v1/chat/completions`)

这是**最经典、最通用**的接口，设计于 2023 年，是无状态的对话补全接口。你发送一组 `messages`（包含 `role` 和 `content`），模型返回一条回复。

- **核心特点**：**无状态**。你需要每次在 `messages` 中携带完整的对话历史，模型本身不记忆任何上下文。
    
- **适用场景**：基础的聊天机器人、单轮问答、内容生成。
    

#### Responses API (`/v1/responses`)

这是 OpenAI 官方推荐的**新一代接口**，专为构建更复杂的、具备“代理（Agent）”能力的应用而设计。

- **核心特点**：**有状态**。它支持通过 `store: true` 参数在服务端保存对话状态，并利用 `previous_response_id` 来引用之前的轮次，无需每次都发送全部历史。它内置了**网络搜索、文件搜索、代码解释器**等工具，支持模型在一次请求中调用多个工具。此外，它在使用推理模型时，能更好地保留“思维链”状态，提升性能。
    
- **适用场景**：需要**多轮复杂对话、工具调用、联网搜索**的 Agent 应用。
    

> **注意**：虽然 Chat Completions API 仍然被支持，但 OpenAI 官方建议所有新项目都优先使用 Responses API。
