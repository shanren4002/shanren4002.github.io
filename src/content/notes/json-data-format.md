---
title: "JSON 数据格式"
slug: json-data-format
category: "HTTP knowledges"
tags: [HTTP, JSON]
date: 2026-09-17
status: published
summary: "API 常用 JSON 数据格式示例：订单结构与嵌套数组"
source: "笔记/HTTP knowledges/JSON数据格式.md"
---
API 常用的数据格式（还有表单数据）

```
{
  "order_id": "123",
  "status": "shipped",
  "items": [
    {"name": "键盘", "count": 1}
  ]
}
```
