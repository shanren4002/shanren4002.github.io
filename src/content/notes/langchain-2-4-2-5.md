---
title: "LangChain 输出解析与工具绑定（模块 2.4~2.5）"
slug: langchain-2-4-2-5
category: "智能客服"
tags: [LangChain]
date: 2026-09-27
status: draft
summary: "输出解析器与工具绑定、意图路由的知识点整理"
source: "笔记/FastAPI/智能客服/LangChain 2.4 ~ 2.5.md"
---
整理 **模块 2.4 输出解析器 + 2.5 工具绑定与意图路由**：  
**讲解 → 代码 → 关键字 / 导入包 → 效果**。最后串成项目关键文件和测试用例。

---

# 模块 2.4 ~ 2.5 输出解析器与工具绑定知识点整理

## 一、知识点整理

### 1. 为什么需要输出解析器

**讲解**：  
模型默认返回自然语言，程序无法直接判断和路由。  
要让客服系统能"识别意图 → 分流 → 调工具"，模型必须返回**结构化数据**，而不是一段话。

**对比**：

| 返回形式 | 程序能否直接用 |
|---|---|
| `"用户想查订单 12345"` | ❌ 要靠字符串匹配，脆弱 |
| `{"intent": "order", "order_id": 12345}` | ✅ 直接 `x["intent"]` 判断 |

**效果**：  
结构化输出是意图识别、槽位提取、工具调用的前提。没有它，客服系统只能做纯聊天，做不了业务。

---

### 2. JsonOutputParser：简单 JSON

**讲解**：  
把模型输出解析成 `dict`。最轻量，适合字段少、结构简单的场景。

**代码**：

```python
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

parser = JsonOutputParser()

prompt = ChatPromptTemplate.from_messages([
    ("system", "只返回 JSON，不要额外文字。\n{format_instructions}"),
    ("human", "{question}"),
]).partial(format_instructions=parser.get_format_instructions())

chain = prompt | llm | parser

result = chain.invoke({"question": "查一下订单 12345"})
# result = {"intent": "order", "order_id": 12345}
```

**关键字 / 导入包**：

- `JsonOutputParser`：`from langchain_core.output_parsers import JsonOutputParser`
- `parser.get_format_instructions()`
- `format_instructions` 塞进 prompt

**效果**：  
模型输出被解析成 `dict`，程序可直接取字段。  
缺点：没有类型约束，模型可能返回 `"order_id": "12345"`（字符串）或漏字段。

---

### 3. PydanticOutputParser：严格结构

**讲解**：  
用 Pydantic 模型定义输出结构，解析器自动生成格式说明并校验。  
字段类型不对会抛错，比 `JsonOutputParser` 安全得多。

**代码**：

```python
from typing import Literal
from pydantic import BaseModel, Field
from langchain_core.output_parsers import PydanticOutputParser

class Intent(BaseModel):
    intent: Literal["refund", "order", "general"] = Field(
        ..., description="用户意图：refund=退款，order=查订单，general=其他"
    )
    order_id: int | None = Field(
        None, description="订单号，只有 intent=order 或 refund 时才有"
    )

parser = PydanticOutputParser(pydantic_object=Intent)

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是意图识别助手。\n{format_instructions}"),
    ("human", "{question}"),
]).partial(format_instructions=parser.get_format_instructions())

intent_chain = prompt | llm | parser

result = intent_chain.invoke({"question": "退款要多久？"})
# result 是 Intent 对象
# result.intent == "refund"
```

**关键字 / 导入包**：

- `PydanticOutputParser`：`from langchain_core.output_parsers import PydanticOutputParser`
- `Literal`：`from typing import Literal`
- `Field(..., description=...)`
- `parser.get_format_instructions()`
- `pydantic_object=Intent`

**效果**：

- `Literal` 强约束，模型只能输出 `refund` / `order` / `general`
- `description` 告诉模型每个字段含义
- 返回 Pydantic 对象，有类型、有补全、可校验
- 字段类型不对直接报错，不会静默错

---

### 4. Intent 模型：意图 + 槽位

**讲解**：  
意图识别要同时抽出"干什么"和"关键参数"。  
用 `Literal` 约束意图，用 `int | None` 表达可选槽位。

**代码**：

```python
class Intent(BaseModel):
    intent: Literal["refund", "order", "general"] = Field(
        ..., description="用户意图"
    )
    order_id: int | None = Field(
        None, description="订单号，可能为空"
    )
```

**关键字 / 导入包**：

- `Literal["refund", "order", "general"]`
- `int | None`
- `Field(..., description=...)`

**效果**：  
一次调用同时得到意图和订单号。后续路由和工具调用都靠这两个字段。

---

### 5. 正则兜底槽位提取

**讲解**：  
模型有时抽不出 `order_id`，尤其是长句或格式怪异时。  
用正则从原文兜底，保证工具能拿到参数。

**代码**：

```python
import re

def extract_order_id(question: str, parsed_id: int | None) -> int | None:
    if parsed_id:
        return parsed_id
    match = re.search(r"\d{5,}", question)
    return int(match.group()) if match else None
```

**关键字 / 导入包**：

- `re.search(r"\d{5,}", question)`
- `match.group()`

**效果**：  
模型漏抽时用正则补，避免"查一下订单99999"返回"无订单号"。

**规则**：模型靠得住就用模型，靠不住的地方用代码兜底。

---

### 6. @tool 工具定义

**讲解**：  
用 `@tool` 装饰器把普通函数变成 `Runnable`，模型可通过 docstring 理解用途。  
docstring 必须写，参数必须有类型注解。

**代码**：

```python
from langchain_core.tools import tool

@tool
def query_order(order_id: int) -> dict:
    """根据订单号查询订单状态。"""
    if order_id == 99999:
        return {"success": False, "data": {}, "error": "订单不存在"}
    return {
        "success": True,
        "data": {"order_id": order_id, "status": "shipped"},
        "error": None,
    }

@tool
def create_refund(order_id: int, reason: str = "用户申请") -> dict:
    """为指定订单创建退款申请。"""
    return {
        "success": True,
        "data": {"refund_id": f"R{order_id}", "status": "processing"},
        "error": None,
    }
```

**关键字 / 导入包**：

- `tool`：`from langchain_core.tools import tool`
- `@tool` 装饰器
- docstring 必写
- 参数类型注解

**效果**：  
工具变成 `Runnable`，能接进 LCEL 链，也能被模型识别和调用。

**返回值统一结构**：

```python
{"success": bool, "data": {...}, "error": str | None}
```

统一结构让消费方永远知道怎么取值。

---

### 7. RunnableBranch 意图路由

**讲解**：  
意图识别后按 `intent` 分流到不同处理链。  
手动路由比 Agent 自动决策更可控，客服场景首选。

**代码**：

```python
from langchain_core.runnables import RunnableBranch, RunnableLambda

order_chain = RunnableLambda(lambda x: query_order.invoke({"order_id": x["order_id"]}))
refund_chain = RunnableLambda(lambda x: create_refund.invoke({"order_id": x["order_id"]}))
general_chain = RunnableLambda(lambda x: {"reply": "请描述您的问题"})

router = RunnableBranch(
    (lambda x: x["intent"] == "order", order_chain),
    (lambda x: x["intent"] == "refund", refund_chain),
    general_chain,
)
```

**完整链路**：

```python
full_chain = intent_chain | RunnableLambda(lambda i: {
    "intent": i.intent,
    "order_id": extract_order_id(question, i.order_id),
    "question": question,
}) | router
```

**关键字 / 导入包**：

- `RunnableBranch`
- `RunnableLambda`
- 条件元组 `(判断函数, 链)`
- 最后一项默认链

**效果**：

```text
输入 "查一下订单 12345"
  → intent_chain → Intent(intent="order", order_id=12345)
  → router 判断 intent == "order"
  → order_chain 调 query_order(12345)
  → {"success": True, "data": {"status": "shipped"}}
```

**为什么手动路由**：

- 逻辑清晰，可控
- 调试方便
- 客服大多数场景不需要 Agent 自动决策
- 复杂多轮/循环才用 LangGraph

---

### 8. 三层错误处理

**讲解**：  
真实业务里错误必须分层处理，不能让一处出错整条链 500。

| 层 | 职责 | 关键做法 |
|---|---|---|
| 工具层 | 不抛异常 | 返回 `success=False` + `error` |
| 路由层 | 容错取值 | 一律用 `.get()`，不用 `[]` |
| 接口层 | 兜底 | `try/except` + `traceback.print_exc()` |

**代码**：

```python
# 工具层：不抛异常
@tool
def query_order(order_id: int) -> dict:
    """根据订单号查询订单状态。"""
    try:
        if order_id == 99999:
            return {"success": False, "data": {}, "error": "订单不存在"}
        return {"success": True, "data": {...}, "error": None}
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


# 路由层：容错取值
def build_reply(result: dict) -> str:
    if not result.get("success"):
        return result.get("error", "服务暂时不可用")
    data = result.get("data", {})
    return f"订单状态：{data.get('status', '未知')}"


# 接口层：兜底
import traceback

@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        result = await full_chain.ainvoke({"question": req.message})
        return {"reply": build_reply(result)}
    except Exception as e:
        traceback.print_exc()
        return {"reply": "系统繁忙，请稍后再试"}
```

**关键字 / 导入包**：

- `try / except`
- `traceback.print_exc()`
- `result.get("success")`
- `result.get("data", {})`
- `data.get("status", "未知")`

**效果**：  
任何一层出错都不会 500，用户始终得到可读回复。

---

### 9. [] vs .get()：跨模块取值规则

**讲解**：  
跨模块传数据（工具返回、API 响应、路由中间结果），一律用 `.get()`。  
`[]` 只在确定 key 存在时用。

| 写法 | key 不存在时 | 何时用 |
|---|---|---|
| `d["key"]` | 抛 `KeyError` | 确定 key 存在 |
| `d.get("key")` | 返回 `None` | 不确定 key 存在 |
| `d.get("key", "默认值")` | 返回默认值 | 需要兜底 |

**嵌套取值**：

```python
refund_id = result.get("data", {}).get("refund_id", "未知")
```

**效果**：  
避免 `KeyError: 'refund_id'` 这类跨层崩溃。  
工具返回结构一变，消费方用 `.get()` 至少不会直接崩。

---

### 10. 集成到 chat 接口

**讲解**：  
把"意图识别 → 槽位兜底 → 路由 → 工具 → 回复"整条链接进 FastAPI。  
配合 SQLite 持久化和短期记忆。

**代码**：

```python
# app/api/chat.py
import traceback
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import ChatSession, Message
from app.llm.parsers import intent_chain, extract_order_id
from app.llm.router import router as intent_router

@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    try:
        # 1. 意图识别
        intent = await intent_chain.ainvoke({"question": req.message})

        # 2. 槽位兜底
        order_id = extract_order_id(req.message, intent.order_id)

        # 3. 路由
        result = await intent_router.ainvoke({
            "intent": intent.intent,
            "order_id": order_id,
            "question": req.message,
        })

        # 4. 组织回复
        reply = build_reply(result)

        # 5. 持久化
        # ...（省略建会话、存消息）

        return {"reply": reply}
    except Exception:
        traceback.print_exc()
        return {"reply": "系统繁忙，请稍后再试"}
```

**关键字 / 导入包**：

- `await chain.ainvoke(...)`
- `intent.order_id`
- `RunnableBranch`
- `traceback.print_exc()`

**效果**：  
一次请求完成意图识别、路由、工具调用、回复生成。三种意图全部跑通，边界错误不 500。

---

## 二、最终串联代码

```text
FastAPIProjectTestAi/
├── app/
│   ├── main.py
│   ├── api/
│   │   └── chat.py
│   ├── db/
│   │   ├── base.py / session.py / models.py / init_db.py
│   ├── cache/
│   │   └── memory_store.py
│   ├── services/
│   │   └── short_term_memory.py
│   └── llm/
│       ├── client.py       # get_llm()
│       ├── prompts.py      # Prompt 模板
│       ├── chains.py       # LCEL 链
│       ├── parsers.py      # Intent + intent_chain + extract_order_id
│       ├── tools.py        # query_order / create_refund
│       └── router.py       # RunnableBranch 意图路由
├── .env
├── smart_cs.db
└── requirements.txt
```

`app/llm/parsers.py`：

```python
import re
from typing import Literal
from pydantic import BaseModel, Field
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from app.llm.client import get_llm


class Intent(BaseModel):
    intent: Literal["refund", "order", "general"] = Field(
        ..., description="用户意图：refund=退款，order=查订单，general=其他"
    )
    order_id: int | None = Field(
        None, description="订单号，只有 order/refund 时有"
    )


parser = PydanticOutputParser(pydantic_object=Intent)

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是意图识别助手，只输出结构化结果。\n{format_instructions}"),
    ("human", "{question}"),
]).partial(format_instructions=parser.get_format_instructions())

intent_chain = prompt | get_llm() | parser


def extract_order_id(question: str, parsed_id: int | None) -> int | None:
    if parsed_id:
        return parsed_id
    match = re.search(r"\d{5,}", question)
    return int(match.group()) if match else None
```

`app/llm/tools.py`：

```python
from langchain_core.tools import tool


@tool
def query_order(order_id: int) -> dict:
    """根据订单号查询订单状态。"""
    try:
        if order_id == 99999:
            return {"success": False, "data": {}, "error": "订单不存在"}
        return {
            "success": True,
            "data": {"order_id": order_id, "status": "shipped"},
            "error": None,
        }
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}


@tool
def create_refund(order_id: int, reason: str = "用户申请") -> dict:
    """为指定订单创建退款申请。"""
    try:
        return {
            "success": True,
            "data": {"refund_id": f"R{order_id}", "status": "processing"},
            "error": None,
        }
    except Exception as e:
        return {"success": False, "data": {}, "error": str(e)}
```

`app/llm/router.py`：

```python
from langchain_core.runnables import RunnableBranch, RunnableLambda
from app.llm.tools import query_order, create_refund


def build_reply(result: dict) -> str:
    if not result.get("success"):
        return result.get("error", "服务暂时不可用")
    data = result.get("data", {})
    if "status" in data:
        return f"订单状态：{data['status']}"
    if "refund_id" in data:
        return f"退款已受理，退款单号：{data['refund_id']}"
    return "处理完成"


order_chain = RunnableLambda(
    lambda x: query_order.invoke({"order_id": x["order_id"]})
)
refund_chain = RunnableLambda(
    lambda x: create_refund.invoke({"order_id": x["order_id"]})
)
general_chain = RunnableLambda(
    lambda x: {"success": True, "data": {"status": "请描述您的问题"}, "error": None}
)

router = RunnableBranch(
    (lambda x: x["intent"] == "order", order_chain),
    (lambda x: x["intent"] == "refund", refund_chain),
    general_chain,
)
```

---

## 三、测试用例 `test_intent.py`

用 mock LLM 避免真调 API。

```python
import pytest
from unittest.mock import patch
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.llm.parsers import Intent, extract_order_id


# ==================== Intent 模型 ====================
def test_intent_literal_valid():
    i = Intent(intent="order", order_id=12345)
    assert i.intent == "order"
    assert i.order_id == 12345


def test_intent_literal_invalid():
    with pytest.raises(Exception):
        Intent(intent="unknown", order_id=None)


def test_intent_order_id_optional():
    i = Intent(intent="general")
    assert i.order_id is None


# ==================== 正则兜底 ====================
def test_extract_order_id_from_model():
    assert extract_order_id("随便说点什么", 12345) == 12345


def test_extract_order_id_from_regex():
    assert extract_order_id("查一下订单99999", None) == 99999


def test_extract_order_id_none():
    assert extract_order_id("你好", None) is None


# ==================== 工具返回结构 ====================
def test_query_order_success():
    from app.llm.tools import query_order
    r = query_order.invoke({"order_id": 12345})
    assert r["success"] is True
    assert r["data"]["status"] == "shipped"
    assert r["error"] is None


def test_query_order_not_found():
    from app.llm.tools import query_order
    r = query_order.invoke({"order_id": 99999})
    assert r["success"] is False
    assert r["error"] == "订单不存在"


def test_create_refund():
    from app.llm.tools import create_refund
    r = create_refund.invoke({"order_id": 12345})
    assert r["success"] is True
    assert r["data"]["refund_id"] == "R12345"


# ==================== 路由 ====================
def test_router_order():
    from app.llm.router import router, build_reply
    result = router.invoke({"intent": "order", "order_id": 12345, "question": ""})
    reply = build_reply(result)
    assert "shipped" in reply


def test_router_refund():
    from app.llm.router import router, build_reply
    result = router.invoke({"intent": "refund", "order_id": 12345, "question": ""})
    reply = build_reply(result)
    assert "R12345" in reply


def test_router_general():
    from app.llm.router import router, build_reply
    result = router.invoke({"intent": "general", "order_id": None, "question": ""})
    reply = build_reply(result)
    assert "请描述" in reply


# ==================== 错误处理 ====================
def test_build_reply_error():
    from app.llm.router import build_reply
    reply = build_reply({"success": False, "error": "订单不存在"})
    assert reply == "订单不存在"


def test_build_reply_missing_fields():
    from app.llm.router import build_reply
    # 不崩，走默认值
    reply = build_reply({})
    assert reply == "服务暂时不可用"


# ==================== 意图识别（mock LLM） ====================
def test_intent_chain_mock():
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import PydanticOutputParser

    fake = FakeListChatModel(responses=['{"intent": "order", "order_id": 12345}'])
    parser = PydanticOutputParser(pydantic_object=Intent)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "{format_instructions}"),
        ("human", "{question}"),
    ]).partial(format_instructions=parser.get_format_instructions())

    chain = prompt | fake | parser
    result = chain.invoke({"question": "查订单 12345"})
    assert result.intent == "order"
    assert result.order_id == 12345
```

运行：

```bash
pytest -q
```

---

## 四、总结串联关系

1. `parsers.py` 定义 `Intent`，`PydanticOutputParser` 强约束输出。
2. `intent_chain` 把"问题 → 结构化意图"跑通。
3. `extract_order_id` 用正则兜底槽位，模型漏抽时补上。
4. `tools.py` 用 `@tool` 定义 `query_order`、`create_refund`。
5. 工具统一返回 `{"success", "data", "error"}`，消费方永远知道怎么取。
6. `router.py` 用 `RunnableBranch` 按 `intent` 分流。
7. `build_reply` 用 `.get()` 容错，字段缺失不崩。
8. `chat.py` 用 `try/except + traceback` 兜底，接口永不 500。
9. 三层错误处理：工具不抛、路由容错、接口兜底。

**一句话串起来**：  
`Intent` 定义结构 → `PydanticOutputParser` 强约束 → `intent_chain` 识别意图 → 正则兜底槽位 → `RunnableBranch` 分流 → `@tool` 执行业务 → `.get()` 安全取值 → `try/except` 接口兜底。

这就是模块 2.4 ~ 2.5 的全部骨架。你的客服系统已经从"纯聊天"升级为"能识别意图、能调工具、能容错"的真实业务系统。下一步 2.6 流式输出 + LangSmith，就进入可观测和体验优化阶段。
