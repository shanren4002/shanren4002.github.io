---
title: "RESTful API 设计"
slug: restful-design
category: "HTTP knowledges"
tags: [HTTP, RESTful]
date: 2026-09-17
status: published
summary: "用 URL 表示资源、用 HTTP 方法表示操作的 REST 设计风格速览"
source: "笔记/HTTP knowledges/RESTful设计.md"
---
REST 是一种 API 设计风格：用 URL 表示资源，用 HTTP 方法表示操作。

例子：

- `GET /orders/123`：查订单 123
    
- `GET /orders?status=shipped`：查已发货订单
    
- `POST /tickets`：创建工单
    
- `PATCH /tickets/456`：修改工单 456
    
- `DELETE /memories/789`：删除记忆 789
    

智能客服常用接口可能长这样：

- `POST /chat/messages`：用户发消息
    
- `GET /orders/{order_id}`：查订单
    
- `POST /tickets`：创建工单
    
- `GET /knowledge/search?q=退款政策`：搜知识库
