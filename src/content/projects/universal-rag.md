---
title: 通用可配置 RAG 问答系统
slug: universal-rag
category: RAG 应用
tags: [RAG, 全栈, FastAPI]
date: 2026-06-30
status: draft
summary: 知识与风格分离的通用 RAG 问答系统：多知识库隔离、Skill 机制控制回答风格，FastAPI + 原生前端 SPA。
tech_stack: [FastAPI, Python, JavaScript, SQLite, RAG]
demo_type: none
featured: true
source: 项目/MVP
---

## 项目简介

一个不绑定任何领域的通用 RAG 问答系统：用户上传任意领域的文本知识，系统提供从知识接入、切分、检索到问答的完整链路，回答风格由独立的 Skill 配置控制。

## 核心能力

- **知识与风格分离**：知识内容由上传决定，回答风格由 Skill 配置决定，二者完全解耦
- **多知识库隔离**：每个知识库拥有独立的文件集合，支持分别检索
- **完整知识管线**：txt/md 上传 → 固定大小切分 → 持久化原始文件与知识块 → 检索问答
- **可观测性**：检索与生成过程透明可追溯，支持 Debug 分析
- **轻量部署**：本地化运行，无云服务依赖

## 技术架构

FastAPI 后端（config_loader / database / models / routers / services 分层）+ 原生 JavaScript SPA 前端（hash 路由 + api 层隔离）。配套文档齐全：用户手册、系统操作手册与配置说明、通用 RAG 技术说明文档、系统升级说明。

## 复盘

「Skill 与知识解耦」是这个系统最值得记住的设计：同一个知识库，可以通过切换 Skill 输出客服口吻或教师口吻的回答，而不必重建索引。这也印证了 RAG 系统的两个正交维度——知识管线和风格控制——应该分开演进。
