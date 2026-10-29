---
title: "上下文工程：会话摘要（模块 3.4）"
slug: context-engineering-3-4
category: "智能客服"
tags: [LLM, 上下文工程]
date: 2026-09-29
status: published
summary: "会话摘要的定位、触发策略与递归压缩实现"
source: "笔记/FastAPI/智能客服/上下文工程 3.4.md"
---
下面按你 FastAPI 知识点总结的格式，整理 **模块 3.4 会话摘要**：  
**讲解 → 代码 → 关键字 / 导入包 → 效果**。然后单独整理踩坑点、集成与注意事项。最后串成项目关键文件和测试用例。

---

# 模块 3.4 会话摘要知识点整理

## 一、核心知识点

### 1. 会话摘要的定位

**讲解**：  
历史太长（30 轮以上）会导致两个问题：

- Token 超限，成本高
- 直接裁剪会丢早期关键信息（订单号、诉求、已处理事项）

摘要解决的是 **"压缩旧历史，保留关键信息"** 的问题。

**解决方案**：

```text
旧历史（前 N 轮）→ LLM 压缩成摘要（200 字内）
最近历史（后 N 轮）→ 保留原文
最终上下文 = 系统提示 + 摘要 + 最近 N 轮 + 当前问题
```

**效果**：

| 方式 | 优点 | 缺点 | 适用 |
|---|---|---|---|
| 裁剪 | 简单、快 | 丢信息 | 历史短、信息密度低 |
| 摘要 | 保留关键信息 | 多一次 LLM 调用，慢、贵 | 历史长、信息密集 |

**推荐组合**：最近 N 轮保留原文，更早历史摘要，超长摘要递归压缩。

---

### 2. 摘要触发策略

**讲解**：  
不能每轮都摘要，否则成本和延迟都受不了。  
设定阈值，超过才触发，且只摘要"旧历史"，最近 N 条保留原文。

**代码**：

```python
SUMMARY_TRIGGER = 20   # 历史超过 20 条触发
KEEP_RECENT = 10       # 保留最近 10 条原文


async def maybe_summarize(session, history_raw, db):
    if len(history_raw) > SUMMARY_TRIGGER:
        old = history_raw[:-KEEP_RECENT]        # 除最近 10 条外的旧历史
        recent = history_raw[-KEEP_RECENT:]     # 最近 10 条
        new_summary = await summarize_history(old)
        session.summary = new_summary
        await db.commit()
        return recent
    return history_raw
```

**关键字 / 导入包**：

- `SUMMARY_TRIGGER` / `KEEP_RECENT`
- 切片 `history_raw[:-KEEP_RECENT]` / `history_raw[-KEEP_RECENT:]`
- `session.summary = new_summary`
- `await db.commit()`

**效果**：

```text
历史 25 条 → 超过 20 → 旧 15 条摘要，最近 10 条保留
历史 15 条 → 未超过 → 全部保留
```

**规则**：

- `SUMMARY_TRIGGER` 别设太小（如 10），频繁触发反而贵
- `KEEP_RECENT` 保证最近对话原文，关键细节不丢

---

### 3. 摘要链：summarize_history

**讲解**：  
用一条独立 LCEL 链把旧对话压缩成摘要。  
提示词必须明确"保留什么、丢弃什么"，并限制字数。

**代码**：

```python
# app/llm/summary.py
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.llm.client import get_llm

SUMMARY_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "请把下面的客服对话压缩成一段简洁的摘要。\n"
     "要求：\n"
     "1. 保留关键信息：订单号、用户诉求、已处理事项、未解决问题\n"
     "2. 丢弃寒暄、重复内容\n"
     "3. 用第三人称，200 字以内\n"
     "4. 只输出摘要，不要其他内容"),
    ("human", "{conversation}"),
])

summary_chain = SUMMARY_PROMPT | get_llm() | StrOutputParser()


async def summarize_history(messages: list[dict]) -> str:
    if not messages:
        return ""
    conversation = "\n".join(
        f"{m['role']}: {m['content']}" for m in messages
    )
    return await summary_chain.ainvoke({"conversation": conversation})
```

**关键字 / 导入包**：

- `ChatPromptTemplate.from_messages`
- `StrOutputParser`
- `await summary_chain.ainvoke(...)`
- `if not messages: return ""` 兜底

**效果**：  
旧历史被压缩成一段摘要，关键信息保留，寒暄丢弃。  
空历史返回空字符串，不调 LLM，不浪费 token。

---

### 4. 摘要存储：数据库持久化

**讲解**：  
摘要代表"过去发生过什么"，重启后仍要保留，所以存数据库，不存内存。  
内存 TTL 到期就丢，无法跨会话恢复。

**代码**：

```python
# app/db/models.py
from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(100), default="新对话")
    summary: Mapped[str | None] = mapped_column(Text, default=None)
```

**关键字 / 导入包**：

- `Text`
- `Mapped[str | None]`
- `default=None`

**效果**：  
每个会话有一条摘要字段，新会话为 `None`，摘要后写入。  
下次请求直接读 `session.summary`，不用重算。

**为什么不用内存**：

| 存储 | 是否合适 | 理由 |
|---|---|---|
| 数据库 | ✅ | 持久、可查询、跨重启 |
| 内存 | ❌ | TTL 到期丢失，无法恢复 |

---

### 5. Prompt 支持摘要

**讲解**：  
在 prompt 里加一条 system 消息专门放摘要，位置在系统提示之后、历史之前。  
渲染后模型能看到"之前发生过什么"。

**代码**：

```python
# app/llm/prompts.py
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

CUSTOMER_SERVICE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "你是{company}的智能客服助手，语气友好专业。"),
    ("system", "历史摘要：{summary}"),
    MessagesPlaceholder(variable_name="history", optional=True),
    ("human", "{question}"),
])
```

**渲染后**：

```text
system: 你是某某科技的智能客服助手
system: 历史摘要：用户曾咨询订单12345，要求退款...
human: 你好
ai: 您好，有什么可以帮您？
human: 退款到账了吗？
```

**关键字 / 导入包**：

- 多条 `("system", "...")`
- `MessagesPlaceholder(variable_name="history", optional=True)`
- `{summary}` 变量

**效果**：  
模型既知道摘要（远期），也知道最近原文（近期），上下文完整。

---

### 6. 摘要触发时的历史顺序

**讲解**：  
摘要和 append 的顺序错了，会把刚发的消息也摘要进去。  
正确顺序：**先取历史 → 判断摘要 → 组合上下文 → 调 LLM → 最后 append**。

**代码**：

```python
# app/api/chat.py
@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    session = await get_or_create_session(db, req)

    # 1. 先取历史（不含当前消息）
    history_raw = await get_recent_messages(session.id)

    # 2. 判断摘要
    if len(history_raw) > SUMMARY_TRIGGER:
        old = history_raw[:-KEEP_RECENT]
        recent = history_raw[-KEEP_RECENT:]
        new_summary = await summarize_history(old)
        session.summary = new_summary
        await db.commit()
        history_raw = recent

    # 3. 组合上下文
    history = to_langchain_messages(history_raw)

    # 4. 调 LLM
    reply = await base_chain.ainvoke({
        "company": "某某科技",
        "summary": session.summary or "无",
        "history": history,
        "question": req.message,
    })

    # 5. 最后才 append
    await append_message(session.id, "user", req.message)
    await append_message(session.id, "assistant", reply)

    return {"session_id": session.id, "reply": reply}
```

**关键字 / 导入包**：

- `get_recent_messages` → `summarize_history` → `base_chain.ainvoke` → `append_message`
- `session.summary or "无"` 兜底

**效果**：  
当前消息不会被摘要，历史不重复，上下文正确。

**口诀**：先取历史，判断摘要，再调 LLM，最后 append。

---

## 二、踩坑点知识

### 坑 1：summary 为 None 时 Prompt 报错

**现象**：

```text
KeyError: 'summary'
```

**原因**：  
新会话没有摘要，`{summary}` 无法渲染。`ChatPromptTemplate` 的变量必须有值。

**解决**：  
在 Chain 入口做兜底。

```python
from langchain_core.runnables import RunnableLambda

def prepare_input(x: dict) -> dict:
    return {**x, "summary": x.get("summary") or "无"}

chain = RunnableLambda(prepare_input) | prompt | llm | parser
```

**教训**：  
带可选变量的 Prompt，入口做 `.get()` + 默认值兜底。

**关键字**：

- `x.get("summary") or "无"`
- `RunnableLambda(prepare_input)`

---

### 坑 2：数据库加字段后忘记重建

**现象**：

```text
sqlite3.OperationalError: no such column: chat_sessions.summary
```

**原因**：  
SQLite 表结构已固定，`create_all` 不会改已有表。

**解决**：  
开发阶段直接删库重建。

```bash
del smart_cs.db
python -m app.db.init_db
```

**教训**：

- 开发阶段：删库重建，最省事
- 生产阶段：用 Alembic 做迁移，不能删库

**关键字**：

- `Base.metadata.create_all` 只建不改
- `del smart_cs.db` + `python -m app.db.init_db`

---

### 坑 3：摘要触发时历史顺序容易乱

**现象**：  
先 append 当前消息再判断摘要，把刚发的消息也摘要了。

**原因**：  
顺序错了，`history_raw` 包含了当前消息。

**解决**：  
正确顺序。

```python
# 1. 先取历史
history_raw = await get_recent_messages(session.id)

# 2. 判断摘要
if len(history_raw) > SUMMARY_TRIGGER:
    ...
    history_raw = recent

# 3. 组合上下文
history = to_langchain_messages(history_raw)

# 4. 调 LLM
reply = await chain.ainvoke({...})

# 5. 最后才 append
await append_message(...)
```

**教训**：  
和上一课一样，**先取历史，后 append**，顺序不能乱。

---

### 坑 4：摘要本身也消耗 Token 和时间

**现象**：  
摘要一次，多一次 LLM 调用，慢 1-2 秒，消耗 token。

**原因**：  
摘要不是免费的，它是额外的 LLM 调用。

**优化方向**：

| 方向 | 说明 |
|---|---|
| 调大 `SUMMARY_TRIGGER` | 别频繁触发 |
| 异步摘要 | 后台任务做，不阻塞用户回复 |
| 用小模型 | 摘要用便宜的小模型 |
| 缓存摘要 | 同一段历史只摘要一次 |

**教训**：  
摘要成本要算进系统预算。

---

### 坑 5：切片边界容易出错

**现象**：

```python
old = history_raw[:-KEEP_RECENT]    # 如果历史刚好 10 条，old 为空
recent = history_raw[-KEEP_RECENT:]  # 如果历史不足 10 条，全部
```

**注意**：

- 历史为空时，切片不报错但结果为空
- 摘要前加 `if not messages: return ""` 兜底

**解决**：

```python
async def summarize_history(messages: list[dict]) -> str:
    if not messages:
        return ""
    ...
```

**教训**：  
切片前先判断长度，空列表要兜底。

---

## 三、集成知识点与注意事项

### 1. 完整数据流

**讲解**：  
集成后，一次请求的数据流如下。

```text
用户发消息
  → 取历史（不含当前消息）
  → 判断是否超阈值
      → 超：旧历史摘要存库，history_raw = 最近 10 条
      → 未超：全用
  → 组合上下文：company + summary + history + question
  → 调 LLM
  → 存消息（数据库 + 内存）
  → 返回回复
```

**代码**：

```python
@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    session = await get_or_create_session(db, req)

    history_raw = await get_recent_messages(session.id)

    if len(history_raw) > SUMMARY_TRIGGER:
        old = history_raw[:-KEEP_RECENT]
        recent = history_raw[-KEEP_RECENT:]
        session.summary = await summarize_history(old)
        await db.commit()
        history_raw = recent

    reply = await base_chain.ainvoke({
        "company": "某某科技",
        "summary": session.summary or "无",
        "history": to_langchain_messages(history_raw),
        "question": req.message,
    })

    await append_message(session.id, "user", req.message)
    await append_message(session.id, "assistant", reply)

    return {"session_id": session.id, "reply": reply}
```

**关键字 / 导入包**：

- `get_or_create_session`
- `get_recent_messages`
- `summarize_history`
- `base_chain.ainvoke`
- `append_message`

**效果**：  
一次请求完成"取历史 → 摘要 → 组合 → 调 LLM → 存消息"。历史超长自动压缩，最近对话保留原文。

---

### 2. 顺序规则

**讲解**：  
整个流程有一条铁律：**先取历史，后 append**。  
摘要逻辑必须放在取历史和调 LLM 之间。

**正确顺序**：

```text
1. get_recent_messages       ← 取历史
2. 判断摘要 + summarize       ← 压缩旧历史
3. to_langchain_messages     ← 转换格式
4. base_chain.ainvoke        ← 调 LLM
5. append_message            ← 存消息
```

**错误顺序**：

```text
1. append_message            ← 先存了
2. get_recent_messages       ← 历史里包含当前消息
3. base_chain.ainvoke        ← prompt 里又出现一次
```

**效果**：  
顺序对了，历史不重复，摘要不包含当前消息。

---

### 3. 兜底策略

**讲解**：  
摘要涉及多个可选值，每处都要兜底。

| 位置 | 兜底 |
|---|---|
| `session.summary` | `or "无"` |
| `summarize_history([])` | `return ""` |
| `history_raw` 为空 | `to_langchain_messages` 返回 `[]` |
| `SUMMARY_TRIGGER` 未触发 | 直接用全部历史 |

**代码**：

```python
"summary": session.summary or "无"
```

```python
async def summarize_history(messages: list[dict]) -> str:
    if not messages:
        return ""
    ...
```

**效果**：  
任何边界情况都不崩，新会话、空历史、未触发摘要都能正常走。

---

### 4. 成本与性能

**讲解**：  
摘要不是免费的，要权衡触发频率和模型选择。

| 项 | 建议 |
|---|---|
| `SUMMARY_TRIGGER` | 20 条左右，别太小 |
| `KEEP_RECENT` | 10 条左右，保留近期原文 |
| 摘要模型 | 可用便宜的小模型 |
| 摘要方式 | 可异步，不阻塞用户回复 |
| 摘要长度 | 200 字以内，控制 token |

**效果**：  
摘要成本可控，用户感知延迟低。

---

### 5. LangSmith 验证

**讲解**：  
LangSmith trace 里能看到摘要节点和 prompt 内容，验证摘要是否生效。

**查看位置**：

```text
LangSmith → 项目 → 某次 trace
→ 找 summarize_history 节点，看输入旧历史、输出摘要
→ 找 prompt 节点，看 summary 变量是否正确注入
```

**效果**：  
不用 print，可视化验证：

- 摘要是否触发
- 摘要内容是否合理
- prompt 里 summary 和 history 是否正确

**关键字**：

- LangSmith trace
- `summarize_history` 节点
- prompt 节点 input

---

## 四、最终串联代码

```text
app/
├── llm/
│   ├── client.py          # get_llm()
│   ├── prompts.py         # prompt 含 summary + history + question
│   ├── token_counter.py   # tiktoken 计数
│   ├── chains.py          # base_chain + prepare_input 兜底
│   ├── summary.py         # summarize_history
│   ├── parsers.py         # Intent
│   ├── tools.py           # query_order / create_refund
│   └── router.py          # 意图路由
├── services/
│   └── short_term_memory.py
├── cache/
│   └── memory_store.py
├── db/
│   ├── models.py          # ChatSession 含 summary
│   └── session.py
└── api/
    └── chat.py            # 集成摘要 + 历史 + 裁剪
```

`app/llm/summary.py`：

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.llm.client import get_llm

SUMMARY_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "请把下面的客服对话压缩成一段简洁的摘要。\n"
     "要求：\n"
     "1. 保留关键信息：订单号、用户诉求、已处理事项、未解决问题\n"
     "2. 丢弃寒暄、重复内容\n"
     "3. 用第三人称，200 字以内\n"
     "4. 只输出摘要，不要其他内容"),
    ("human", "{conversation}"),
])

summary_chain = SUMMARY_PROMPT | get_llm() | StrOutputParser()


async def summarize_history(messages: list[dict]) -> str:
    if not messages:
        return ""
    conversation = "\n".join(
        f"{m['role']}: {m['content']}" for m in messages
    )
    return await summary_chain.ainvoke({"conversation": conversation})
```

`app/llm/chains.py` 兜底部分：

```python
from langchain_core.runnables import RunnableLambda

def prepare_input(x: dict) -> dict:
    return {
        **x,
        "summary": x.get("summary") or "无",
    }

base_chain = (
    RunnableLambda(prepare_input)
    | CUSTOMER_SERVICE_PROMPT
    | llm
    | parser
)
```

`app/api/chat.py` 集成部分：

```python
SUMMARY_TRIGGER = 20
KEEP_RECENT = 10


@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    session = await get_or_create_session(db, req)

    history_raw = await get_recent_messages(session.id)

    if len(history_raw) > SUMMARY_TRIGGER:
        old = history_raw[:-KEEP_RECENT]
        recent = history_raw[-KEEP_RECENT:]
        session.summary = await summarize_history(old)
        await db.commit()
        history_raw = recent

    reply = await base_chain.ainvoke({
        "company": "某某科技",
        "summary": session.summary or "无",
        "history": to_langchain_messages(history_raw),
        "question": req.message,
    })

    await append_message(session.id, "user", req.message)
    await append_message(session.id, "assistant", reply)

    return {"session_id": session.id, "reply": reply}
```

---

## 五、测试用例 `test_summary.py`

```python
import pytest
from unittest.mock import AsyncMock, patch

from app.llm.summary import summarize_history


# ==================== 空历史兜底 ====================
@pytest.mark.asyncio
async def test_summarize_empty_returns_empty():
    result = await summarize_history([])
    assert result == ""


# ==================== 正常摘要 ====================
@pytest.mark.asyncio
async def test_summarize_calls_chain():
    messages = [
        {"role": "user", "content": "我要退款，订单12345"},
        {"role": "assistant", "content": "好的，已收到"},
    ]

    with patch("app.llm.summary.summary_chain") as mock_chain:
        mock_chain.ainvoke = AsyncMock(return_value="用户咨询订单12345退款。")
        result = await summarize_history(messages)

    assert "12345" in result
    mock_chain.ainvoke.assert_called_once()
    call_args = mock_chain.ainvoke.call_args[0][0]
    assert "user: 我要退款" in call_args["conversation"]


# ==================== 触发策略 ====================
def test_summary_trigger_constant():
    from app.api.chat import SUMMARY_TRIGGER, KEEP_RECENT
    assert SUMMARY_TRIGGER > KEEP_RECENT
    assert SUMMARY_TRIGGER >= 10


def test_slice_old_and_recent():
    history = [{"role": "user", "content": f"m{i}"} for i in range(25)]
    old = history[:-10]
    recent = history[-10:]
    assert len(old) == 15
    assert len(recent) == 10
    assert old[-1]["content"] == "m14"
    assert recent[0]["content"] == "m15"


def test_slice_short_history():
    history = [{"role": "user", "content": f"m{i}"} for i in range(5)]
    old = history[:-10]
    recent = history[-10:]
    assert old == []
    assert len(recent) == 5


# ==================== Prompt 兜底 ====================
def test_prepare_input_none_summary():
    from app.llm.chains import prepare_input
    result = prepare_input({"summary": None, "question": "你好"})
    assert result["summary"] == "无"


def test_prepare_input_empty_summary():
    from app.llm.chains import prepare_input
    result = prepare_input({"summary": "", "question": "你好"})
    assert result["summary"] == "无"


def test_prepare_input_valid_summary():
    from app.llm.chains import prepare_input
    result = prepare_input({"summary": "用户咨询退款", "question": "你好"})
    assert result["summary"] == "用户咨询退款"
```

运行：

```bash
pytest tests/test_summary.py -q
```

---

## 六、总结串联关系

1. **定位**：历史太长用摘要压缩旧历史，保留最近 N 轮原文。
2. **触发**：`SUMMARY_TRIGGER=20` 超过才触发，`KEEP_RECENT=10` 保留近期。
3. **摘要链**：`SUMMARY_PROMPT | llm | parser`，明确"保留什么、丢弃什么"。
4. **存储**：`ChatSession.summary` 存数据库，不存内存。
5. **Prompt**：`("system", "历史摘要：{summary}")` 放在 system 和 history 之间。
6. **顺序**：先取历史 → 判断摘要 → 调 LLM → 最后 append。
7. **兜底**：`session.summary or "无"`，`summarize_history([]) → ""`。
8. **成本**：摘要多一次 LLM 调用，触发频率和模型选择要权衡。
9. **验证**：LangSmith trace 看 `summarize_history` 节点和 prompt 的 `summary` 变量。

**一句话串起来**：  
历史超阈值 → `summarize_history` 压缩旧历史 → 存 `session.summary` → Prompt 注入 `{summary}` → 最近 N 轮保留原文 → 先取历史后 append → LangSmith 验证。

这就是模块 3.4 会话摘要的全部骨架。你的智能客服现在能处理超长对话，下一步模块 4 RAG 会让它基于公司文档回答。
