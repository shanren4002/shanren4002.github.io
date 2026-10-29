---
title: "Python 类型注解"
slug: python-type-hints
category: "Python"
tags: [Python]
date: 2026-09-17
status: published
summary: "类型注解基础与容器写法：让编辑器与 Pydantic 帮你做检查"
source: "笔记/Python/类型注解.md"
---
Python 是动态类型，但类型注解能让编辑器、FastAPI、Pydantic 帮你检查。

基础：

```
name: str = "客服"
age: int = 3
score: float = 99.5
is_active: bool = True
```

容器：

```
from typing import List, Dict, Optional, Union, Any
tags: List[str] = ["退款", "物流"]
user: Dict[str, Any] = {"id": 1, "name": "张三"}
phone: Optional[str] = None          # 可以是 str 或 None
user_id: Union[int, str] = 123       # int 或 str
```

Python 3.10+ 可以简写：

```
phone: str | None = None
user_id: int | str = 123
```

函数注解：
```
def greet(name: str, times: int = 1) -> str:
    return f"你好，{name}" * times
```

Pydantic 模型（FastAPI 核心）：

```
from pydantic import BaseModel, Field
class ChatRequest(BaseModel):
    user_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = None
class ChatResponse(BaseModel):
    reply: str
    session_id: str
```

FastAPI 用这些模型自动校验请求、生成文档。
