---
title: "HTTP 请求与响应结构"
slug: http-request-response
category: "HTTP knowledges"
tags: [HTTP]
date: 2026-09-17
status: draft
summary: "HTTP 请求的方法、URL、Headers、Body 与各类参数速览"
source: "笔记/HTTP knowledges/HTTP请求、响应.md"
---
HTTP 请求包含：

- **方法**：GET（查询）、POST（创建）、PUT（全量更新）、PATCH（部分更新）、DELETE（删除）
    
- **URL**：请求地址，如 `/orders/123`
    
- **Headers**：元信息，如 `Content-Type: application/json`、`Authorization: Bearer xxx`
    
- **Body**：请求体，通常是 JSON
    
- **Query 参数**：如 `/orders?status=shipped`
    
- **Path 参数**：如 `/orders/123` 里的 `123`
    

HTTP 响应包含：

- **状态码**：200、201、400、401、404、500 等
    
- **Headers**
    
- **Body**：通常是 JSON
