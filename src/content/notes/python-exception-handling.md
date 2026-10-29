---
title: "Python 异常处理基础"
slug: python-exception-handling
category: "Python"
tags: [Python]
date: 2026-09-17
status: published
summary: "try/except 异常捕获与 FastAPI 统一异常处理实践"
source: "笔记/Python/异常处理基础.md"
---
```
async def call_llm(prompt: str) -> str:
    try:
        # 调用模型
        return "回复"
    except TimeoutError:
        return "请求超时，请稍后再试"
    except Exception as e:
        print(f"LLM 调用失败: {e}")
        raise

#FastAPI 中统一异常处理：

from fastapi import HTTPException
@app.get("/orders/{order_id}")
async def get_order(order_id: int):
    if order_id <= 0:
        raise HTTPException(status_code=400, detail="订单 ID 必须大于 0")
    return {"order_id": order_id}
```
