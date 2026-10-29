---
title: "LangChain 核心（模块 2.1~2.3）"
slug: langchain-2-1-2-3
category: "智能客服"
tags: [LangChain, LLM]
date: 2026-09-26
status: draft
summary: "模型初始化统一封装等 LangChain 核心知识点的讲解与代码"
source: "笔记/FastAPI/智能客服/LangChain 2.1 ~ 2.3.md"
---
下面按你 FastAPI 知识点总结的格式，整理 **模块 2.1 ~ 2.3 LangChain 核心**：  
**讲解 → 代码 → 关键字 / 导入包 → 效果**。最后串成项目关键文件和测试用例。

---

# 模块 2 LangChain 核心知识点整理

## 一、知识点整理

### 1. 模型初始化统一封装

**讲解**：  
不要把 API Key、base_url、模型名散落在业务代码里。封装 `get_llm(provider=None)`，根据 provider 返回不同配置的 `ChatOpenAI`。换模型只改 `.env`，代码不动。

**代码**：

```python
# app/llm/client.py
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()


def get_llm(provider: str | None = None) -> ChatOpenAI:
    provider = provider or os.getenv("LLM_PROVIDER", "deepseek")

    if provider == "deepseek":
        return ChatOpenAI(
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com/v1",
            temperature=0.3,
            timeout=30,
        )

    if provider == "siliconflow":
        return ChatOpenAI(
            model=os.getenv("SILICONFLOW_MODEL", "Qwen/Qwen2.5-7B-Instruct"),
            api_key=os.getenv("SILICONFLOW_API_KEY"),
            base_url="https://api.siliconflow.cn/v1",
            temperature=0.3,
            timeout=30,
        )

    raise ValueError(f"未知 provider: {provider}")
```

`.env`：

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat
```

**关键字 / 导入包**：

- `ChatOpenAI`：`from langchain_openai import ChatOpenAI`
- `load_dotenv`：`from dotenv import load_dotenv`
- `os.getenv`
- `base_url` / `api_key` / `model` / `temperature` / `timeout`

**效果**：  
业务代码只调 `get_llm()`，不关心底层是哪家模型。切 provider 只改 `.env`。

---

### 2. Prompt 模板：ChatPromptTemplate

**讲解**：  
用 `ChatPromptTemplate.from_messages` 定义 system + human 消息。  
模板里用 `{变量名}` 占位，`invoke` 时传值填充。

**代码**：

```python
# app/llm/prompts.py
from langchain_core.prompts import ChatPromptTemplate

CUSTOMER_SERVICE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "你是{company}的智能客服，回答要简洁、礼貌。"),
    ("human", "{question}"),
])
```

**关键字 / 导入包**：

- `ChatPromptTemplate`：`from langchain_core.prompts import ChatPromptTemplate`
- `from_messages`
- `("system", "...")` / `("human", "...")`
- `{company}` / `{question}`

**效果**：  
Prompt 变成可复用模板，不用每次手拼字符串。

---

### 3. partial：全局固定变量

**讲解**：  
有些变量对所有请求都一样，比如公司名。用 `partial` 预先绑定，避免每次 `invoke` 都传。

**代码**：

```python
base_prompt = CUSTOMER_SERVICE_PROMPT.partial(company="某某科技")

# 每次只需传 question
messages = base_prompt.invoke({"question": "你们几点上班？"})
```

**关键字 / 导入包**：

- `prompt.partial(...)`

**效果**：  
`company` 固定进模板，`question` 每次传。

**判断标准**：

- 全局固定 → `partial`
- 每次不同 → `invoke` 时传

`user_name` 不能写死进 partial，否则所有人都是张三。

---

### 4. LCEL 管道：prompt | llm | parser

**讲解**：  
LCEL 用 `|` 把多个 `Runnable` 串起来。前一个输出给后一个。  
`StrOutputParser` 把 `AIMessage` 转成 `str`。

**代码**：

```python
# app/llm/chains.py
from langchain_core.output_parsers import StrOutputParser
from app.llm.client import get_llm
from app.llm.prompts import CUSTOMER_SERVICE_PROMPT

parser = StrOutputParser()
llm = get_llm()

base_chain = CUSTOMER_SERVICE_PROMPT | llm | parser

result = base_chain.invoke({
    "company": "某某科技",
    "question": "你好",
})
# result 是 str
```

**关键字 / 导入包**：

- `StrOutputParser`：`from langchain_core.output_parsers import StrOutputParser`
- `|` 管道运算符
- `chain.invoke({...})`

**效果**：  
一次调用完成“填模板 → 调模型 → 转字符串”。不用手动 `.content`。

---

### 5. 四种调用方式

**讲解**：  
LCEL 链统一支持同步 / 异步 / 单条 / 批量 / 流式。

**代码**：

```python
# 单条
result = base_chain.invoke({"company": "某某科技", "question": "你好"})

# 批量
results = base_chain.batch([
    {"company": "某某科技", "question": "你好"},
    {"company": "某某科技", "question": "退款要多久"},
])
# results 是 list[str]

# 流式
for chunk in base_chain.stream({"company": "某某科技", "question": "你好"}):
    print(chunk, end="", flush=True)

# 异步
result = await base_chain.ainvoke({"company": "某某科技", "question": "你好"})
```

**关键字 / 导入包**：

- `invoke` / `batch` / `stream`
- `ainvoke` / `abatch` / `astream`

**效果**：

| 方法 | 用途 |
|---|---|
| `invoke` | 单条 |
| `batch` | 批量，返回列表 |
| `stream` | 流式，逐字输出 |
| `ainvoke` / `astream` | 异步版，FastAPI 用 |

**坑**：`batch` 返回列表，不能直接 `.content`。链末尾加 `StrOutputParser` 后直接是 `list[str]`。

---

### 6. RunnableLambda：把普通函数接进链

**讲解**：  
链里每一步都是 `Runnable`，普通函数不是。用 `RunnableLambda` 包一层。

**代码**：

```python
from langchain_core.runnables import RunnableLambda

def add_prefix(text: str) -> str:
    return f"【客服回复】{text}"

chain = base_chain | RunnableLambda(add_prefix)
```

**数据流**：

```text
prompt 输出 → llm 输出 → parser 输出 str → add_prefix 收到 str → 返回加了前缀的 str
```

**关键字 / 导入包**：

- `RunnableLambda`：`from langchain_core.runnables import RunnableLambda`

**效果**：  
普通函数可以接入 LCEL 链。  
智能客服里用于：回复后处理、脱敏、格式化、日志、敏感词检测。

**记忆口诀**：Lambda → 加工。

---

### 7. RunnableParallel：同时跑多个链

**讲解**：  
一次请求要同时做几件事，比如既生成回复又统计长度。  
`RunnableParallel` 接收 dict，每个 value 是一条链，输出也是 dict。

**代码**：

```python
from langchain_core.runnables import RunnableParallel, RunnableLambda

chain = RunnableParallel({
    "reply": base_chain,
    "length": base_chain | RunnableLambda(len),
})

result = chain.invoke({"company": "某某科技", "question": "你好"})
# {"reply": "...", "length": 12}
```

**数据流**：

```text
输入 {"company": "...", "question": "你好"}
   ├── 分支1：prompt → llm → parser → reply
   └── 分支2：prompt → llm → parser → len → length
输出 {"reply": "...", "length": 12}
```

**优化**：上面 `base_chain` 被用了两次，LLM 会被调两次。想只调一次：

```python
from langchain_core.runnables import RunnablePassthrough

chain = base_chain | RunnableParallel({
    "reply": RunnablePassthrough(),
    "length": RunnableLambda(len),
})
```

**关键字 / 导入包**：

- `RunnableParallel` / `RunnablePassthrough`：`from langchain_core.runnables import ...`
- `RunnableLambda(len)`

**效果**：  
一份输入，多路输出，打包成字典。  
智能客服里用于：同时生成回复和意图分类、同时查订单和物流、同时做风险检测。

**注意**：同步 `invoke` 是顺序执行，异步 `ainvoke` 才是真并行。

**记忆口诀**：Parallel → 分头做。

---

### 8. RunnableBranch：条件分支

**讲解**：  
不同问题走不同链，类似 if-elif-else。  
每个条件是 `(判断函数, 链)` 元组，最后一个参数是默认链。

**代码**：

```python
from langchain_core.runnables import RunnableBranch

refund_chain = ChatPromptTemplate.from_messages([
    ("system", "你是退款专员，只回答退款问题。"),
    ("human", "{question}"),
]) | llm | parser

order_chain = ChatPromptTemplate.from_messages([
    ("system", "你是订单专员，只回答订单问题。"),
    ("human", "{question}"),
]) | llm | parser

default_chain = ChatPromptTemplate.from_messages([
    ("system", "你是通用客服。"),
    ("human", "{question}"),
]) | llm | parser

router_chain = RunnableBranch(
    (lambda x: "退款" in x["question"], refund_chain),
    (lambda x: "订单" in x["question"], order_chain),
    default_chain,
)

result = router_chain.invoke({"question": "退款要多久？"})
```

**执行逻辑**：

```text
输入 {"question": "退款要多久？"}
  → 条件1："退款" in question？是 → refund_chain
  → 否则条件2："订单" in question？是 → order_chain
  → 都不满足 → default_chain
```

**关键字 / 导入包**：

- `RunnableBranch`：`from langchain_core.runnables import RunnableBranch`
- 条件元组 `(判断函数, 链)`
- 最后一项是默认链，不套元组

**效果**：  
按条件选链执行。  
智能客服里用于：意图路由、VIP 路由、多语言路由。

**注意**：`RunnableBranch` 只适合简单条件。复杂路由（多轮、有状态、循环）用 LangGraph。它就是 LangGraph 条件路由的简化版。

**记忆口诀**：Branch → 选一条路。

---

### 9. 三种组合方式对比

| 方式 | 作用 | 输入输出 |
|---|---|---|
| `RunnableLambda` | 把普通函数接进链 | 输入上一步输出，返回处理结果 |
| `RunnableParallel` | 并行跑多个链 | 输入一份，输出字典 |
| `RunnableBranch` | 条件分支 | 输入一份，输出选中链的结果 |

**记忆口诀**：

- Lambda → 加工
- Parallel → 分头做
- Branch → 选一条路

---

### 10. 集成到 FastAPI

**讲解**：  
在 `/chat` 路由里用 `await chain.ainvoke(...)`，异步不阻塞事件循环。  
短期记忆从 `ShortTermMemory` 取，拼进 prompt。

**代码**：

```python
# app/api/chat.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import ChatSession, Message
from app.llm.chains import base_chain
from app.services.short_term_memory import ShortTermMemory
from app.cache.memory_store import MemoryStore

router = APIRouter()
memory = ShortTermMemory(MemoryStore())


class ChatRequest(BaseModel):
    user_id: int
    session_id: int | None = None
    message: str


class ChatResponse(BaseModel):
    session_id: int
    reply: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    # 1. 找会话或新建
    session = await db.get(ChatSession, req.session_id) if req.session_id else None
    if not session:
        session = ChatSession(user_id=req.user_id, title="新对话")
        db.add(session)
        await db.commit()
        await db.refresh(session)

    # 2. 存用户消息
    db.add(Message(session_id=session.id, role="user", content=req.message))
    await db.commit()

    # 3. 调 LLM
    reply = await base_chain.ainvoke({
        "company": "某某科技",
        "question": req.message,
    })

    # 4. 存 AI 消息 + 写短期记忆
    db.add(Message(session_id=session.id, role="assistant", content=reply))
    await db.commit()
    await memory.append(session.id, "user", req.message)
    await memory.append(session.id, "assistant", reply)

    return {"session_id": session.id, "reply": reply}
```

**关键字 / 导入包**：

- `await chain.ainvoke(...)`
- `Depends(get_db)`
- `ShortTermMemory`
- `response_model=ChatResponse`

**效果**：  
`/chat` 接口接入真实 LLM，消息持久化到 SQLite，短期记忆写内存 store。

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
│       ├── __init__.py
│       ├── client.py       # get_llm()
│       ├── prompts.py      # ChatPromptTemplate
│       └── chains.py       # LCEL 链 + Runnable*
├── .env
├── smart_cs.db
└── requirements.txt
```

`app/llm/chains.py` 完整版：

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import (
    RunnableLambda,
    RunnableParallel,
    RunnableBranch,
    RunnablePassthrough,
)
from langchain_core.prompts import ChatPromptTemplate

from app.llm.client import get_llm
from app.llm.prompts import CUSTOMER_SERVICE_PROMPT

llm = get_llm()
parser = StrOutputParser()

base_chain = CUSTOMER_SERVICE_PROMPT | llm | parser


def add_prefix(text: str) -> str:
    return f"【客服回复】{text}"


after_chain = base_chain | RunnableLambda(add_prefix)


parallel_chain = base_chain | RunnableParallel({
    "reply": RunnablePassthrough(),
    "length": RunnableLambda(len),
})


refund_chain = ChatPromptTemplate.from_messages([
    ("system", "你是退款专员，只回答退款问题。"),
    ("human", "{question}"),
]) | llm | parser

order_chain = ChatPromptTemplate.from_messages([
    ("system", "你是订单专员，只回答订单问题。"),
    ("human", "{question}"),
]) | llm | parser

default_chain = CUSTOMER_SERVICE_PROMPT | llm | parser

router_chain = RunnableBranch(
    (lambda x: "退款" in x["question"], refund_chain),
    (lambda x: "订单" in x["question"], order_chain),
    default_chain,
)
```

---

## 三、测试用例 `test_llm.py`

需要 mock LLM，避免测试真的调 API。

```python
# tests/test_llm.py
import pytest
from unittest.mock import patch
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import (
    RunnableLambda,
    RunnableParallel,
    RunnableBranch,
    RunnablePassthrough,
)


@pytest.fixture
def fake_llm():
    return FakeListChatModel(responses=["你好，有什么可以帮你？"])


def test_lcel_basic(fake_llm):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是{company}的客服"),
        ("human", "{question}"),
    ])
    chain = prompt | fake_llm | StrOutputParser()

    result = chain.invoke({"company": "某某科技", "question": "你好"})
    assert isinstance(result, str)
    assert "你好" in result


def test_partial(fake_llm):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是{company}的客服"),
        ("human", "{question}"),
    ]).partial(company="某某科技")

    chain = prompt | fake_llm | StrOutputParser()
    result = chain.invoke({"question": "你好"})
    assert isinstance(result, str)


def test_batch_returns_list(fake_llm):
    prompt = ChatPromptTemplate.from_messages([("human", "{question}")])
    chain = prompt | fake_llm | StrOutputParser()

    results = chain.batch([
        {"question": "a"},
        {"question": "b"},
    ])
    assert isinstance(results, list)
    assert all(isinstance(r, str) for r in results)


def test_runnable_lambda(fake_llm):
    prompt = ChatPromptTemplate.from_messages([("human", "{question}")])
    chain = prompt | fake_llm | StrOutputParser() | RunnableLambda(
        lambda s: f"【客服回复】{s}"
    )
    result = chain.invoke({"question": "你好"})
    assert result.startswith("【客服回复】")


def test_runnable_parallel(fake_llm):
    prompt = ChatPromptTemplate.from_messages([("human", "{question}")])
    base = prompt | fake_llm | StrOutputParser()
    chain = base | RunnableParallel({
        "reply": RunnablePassthrough(),
        "length": RunnableLambda(len),
    })
    result = chain.invoke({"question": "你好"})
    assert set(result.keys()) == {"reply", "length"}
    assert result["length"] == len(result["reply"])


def test_runnable_branch_refund(fake_llm):
    refund = ChatPromptTemplate.from_messages([
        ("system", "退款专员"),
        ("human", "{question}"),
    ]) | fake_llm | StrOutputParser()

    order = ChatPromptTemplate.from_messages([
        ("system", "订单专员"),
        ("human", "{question}"),
    ]) | fake_llm | StrOutputParser()

    default = ChatPromptTemplate.from_messages([
        ("system", "通用客服"),
        ("human", "{question}"),
    ]) | fake_llm | StrOutputParser()

    router = RunnableBranch(
        (lambda x: "退款" in x["question"], refund),
        (lambda x: "订单" in x["question"], order),
        default,
    )

    r1 = router.invoke({"question": "退款要多久？"})
    r2 = router.invoke({"question": "订单到哪了？"})
    r3 = router.invoke({"question": "你们几点上班？"})

    assert isinstance(r1, str)
    assert isinstance(r2, str)
    assert isinstance(r3, str)


def test_branch_default(fake_llm):
    default = ChatPromptTemplate.from_messages([
        ("system", "通用客服"),
        ("human", "{question}"),
    ]) | fake_llm | StrOutputParser()

    router = RunnableBranch(
        (lambda x: "退款" in x["question"], default),
        default,
    )
    result = router.invoke({"question": "你好"})
    assert isinstance(result, str)
```

运行：

```bash
pytest -q
```

---

## 四、总结串联关系

1. `client.py` 统一封装 `get_llm()`，换模型只改 `.env`。
2. `prompts.py` 用 `ChatPromptTemplate` 定义模板，`partial` 固定全局变量。
3. `chains.py` 用 `|` 串起 `prompt | llm | parser`，得到 `base_chain`。
4. 用 `RunnableLambda` 做回复后处理（加前缀、脱敏、日志）。
5. 用 `RunnableParallel` 一份输入跑多路（回复 + 长度 + 意图）。
6. 用 `RunnableBranch` 按条件选链（退款 / 订单 / 默认）。
7. `chat.py` 用 `await chain.ainvoke(...)` 接入 FastAPI，异步不阻塞。
8. 短期记忆从 `ShortTermMemory` 取，后续拼进 prompt 做多轮上下文。

**一句话串起来**：  
`get_llm` 提供模型 → `prompt` 定义输入 → `|` 串成链 → `Runnable*` 加工、分叉、路由 → `ainvoke` 接入 FastAPI → 短期记忆补上下文。

这就是模块 2.1 ~ 2.3 的全部骨架，也是模块 2.4 输出解析器和模块 6 LangGraph 的地基。
