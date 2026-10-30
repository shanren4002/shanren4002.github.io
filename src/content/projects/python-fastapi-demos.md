---
title: FastAPI 学习 Demo 集
slug: python-fastapi-demos
category: 后端服务
tags: [FastAPI, Python, uvicorn, 学习]
date: 2026-08-29
status: published
summary: FastAPI 最小示例集：异步端点、请求体、表单、文件上传、路径参数与配置管理，一组可运行文件覆盖核心用法。
tech_stack: [FastAPI, Python, uvicorn]
demo_type: none
featured: false
source: 项目/PythonFastAPI
---

## 项目简介

一组 FastAPI 学习 Demo：每个文件一个最小可运行示例，合起来覆盖 FastAPI 的核心用法——异步、请求体、表单、文件上传、路径参数与配置管理。不追求完整业务，只追求每个知识点都能跑、能改、能对着 `/docs` 发请求。

## 核心能力

- **异步端点**：`async_demo` 演示 async 路由的写法
- **请求体与模型**：`request_body` 演示 Pydantic 模型接收 JSON
- **表单与文件上传**：`form_data` / `file_test` 覆盖两种常见入参形态
- **路径参数**：`rout_num` 演示路径参数声明
- **配置管理**：`request_confi` / `fied_confi` 两组配置示例
- **零摩擦学习循环**：启动器自动打开 `/docs` 交互文档，「改代码—看文档—发请求」一气呵成

## 技术架构

FastAPI + uvicorn，每个 Demo 独立成文件、互不依赖，`main.py` 汇总入口。运行即自动打开 Swagger 交互文档，是后续所有 FastAPI 项目（智能客服 API、通用 RAG、Campus Agent）的共同地基。

## 复盘

这组 Demo 值钱的不是代码量，而是学习方式：`/docs` 自动打开这个细节，把学习曲线从「查文档」变成了「玩文档」——每个知识点都从「读过」变成「发过一次请求」。后来做智能客服 API 时的分层直觉、做 Campus Agent 时的路由组织，都可以追溯到这组最小示例。
