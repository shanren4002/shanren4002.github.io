---
title: "Python 异步基础"
slug: python-async-basics
category: "Python"
tags: [Python, async]
date: 2026-09-17
status: draft
summary: "async/await 核心用法：同步与异步调用 LLM 的对比示例"
source: "笔记/Python/异步基础.md"
---
异步核心：`async def` 和 `await`。
```
#同步
import time

def call_llm(prompt: str) -> str:
    time.sleep(3)          # 模拟耗时
    return "回复"
    
#异步
import asyncio

async def call_llm(prompt: str) -> str:
    await asyncio.sleep(3)  # 模拟异步耗时
    return "回复"
    
#调用异步函数
async def main():
    result = await call_llm("你好")
    print(result)

asyncio.run(main())

#并发执行多任务
async def main():
    results = await asyncio.gather(
        call_llm("问题1"),
        call_llm("问题2"),
        call_llm("问题3"),
    )
    print(results)
```
