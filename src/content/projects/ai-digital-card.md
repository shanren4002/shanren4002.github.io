---
title: AI 数字名片
slug: ai-digital-card
category: RAG 应用
tags: [RAG, Streamlit, 个人名片]
date: 2026-08-05
status: published
summary: Streamlit 个人知识库展示网站：YAML 驱动的经历荣誉展示，加基于 Chroma 向量检索的「AI 分身」对话。
tech_stack: [Python, Streamlit, LangChain, Chroma, HuggingFace, DeepSeek]
demo_type: none
featured: false
source: 项目/AI数字名片
---

## 项目简介

一个基于 Streamlit 的个人经历展示 + AI 对话网站。访客可以浏览结构化的个人经历与荣誉，并和「基于你文档训练的 AI」对话——所有个人信息集中在 `data.yaml`，改数据即改网站。

## 核心能力

- **数据驱动展示**：`data.yaml` 定义姓名、联系方式、经历、荣誉，首页按模块渲染
- **RAG 知识库**：启动时自动读取 `knowledge_base/` 下的 PDF/DOCX/TXT/MD，切片后存入 Chroma 向量库
- **本地 Embedding**：HuggingFace `bge-small-zh-v1.5` 中文向量模型，免费无需 API Key
- **AI 分身对话**：检索 top-4 片段 + 人设系统提示词，DeepSeek 流式输出，严格基于资料回答、不编造
- **降级处理**：知识库为空或缺少 API Key 时，展示区仍然可用，聊天区给出明确指引

## 技术架构

Streamlit 单应用 + LangChain 检索链（RecursiveCharacterTextSplitter 500 字切片 / 50 字重叠）+ Chroma 持久化 + DeepSeek OpenAI 兼容接口。`st.cache_resource` 缓存检索器，避免每次交互重建向量库。

## 复盘

「严格基于检索内容回答，不知道就说不知道」的提示词约束是这个项目的灵魂——数字名片场景里， hallucination 的成本比答不上来高得多。另外延迟导入 LangChain 的设计让依赖不完整时首页依然能打开，是个值得保留的习惯。
