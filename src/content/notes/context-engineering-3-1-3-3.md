---
title: "上下文工程：历史注入与 Token 预算（模块 3.1~3.3）"
slug: context-engineering-3-1-3-3
category: "智能客服"
tags: [LLM, 上下文工程]
date: 2026-09-28
status: draft
summary: "上下文组成、优先级与裁剪策略：Token 不够时先砍谁"
source: "笔记/FastAPI/智能客服/上下文工程 3.1 ~ 3.3.md"
---
下面按你 FastAPI 知识点总结的格式，整理 **模块 3.1 ~ 3.3 上下文工程：历史注入 + Token 预算 + 裁剪**：  
**讲解 → 代码 → 关键字 / 导入包 → 效果**。最后串成项目关键文件和测试用例。

---

# 模块 3.1 ~ 3.3 上下文工程知识点整理

## 一、知识点整理

### 1. 上下文的组成与优先级

**讲解**：  
一次 LLM 调用的上下文不是只有当前问题。它由多部分组成，按顺序拼接：  
**系统提示 → 用户信息 → 历史对话 → 知识片段 → 当前问题**。  
Token 有限，砍的时候要有优先级，不能乱砍。

**上下文结构**：

```text
┌─────────────────────────────┐
│ 1. 系统提示（必须保留）      │
│ 2. 用户信息（VIP、语言等）   │
│ 3. 历史对话（近期优先）      │
│ 4. 知识片段（RAG 检索结果）  │
│ 5. 当前问题（必须保留）      │
└─────────────────────────────┘
```

**优先级（Token 不够先砍谁）**：

```text
系统提示 > 当前问题 > 近期历史 > 知识片段 > 远期历史
```

| 层级 | 是否可砍 | 理由 |
|---|---|---|
| 系统提示 | ❌ 不可砍 | 决定模型角色和行为 |
| 当前问题 | ❌ 不可砍 | 没它无法回答 |
| 近期历史 | ⚠️ 最后砍 | 多轮上下文的关键 |
| 知识片段 | ✅ 可砍 | 可从 RAG 重取 |
| 远期历史 | ✅ 先砍 | 信息价值最低 |

**关键字**：

- 系统提示、当前问题：硬约束
- 近期历史：软约束
- 远期历史、知识片段：可裁剪

**效果**：  
裁剪策略有据可依。不是简单截断，而是按业务优先级砍。

---

### 2. MessagesPlaceholder 注入历史

**讲解**：  
`ChatPromptTemplate` 支持用 `MessagesPlaceholder` 在指定位置插入消息列表。  
它让历史对话作为一组 `HumanMessage` / `AIMessage` 插入，而不是拼成字符串。

**代码**：

```python
# app/llm/prompts.py
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

CUSTOMER_SERVICE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "你是{company}的智能客服。"),
    MessagesPlaceholder(variable_name="history", optional=True),
    ("human", "{question}"),
])
```

**关键字 / 导入包**：

- `MessagesPlaceholder`：`from langchain_core.prompts import MessagesPlaceholder`
- `variable_name="history"`
- `optional=True`：历史可以为空

**效果**：  
调用时传 `history=[HumanMessage(...), AIMessage(...)]`，模板会把它们按顺序插入到 system 和 human 之间。  
不传或传空列表也不报错（`optional=True`）。

---

### 3. 消息类型转换：dict → LangChain Message

**讲解**：  
数据库里存的是 `{"role": "user", "content": "..."}` 这种 dict。  
LangChain 需要的是 `HumanMessage` / `AIMessage` 对象。要写一个转换函数。

**代码**：

```python
# app/llm/prompts.py
from langchain_core.messages import HumanMessage, AIMessage

def to_langchain_messages(history: list[dict]) -> list:
    """把数据库历史 dict 转成 LangChain 消息对象。"""
    messages = []
    for m in history:
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            messages.append(AIMessage(content=m["content"]))
    return messages
```

**关键字 / 导入包**：

- `HumanMessage` / `AIMessage`：`from langchain_core.messages import HumanMessage, AIMessage`
- `role` → 消息类型映射
- `content` → 消息内容

**效果**：  
数据库历史可以直接喂给 LLM。  
以后加 `system` 消息、`tool` 消息，只需在这里扩展分支。

---

### 4. tiktoken 自定义 Token 计数器

**讲解**：  
LangChain 的 `trim_messages` 需要 `token_counter`。  
默认它调用模型的 `get_num_tokens_from_messages()`，但 DeepSeek 没实现，会报 `NotImplementedError`。  
用 `tiktoken` 自己算，绕过模型限制。

**代码**：

```python
# app/llm/token_counter.py
import tiktoken
from langchain_core.messages import BaseMessage

ENCODER = tiktoken.get_encoding("cl100k_base")

def count_tokens(messages: list[BaseMessage]) -> int:
    """近似计算消息列表的 token 数。"""
    num_tokens = 0
    for msg in messages:
        num_tokens += len(ENCODER.encode(msg.content))
        num_tokens += 4   # 每条消息的角色、分隔符开销
    return num_tokens
```

**关键字 / 导入包**：

- `tiktoken`：`import tiktoken`
- `tiktoken.get_encoding("cl100k_base")`：GPT-4 / DeepSeek 近似编码
- `ENCODER.encode(text)`
- `BaseMessage`：`from langchain_core.messages import BaseMessage`
- `+4`：每条消息的角色、分隔符近似开销

**效果**：  
不依赖模型自身实现，任何模型都能用。  
近似准确，比 `len()` 按条数算靠谱。

**方案对比**：

| 方案 | 说明 |
|---|---|
| `tiktoken` | 推荐，近似准确、轻量 |
| `count_tokens_approximately` | LangChain 内置近似计数器 |
| `len` | 按条数算，不推荐 |
| HuggingFace | 精确但重 |

---

### 5. trim_messages：按 Token 预算裁剪

**讲解**：  
`trim_messages` 按 `max_tokens` 从历史里保留最近的消息。  
配合 `include_system=True` 保证系统提示不丢，`start_on="human"` 保证裁剪后第一条是用户消息（避免出现 AI 消息打头）。

**代码**：

```python
# app/llm/chains.py
from langchain_core.messages import trim_messages
from app.llm.token_counter import count_tokens

trimmer = trim_messages(
    max_tokens=2000,
    strategy="last",
    token_counter=count_tokens,
    include_system=True,
    allow_partial=False,
    start_on="human",
)
```

**参数详解**：

| 参数 | 作用 |
|---|---|
| `max_tokens` | 保留的最大 token 数 |
| `strategy="last"` | 保留最近消息 |
| `token_counter` | 自定义计数函数 |
| `include_system=True` | 保留系统提示 |
| `allow_partial=False` | 不裁半条消息 |
| `start_on="human"` | 裁剪后第一条必须是 human |

**关键字 / 导入包**：

- `trim_messages`：`from langchain_core.messages import trim_messages`
- 自定义 `token_counter`

**效果**：  
长历史自动裁到 2000 token 以内，系统提示保留，首条是用户消息。

**实测**：  
`[Trimmer] 裁剪前 102 条 → 裁剪后 34 条`，模型仍能引用关键信息（订单号 12345）。

---

### 6. 集成到 Chain：历史 + 裁剪 + 注入

**讲解**：  
把 `MessagesPlaceholder`、`to_langchain_messages`、`trimmer` 串到一条链里。  
注意顺序：**先取历史 → 再 append 当前消息 → 再调 LLM**。

**代码**：

```python
# app/llm/chains.py
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
from app.llm.client import get_llm
from app.llm.prompts import CUSTOMER_SERVICE_PROMPT, to_langchain_messages
from app.llm.token_counter import count_tokens
from langchain_core.messages import trim_messages

llm = get_llm()
parser = StrOutputParser()

trimmer = trim_messages(
    max_tokens=2000,
    strategy="last",
    token_counter=count_tokens,
    include_system=True,
    allow_partial=False,
    start_on="human",
)


def prepare_input(payload: dict) -> dict:
    """裁剪历史，转成 LangChain 消息，塞进 prompt 变量。"""
    history_msgs = to_langchain_messages(payload.get("history", []))
    trimmed = trimmer.invoke(history_msgs)
    print(f"[Trimmer] 裁剪前 {len(history_msgs)} 条 → 裁剪后 {len(trimmed)} 条")
    return {
        "company": payload.get("company", "某某科技"),
        "history": trimmed,
        "question": payload["question"],
    }


base_chain = (
    RunnableLambda(prepare_input)
    | CUSTOMER_SERVICE_PROMPT
    | llm
    | parser
)
```

**关键字 / 导入包**：

- `RunnableLambda`
- `trimmer.invoke(messages)`
- `MessagesPlaceholder` 变量 `history`
- `StrOutputParser`

**效果**：  
调用方只需传 `{"company": ..., "history": [...], "question": ...}`，链自动裁剪、注入、调用。

---

### 7. 集成到 chat 接口：顺序决定正确性

**讲解**：  
历史重复的坑就出在顺序。正确顺序是：  
**先取历史（不含当前消息）→ 再 append 当前消息 → 再调 LLM → 最后存助手消息**。

**代码**：

```python
# app/api/chat.py
@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    # 1. 找会话或新建
    session = await db.get(ChatSession, req.session_id) if req.session_id else None
    if not session:
        session = ChatSession(user_id=req.user_id, title="新对话")
        db.add(session)
        await db.commit()
        await db.refresh(session)

    # 2. 先取历史（此时不含当前消息）
    history = await get_recent_messages(session.id)

    # 3. 再存当前用户消息
    await append_message(session.id, "user", req.message)

    # 4. 调 LLM
    reply = await base_chain.ainvoke({
        "company": "某某科技",
        "history": history,
        "question": req.message,
    })

    # 5. 存助手消息
    await append_message(session.id, "assistant", reply)

    return {"session_id": session.id, "reply": reply}
```

**关键字 / 导入包**：

- `await get_recent_messages(session.id)`：取历史
- `await append_message(...)`：写消息
- `await base_chain.ainvoke({...})`

**效果**：  
历史里不会出现两条 `human: 你好`。  
模型能引用历史订单号，多轮对话连续。

**口诀**：先取历史，后加消息，再调 LLM。

---

### 8. 历史重复问题：根因与修复

**讲解**：  
如果先 append 当前消息，再取历史，历史里就包含了当前消息。  
加上 prompt 里又有 `("human", "{question}")`，就会出现两条相同用户消息。

**错误顺序**：

```python
# ❌ 先 append，后取历史
await append_message(session.id, "user", req.message)
history = await get_recent_messages(session.id)   # 已包含当前消息
reply = await chain.ainvoke({
    "history": to_langchain_messages(history),
    "question": req.message,   # 又出现一次
})
```

**正确顺序**：

```python
# ✅ 先取历史，后 append
history = await get_recent_messages(session.id)   # 不含当前消息
await append_message(session.id, "user", req.message)
reply = await chain.ainvoke({
    "history": to_langchain_messages(history),
    "question": req.message,
})
```

**关键字**：

- 顺序：取历史 → append → 调 LLM
- LangSmith 可验证：看 prompt 节点的 `history` 变量

**效果**：  
重复消失，历史长度正确，Token 不浪费。

---

### 9. 用 LangSmith 验证裁剪效果

**讲解**：  
LangSmith trace 里能直接看到 prompt 节点的 `history` 变量，裁剪前后条数、内容一目了然。  
调试上下文问题，别 print，用 trace。

**查看位置**：

```text
LangSmith → 项目 → 某次 trace → RunnableSequence 节点
→ Input 里找 history
→ 看条数和内容
```

**效果**：  
不用加日志，可视化看到：

- 裁剪前多少条
- 裁剪后多少条
- 系统提示是否保留
- 首条是不是 human

**关键字**：

- LangSmith trace
- prompt 节点 input
- history 变量

---

## 二、最终串联代码

```text
app/
├── llm/
│   ├── client.py          # get_llm()
│   ├── prompts.py         # ChatPromptTemplate + MessagesPlaceholder + to_langchain_messages
│   ├── token_counter.py   # tiktoken 自定义计数器
│   ├── chains.py          # prepare_input + trimmer + base_chain
│   ├── parsers.py         # Intent
│   ├── tools.py           # query_order / create_refund
│   └── router.py          # 意图路由
├── services/
│   └── short_term_memory.py
├── cache/
│   └── memory_store.py
└── api/
    └── chat.py            # 先取历史，后 append
```

`app/llm/token_counter.py`：

```python
import tiktoken
from langchain_core.messages import BaseMessage

ENCODER = tiktoken.get_encoding("cl100k_base")


def count_tokens(messages: list[BaseMessage]) -> int:
    num_tokens = 0
    for msg in messages:
        num_tokens += len(ENCODER.encode(msg.content))
        num_tokens += 4
    return num_tokens
```

`app/llm/prompts.py`：

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

CUSTOMER_SERVICE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "你是{company}的智能客服。"),
    MessagesPlaceholder(variable_name="history", optional=True),
    ("human", "{question}"),
])


def to_langchain_messages(history: list[dict]) -> list:
    messages = []
    for m in history:
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            messages.append(AIMessage(content=m["content"]))
    return messages
```

`app/llm/chains.py`：

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
from langchain_core.messages import trim_messages

from app.llm.client import get_llm
from app.llm.prompts import CUSTOMER_SERVICE_PROMPT, to_langchain_messages
from app.llm.token_counter import count_tokens

llm = get_llm()
parser = StrOutputParser()

trimmer = trim_messages(
    max_tokens=2000,
    strategy="last",
    token_counter=count_tokens,
    include_system=True,
    allow_partial=False,
    start_on="human",
)


def prepare_input(payload: dict) -> dict:
    history_msgs = to_langchain_messages(payload.get("history", []))
    trimmed = trimmer.invoke(history_msgs)
    print(f"[Trimmer] 裁剪前 {len(history_msgs)} 条 → 裁剪后 {len(trimmed)} 条")
    return {
        "company": payload.get("company", "某某科技"),
        "history": trimmed,
        "question": payload["question"],
    }


base_chain = (
    RunnableLambda(prepare_input)
    | CUSTOMER_SERVICE_PROMPT
    | llm
    | parser
)
```

`app/api/chat.py` 核心顺序：

```python
session = await get_or_create_session(db, req)
history = await get_recent_messages(session.id)          # 1. 先取历史
await append_message(session.id, "user", req.message)     # 2. 再存当前
reply = await base_chain.ainvoke({                        # 3. 再调 LLM
    "company": "某某科技",
    "history": history,
    "question": req.message,
})
await append_message(session.id, "assistant", reply)      # 4. 存回复
```

---

## 三、测试用例 `test_context.py`

```python
import pytest
from langchain_core.messages import HumanMessage, AIMessage

from app.llm.prompts import to_langchain_messages
from app.llm.token_counter import count_tokens
from app.llm.chains import trimmer


# ==================== 消息转换 ====================
def test_to_langchain_messages_user():
    history = [{"role": "user", "content": "你好"}]
    msgs = to_langchain_messages(history)
    assert len(msgs) == 1
    assert isinstance(msgs[0], HumanMessage)
    assert msgs[0].content == "你好"


def test_to_langchain_messages_mixed():
    history = [
        {"role": "user", "content": "你好"},
        {"role": "assistant", "content": "您好，有什么可以帮你？"},
    ]
    msgs = to_langchain_messages(history)
    assert len(msgs) == 2
    assert isinstance(msgs[0], HumanMessage)
    assert isinstance(msgs[1], AIMessage)


def test_to_langchain_messages_unknown_role():
    history = [{"role": "system", "content": "x"}]
    msgs = to_langchain_messages(history)
    assert msgs == []   # 未知角色被忽略


# ==================== Token 计数 ====================
def test_count_tokens_empty():
    assert count_tokens([]) == 0


def test_count_tokens_single():
    n = count_tokens([HumanMessage(content="你好")])
    assert n > 0


def test_count_tokens_more_messages():
    n1 = count_tokens([HumanMessage(content="你好")])
    n2 = count_tokens([
        HumanMessage(content="你好"),
        AIMessage(content="您好"),
    ])
    assert n2 > n1


# ==================== 裁剪 ====================
def test_trim_short_history_unchanged():
    history = [
        HumanMessage(content="你好"),
        AIMessage(content="您好"),
    ]
    trimmed = trimmer.invoke(history)
    assert len(trimmed) == 2


def test_trim_long_history_reduced():
    history = []
    for i in range(50):
        history.append(HumanMessage(content=f"问题 {i}"))
        history.append(AIMessage(content=f"回答 {i}"))

    trimmed = trimmer.invoke(history)
    assert len(trimmed) < len(history)
    # 首条必须是 human
    assert isinstance(trimmed[0], HumanMessage)


def test_trim_start_on_human():
    history = [
        AIMessage(content="我先说话"),
        HumanMessage(content="用户回复"),
        AIMessage(content="AI 再回复"),
    ]
    trimmed = trimmer.invoke(history)
    assert isinstance(trimmed[0], HumanMessage)


def test_trim_respects_max_tokens():
    history = []
    for i in range(200):
        history.append(HumanMessage(content="很长的消息" * 20))
        history.append(AIMessage(content="很长的回复" * 20))

    trimmed = trimmer.invoke(history)
    assert count_tokens(trimmed) <= 2000 + 100   # 留点余量
```

运行：

```bash
pytest tests/test_context.py -q
```

---

## 四、总结串联关系

1. 上下文按 **系统提示 → 用户信息 → 历史 → 知识 → 当前问题** 拼接。
2. 优先级决定裁剪顺序：**系统提示 > 当前问题 > 近期历史 > 知识 > 远期历史**。
3. `MessagesPlaceholder(variable_name="history")` 在 prompt 里预留历史位置。
4. `to_langchain_messages` 把数据库 dict 转成 `HumanMessage` / `AIMessage`。
5. `tiktoken` 自定义 `count_tokens`，绕过 DeepSeek 的 `NotImplementedError`。
6. `trim_messages` 按 `max_tokens` 裁剪，`include_system=True` 保系统提示，`start_on="human"` 保证首条为用户消息。
7. `prepare_input` 把"裁剪 → 转换 → 组装"串到链里。
8. 接口顺序必须 **先取历史 → 后 append → 再调 LLM**，否则历史重复。
9. LangSmith trace 里看 prompt 节点，直接验证裁剪效果。

**一句话串起来**：  
`MessagesPlaceholder` 预留位置 → `to_langchain_messages` 转换格式 → `tiktoken` 计数 → `trim_messages` 按预算裁剪 → `prepare_input` 组装 → 接口先取历史再 append → LangSmith 验证效果。

这就是模块 3.1 ~ 3.3 的全部骨架。下一步 3.4 会话摘要会在裁剪基础上再加一层"LLM 压缩"，处理超长对话。
