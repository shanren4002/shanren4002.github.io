---
title: "智能客服数据库知识点"
slug: smart-cs-database
category: "智能客服"
tags: [SQLAlchemy, 数据库, 智能客服]
date: 2026-09-24
status: draft
summary: "SQLAlchemy 2.0 异步引擎、Session 与短期记忆的数据层设计"
source: "笔记/FastAPI/智能客服/智能客服数据库部分知识点.md"
---
---
下面按你复盘里的 **模块 1.5 数据库 + 内存短期记忆** 整理，格式参考 FastAPI 知识点部分：  
**讲解 → 代码 → 关键字 / 导入包 → 效果**。最后串成项目关键文件和测试用例。

---

# 智能客服——数据知识点部分整理

## 一、知识点整理

### 1. SQLAlchemy 2.0 异步引擎与 Session

**讲解**：  
用 `create_async_engine` 创建异步引擎，用 `async_sessionmaker` 创建 Session 工厂。  
SQLite 异步驱动用 `aiosqlite`，连接串是 `sqlite+aiosqlite:///./smart_cs.db`。

**代码**：

```python
# app/db/session.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)

DATABASE_URL = "sqlite+aiosqlite:///./smart_cs.db"

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

**关键字 / 导入包**：

- `create_async_engine`
- `async_sessionmaker`
- `AsyncSession`
- `sqlite+aiosqlite`
- `expire_on_commit=False`

**效果**：  
得到一个异步数据库引擎和 Session 工厂，后续所有数据库操作都通过 `AsyncSession` 完成。

---

### 2. ORM 模型：User / ChatSession / Message

**讲解**：  
SQLAlchemy 2.0 推荐用 `Mapped` + `mapped_column` 声明字段。  
三张表关系：一个 User 有多个 ChatSession，一个 ChatSession 有多条 Message。

**代码**：

```python
# app/db/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

```python
# app/db/models.py
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(100), default="新对话")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"))
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
```

**关键字 / 导入包**：

- `DeclarativeBase`
- `Mapped`
- `mapped_column`
- `relationship`
- `ForeignKey`
- `String` / `Integer` / `Text` / `DateTime`

**效果**：  
三张表结构清晰，支持外键和级联删除。以后查用户、查会话、查消息都可以用 ORM。

---

### 3. 建表脚本：Base.metadata.create_all

**讲解**：  
用 `engine.begin()` 开事务，再 `run_sync(Base.metadata.create_all)` 建表。  
脚本必须从项目根目录用 `python -m app.db.init_db` 运行。

**代码**：

```python
# app/db/init_db.py
import asyncio
from app.db.session import engine
from app.db.base import Base
from app.db import models  # 不能删，确保模型被注册


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(init_db())
```

**关键字 / 导入包**：

- `asyncio`
- `engine.begin()`
- `run_sync`
- `Base.metadata.create_all`

**效果**：  
运行后生成 `smart_cs.db`，三张表自动建好。

运行命令：

```bash
cd 项目根目录
python -m app.db.init_db
```

---

### 4. yield 依赖：get_db

**讲解**：  
请求进来打开 Session，请求结束自动关闭。  
这是 `yield` 依赖在真实项目里的核心用途。

**代码**：

```python
# app/db/session.py
from collections.abc import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

**关键字 / 导入包**：

- `AsyncGenerator`
- `yield`
- `try / finally`
- `Depends(get_db)`

**效果**：  
每个请求一个独立数据库会话，请求结束一定关闭，避免连接泄漏。

---

### 5. 异步 CRUD：新增、查询、按主键查

**讲解**：  
SQLAlchemy 2.0 异步查询用 `await db.execute(select(...))`。  
新增用 `db.add()` + `await db.commit()` + `await db.refresh()`。

**代码**：

```python
from sqlalchemy import select
from app.db.models import User

# 新增
user = User(name="张三")
db.add(user)
await db.commit()
await db.refresh(user)   # 拿数据库生成的 id

# 条件查询
result = await db.execute(select(User).where(User.name == "张三"))
user = result.scalar_one_or_none()

# 按主键查
user = await db.get(User, 1)
```

**关键字 / 导入包**：

- `select`
- `db.add`
- `await db.commit`
- `await db.refresh`
- `result.scalar_one_or_none()`
- `await db.get(Model, id)`

**效果**：  
完成增删改查基础操作。`refresh` 后能拿到自增 ID 和数据库默认值。

---

### 6. 接口：POST /users 创建用户

**讲解**：  
请求体用 Pydantic 模型，响应体用 `response_model` 过滤。  
返回 ORM 对象时，Pydantic 模型要开 `from_attributes=True`。

**代码**：

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import User

router = APIRouter()


class UserCreate(BaseModel):
    name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(req: UserCreate, db: AsyncSession = Depends(get_db)):
    user = User(name=req.name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
```

**关键字 / 导入包**：

- `ConfigDict(from_attributes=True)`
- `Depends(get_db)`
- `status_code=201`
- `db.add` / `commit` / `refresh`

**效果**：  
POST `/users` 返回 201 和新用户 JSON。字段名必须和模型一致，避免 `UserRequsest` 这类拼写错误。

---

### 7. 接口：POST /chat 存消息

**讲解**：  
传 `user_id`、可选 `session_id`、`message`。  
没有 `session_id` 就新建会话，然后存一条用户消息。

**代码**：

```python
from pydantic import BaseModel
from app.db.models import ChatSession, Message

class ChatRequest(BaseModel):
    user_id: int
    session_id: int | None = None
    message: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    role: str
    content: str


class ChatResponse(BaseModel):
    session_id: int
    message: MessageOut


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    session = None
    if req.session_id:
        session = await db.get(ChatSession, req.session_id)

    if not session:
        session = ChatSession(user_id=req.user_id, title="新对话")
        db.add(session)
        await db.commit()
        await db.refresh(session)

    msg = Message(session_id=session.id, role="user", content=req.message)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return {"session_id": session.id, "message": msg}
```

**关键字 / 导入包**：

- `session_id: int | None = None`
- `await db.get(ChatSession, req.session_id)`
- `db.add` / `commit` / `refresh`
- `response_model=ChatResponse`

**效果**：  
前端发消息时，如果没会话就自动建会话，并把消息持久化到 SQLite。

---

### 8. 接口：GET /sessions/{id}/messages 查历史

**讲解**：  
按 `session_id` 查消息，按 `id` 排序，返回列表。  
`response_model=list[MessageOut]` 会自动序列化。

**代码**：

```python
from sqlalchemy import select

@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def get_messages(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.id)
    )
    return list(result.scalars().all())
```

**关键字 / 导入包**：

- `select(Message)`
- `where`
- `order_by`
- `result.scalars().all()`
- `list[MessageOut]`

**效果**：  
GET `/sessions/1/messages` 返回该会话全部历史消息，前端可渲染聊天记录。

---

### 9. MemoryStore：内存字典 + TTL

**讲解**：  
用字典模拟 Redis：`key -> (value, expire_at)`。  
支持 `set`、`get`、`delete`，接口和 Redis 一致。以后换真 Redis 只改这一个文件。

**代码**：

```python
# app/cache/memory_store.py
import time
from typing import Any


class MemoryStore:
    def __init__(self):
        self._data: dict[str, tuple[Any, float | None]] = {}

    async def set(self, key: str, value: Any, ex: int | None = None):
        expire_at = time.time() + ex if ex else None
        self._data[key] = (value, expire_at)

    async def get(self, key: str):
        item = self._data.get(key)
        if not item:
            return None
        value, expire_at = item
        if expire_at and time.time() > expire_at:
            del self._data[key]
            return None
        return value

    async def delete(self, key: str):
        self._data.pop(key, None)
```

**关键字 / 导入包**：

- `time.time()`
- `dict[str, tuple[Any, float | None]]`
- `ex` 过期秒数
- `async def set/get/delete`

**效果**：  
短期记忆可以设置 TTL，过期自动删除。接口风格接近 Redis，后续迁移成本低。

---

### 10. ShortTermMemory：最近 N 条

**讲解**：  
在 MemoryStore 上再封装一层，只保留最近 N 条消息，用于喂给 LLM 的短期上下文。

**代码**：

```python
# app/services/short_term_memory.py
from app.cache.memory_store import MemoryStore


class ShortTermMemory:
    def __init__(self, store: MemoryStore, max_turns: int = 10, ttl: int = 3600):
        self.store = store
        self.max_turns = max_turns
        self.ttl = ttl

    def _key(self, session_id: int) -> str:
        return f"session:{session_id}:messages"

    async def append(self, session_id: int, role: str, content: str):
        key = self._key(session_id)
        messages = await self.store.get(key) or []
        messages.append({"role": role, "content": content})
        messages = messages[-self.max_turns:]
        await self.store.set(key, messages, ex=self.ttl)

    async def get(self, session_id: int):
        return await self.store.get(self._key(session_id)) or []
```

**关键字 / 导入包**：

- `max_turns`
- `ttl`
- `messages[-self.max_turns:]`
- `await self.store.set(..., ex=self.ttl)`

**效果**：  
每个会话只保留最近 10 条消息，1 小时后过期。LLM 调用时直接拿这个列表当上下文。

---

### 11. 数据库 + 内存的分工

**讲解**：  
SQLite 存全量历史，内存 store 存最近 N 条。  
两者职责不同，不要混。

| 存储 | 内容 | 特点 |
|---|---|---|
| SQLite | 全量历史 | 持久、可查询 |
| 内存 store | 最近 N 条 | 快、有 TTL |

**效果**：  
历史消息可追溯，LLM 上下文又足够快。以后要换 Redis，只替换 MemoryStore 实现。

---

### 12. 项目运行规范

**讲解**：  
只要代码里有 `from app.xxx import ...`，就必须从项目根目录运行。

**代码 / 命令**：

```bash
cd D:\App\JetBrains\py\FastAPIProjectTestAi

# 建表脚本
python -m app.db.init_db

# 启动服务
uvicorn app.main:app --reload
```

**关键字**：

- 项目根目录
- `python -m app.db.init_db`
- `uvicorn app.main:app --reload`

**效果**：  
避免 `ModuleNotFoundError: No module named 'app'`。

---

### 13. 环境与踩坑速查

| 坑 | 原因 | 解决 |
|---|---|---|
| Python 3.14 + SQLAlchemy 不兼容 | 旧版未适配 | 升级 SQLAlchemy 到 2.0.51 |
| NumPy 源码编译失败 | 无 C 编译器 | `numpy>=2.3.2`，加 `--only-binary :all:` |
| LangChain 与 NumPy 冲突 | 旧版锁 numpy<2 | 升级 LangChain 到 1.x |
| `No module named 'app'` | 工作目录不对 | 从项目根目录运行 |
| `/docs` 空白 | CDN 加载失败 | 用本地静态文件 / ReDoc / curl |
| 字段名不匹配 | 拼写错误 | 请求模型字段和函数体保持一致 |

**效果**：  
以后先确认 Python 版本、虚拟环境、依赖版本，再写业务代码。

---

## 二、最终串联代码：项目关键文件

```text
FastAPIProjectTestAi/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── chat.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── session.py
│   │   ├── models.py
│   │   └── init_db.py
│   ├── cache/
│   │   └── memory_store.py
│   └── services/
│       └── short_term_memory.py
├── smart_cs.db
├── requirements.txt
└── test_main.http
```

`app/main.py`：

```python
from fastapi import FastAPI
from app.api.chat import router as chat_router

app = FastAPI(title="智能客服 API")
app.include_router(chat_router)
```

`requirements.txt` 建议：

```txt
fastapi
uvicorn[standard]
sqlalchemy>=2.0.51
aiosqlite
pydantic>=2
pytest
httpx
pytest-asyncio
```

运行：

```bash
cd 项目根目录
python -m app.db.init_db
uvicorn app.main:app --reload
```

---

## 三、测试用例 `test_data.py`

```python
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.cache.memory_store import MemoryStore

client = TestClient(app)


def test_create_user():
    r = client.post("/users", json={"name": "张三"})
    assert r.status_code == 201
    data = r.json()
    assert data["id"] > 0
    assert data["name"] == "张三"


def test_chat_and_history():
    user = client.post("/users", json={"name": "李四"}).json()

    r1 = client.post(
        "/chat",
        json={"user_id": user["id"], "message": "你好"},
    )
    assert r1.status_code == 200
    session_id = r1.json()["session_id"]

    r2 = client.post(
        "/chat",
        json={
            "user_id": user["id"],
            "session_id": session_id,
            "message": "帮我查订单",
        },
    )
    assert r2.status_code == 200

    r3 = client.get(f"/sessions/{session_id}/messages")
    assert r3.status_code == 200
    messages = r3.json()
    assert len(messages) == 2
    assert messages[0]["content"] == "你好"
    assert messages[1]["content"] == "帮我查订单"


def test_memory_store_set_get():
    store = MemoryStore()

    async def run():
        await store.set("k", "v", ex=10)
        return await store.get("k")

    assert asyncio.run(run()) == "v"


def test_memory_store_expire():
    store = MemoryStore()

    async def run():
        await store.set("k", "v", ex=-1)
        return await store.get("k")

    assert asyncio.run(run()) is None
```

运行：

```bash
pytest -q
```

---

## 四、总结串联关系

1. `session.py` 提供异步引擎、Session 工厂、`get_db`。
2. `models.py` 定义 User / ChatSession / Message 三张表。
3. `init_db.py` 负责建表。
4. `chat.py` 提供 `/users`、`/chat`、`/sessions/{id}/messages`。
5. `MemoryStore` 提供 Redis 风格内存缓存。
6. `ShortTermMemory` 在 MemoryStore 上封装最近 N 条消息。
7. SQLite 存全量历史，内存存短期上下文。
8. 所有命令都从项目根目录运行，避免 `app` 包找不到。

这样，模块 1.5 数据库 + 内存短期记忆就串起来了。明天进入模块 2 LangChain 时，短期记忆可以直接作为上下文传给模型。

## 三、今天学到的核心知识

### 1. SQLAlchemy 2.0 基本用法

```python
# 模型定义
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50))

# 查询
result = await db.execute(select(User).where(User.name == "张三"))
user = result.scalar_one_or_none()

# 新增
db.add(user)
await db.commit()
await db.refresh(user)   # 拿数据库生成的 id

# 按主键查
user = await db.get(User, 1)
```

### 2. `yield` 依赖的真实用途

```python
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

请求进来打开会话，请求结束自动关闭。这就是 `yield` 依赖的实战场景。

### 3. 短期记忆用内存字典实现

```python
class MemoryStore:
    def __init__(self):
        self._data: dict[str, tuple[Any, float | None]] = {}

    async def set(self, key, value, ex=None):
        expire_at = time.time() + ex if ex else None
        self._data[key] = (value, expire_at)

    async def get(self, key):
        item = self._data.get(key)
        if not item:
            return None
        value, expire_at = item
        if expire_at and time.time() > expire_at:
            del self._data[key]
            return None
        return value
```

接口和 Redis 一致，以后换真 Redis 只改这一个文件。

### 4. 数据库 + 内存的分工

| 存储 | 内容 | 特点 |
|---|---|---|
| SQLite | 全量历史 | 持久、可查询 |
| 内存 store | 最近 N 条 | 快、有 TTL |

### 5. FastAPI 项目运行规范

```bash
# 永远在项目根目录运行
cd D:\App\JetBrains\py\FastAPIProjectTestAi

# 脚本用 -m
python -m app.db.init_db

# 服务用模块路径
uvicorn app.main:app --reload
```

---

## 四、今天暴露的问题

| 问题 | 改进 |
|---|---|
| 我讲代码时没讲"在哪跑、怎么跑" | 以后每个示例都带运行命令和预期输出 |
| 环境问题排查花了大量时间 | 以后先确认 Python 版本、虚拟环境、依赖版本 |
| 代码字段名不匹配 | 写完先自己读一遍请求模型和函数体的字段对应 |
| 没有外网导致 CDN 失败 | 以后涉及在线资源，默认给离线方案 |

---

## 五、当前项目状态

```text
FastAPIProjectTestAi/
├── .venv/
├── app/
│   ├── __init__.py
│   ├── main.py               ✅ 挂载了 chat.router
│   ├── api/
│   │   ├── __init__.py
│   │   └── chat.py           ✅ users/chat/messages 接口
│   ├── db/
│   │   ├── __init__.py
│   │   ├── base.py           ✅ Base
│   │   ├── session.py        ✅ engine + get_db
│   │   ├── models.py         ✅ User/ChatSession/Message
│   │   └── init_db.py        ✅ 建表脚本
│   ├── cache/
│   │   └── memory_store.py   ✅ 内存字典
│   └── services/
│       └── short_term_memory.py  ✅ 短期记忆封装
├── smart_cs.db               ✅ SQLite 数据库
├── requirements.txt          ✅ 适配 Python 3.14
└── test_main.http
```

---
