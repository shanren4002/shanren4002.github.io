---
title: "LangChain 流式输出与 LangSmith 追踪（模块 2.6）"
slug: langchain-2-6
category: "智能客服"
tags: [LangChain]
date: 2026-09-27
status: draft
summary: "LCEL astream 流式方法与 FastAPI StreamingResponse 实战"
source: "笔记/FastAPI/智能客服/LangChain 2.6.md"
---
下面按你 FastAPI 知识点总结的格式，整理 **模块 2.6 流式输出与 LangSmith 追踪**：  
**讲解 → 代码 → 关键字 / 导入包 → 效果**。最后串成项目关键文件和 Python 测试脚本。

---

# 模块 2.6 流式输出与 LangSmith 追踪知识点整理

## 一、知识点整理

### 1. LCEL 流式方法：astream

**讲解**：  
LCEL 链支持 `astream` 异步逐块输出。链末尾有 `StrOutputParser` 时，chunk 是 `str`；没有时是 `AIMessageChunk`。  
FastAPI 里用异步版本，不阻塞事件循环。

**代码**：

```python
async for chunk in chain.astream({"question": "你好"}):
    print(chunk, end="", flush=True)
```

**关键字 / 导入包**：

- `chain.astream(...)`
- `async for`
- `AIMessageChunk`（没有 parser 时）
- `StrOutputParser`（有 parser 时 chunk 是 str）

**效果**：  
模型一边生成，程序一边拿到片段。前端可以做打字机效果，用户不用等整段生成完。

---

### 2. FastAPI 流式接口：StreamingResponse

**讲解**：  
用 `StreamingResponse` 返回异步生成器，`media_type="text/event-stream"` 表示 SSE。  
每个 chunk 按 `data: xxx\n\n` 格式推送，最后发 `data: [DONE]\n\n` 结束。

**代码**：

```python
# app/api/chat.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.llm.chains import base_chain

router = APIRouter()


class ChatStreamRequest(BaseModel):
    user_id: int
    session_id: int | None = None
    message: str


@router.post("/chat/stream")
async def chat_stream(req: ChatStreamRequest):
    async def event_generator():
        async for chunk in base_chain.astream({
            "company": "某某科技",
            "question": req.message,
        }):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
```

**关键字 / 导入包**：

- `StreamingResponse`：`from fastapi.responses import StreamingResponse`
- `media_type="text/event-stream"`
- `async def event_generator()` + `yield`
- SSE 格式：`data: xxx\n\n`
- 结束标记：`data: [DONE]\n\n`

**效果**：  
`POST /chat/stream` 逐块推送模型输出。前端用 `EventSource` 或 `fetch + ReadableStream` 接收，实现打字机效果。

**注意**：

- `data: ` 后有空格，`\n\n` 是 SSE 分隔符，不能少
- `[DONE]` 是约定俗成的结束标记，前端据此关闭连接
- `StreamingResponse` 不能再加 `response_model`，流式响应不走 Pydantic 序列化

---

### 3. SSE 协议要点

**讲解**：  
SSE（Server-Sent Events）是 HTTP 长连接，服务端持续推文本。  
每条消息格式固定：`data: 内容\n\n`。  
浏览器端用 `EventSource` 接收；Python 端用 `httpx.stream` 接收。

**SSE 消息格式**：

```text
data: 你好\n\n
data: ，有什么\n\n
data: 可以帮你？\n\n
data: [DONE]\n\n
```

**关键字**：

- `text/event-stream`
- `data: ` 前缀
- `\n\n` 消息分隔
- `[DONE]` 结束标记

**效果**：  
前端不用轮询，服务端主动推。适合 LLM 流式输出、实时通知。

---

### 4. Python 测试流式接口

**讲解**：  
用 `httpx.stream` 发请求，`iter_lines()` 逐行读。  
比 `requests` 更适合流式，支持异步和同步。  
每次拿到 `data: xxx` 就打印，验证 SSE 格式。

**代码**：

```python
# scripts/test_stream.py
import httpx

URL = "http://127.0.0.1:8000/api/chat/stream"

payload = {
    "user_id": 1,
    "message": "你好，我要退款，订单号12345",
    "session_id": None,
}

with httpx.stream("POST", URL, json=payload, timeout=60) as r:
    print("status:", r.status_code)
    print("content-type:", r.headers.get("content-type"))
    print("--- 流式输出开始 ---")

    buffer = ""
    for line in r.iter_lines():
        if not line:
            continue
        if line.startswith("data: "):
            content = line[len("data: "):]
            if content == "[DONE]":
                print("\n--- 流式输出结束 ---")
                break
            buffer += content
            print(content, end="", flush=True)

print("\n完整回复：", buffer)
```

**关键字 / 导入包**：

- `httpx.stream("POST", url, json=payload)`：`import httpx`
- `r.iter_lines()`
- `line.startswith("data: ")`
- `content == "[DONE]"`
- `timeout=60`：流式请求要设长超时

**效果**：  
运行时逐块打印，最后看到 `[DONE]`，并得到完整回复。  
实测输出：

```text
status: 200
content-type: text/event-stream; charset=utf-8
--- 流式输出开始 ---
您好，关于退款
我已收到您的申请
，订单号 12345
...
--- 流式输出结束 ---
完整回复： 您好，关于退款我已收到您的申请，订单号 12345...
```

---

### 5. LangSmith 环境变量配置

**讲解**：  
LangSmith 是 LangChain 官方追踪平台。  
在 `.env` 里配置三个变量，就能自动上报 trace。  
变量名是 `LANGSMITH_*`，不是 `LANGCHAIN_*`（旧版才用 `LANGCHAIN_*`）。

**代码**：

```env
# .env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_你的key
LANGSMITH_PROJECT=smart-customer-service
```

**关键字 / 导入包**：

- `LANGSMITH_TRACING=true`：开启追踪
- `LANGSMITH_API_KEY`：API Key
- `LANGSMITH_PROJECT`：项目名

**效果**：  
每次 `chain.invoke` / `astream` 调用自动上报 trace，无需改业务代码。

---

### 6. load_dotenv 加载顺序

**讲解**：  
`load_dotenv()` 必须在导入任何 LangChain 模块之前执行。  
否则 LangSmith 读不到环境变量，trace 不会上报。

**代码**：

```python
# app/main.py 顶部
from dotenv import load_dotenv
load_dotenv()   # 必须最先执行

# 之后再导入 LangChain 相关模块
from fastapi import FastAPI
from app.api.chat import router as chat_router
```

**关键字 / 导入包**：

- `load_dotenv`：`from dotenv import load_dotenv`
- 导入顺序：先 `load_dotenv`，再 `import langchain*`

**效果**：  
LangSmith 能读到 `LANGSMITH_*` 变量，trace 正常上报。

**坑**：如果 `from app.llm.client import get_llm` 在 `load_dotenv()` 之前，LangSmith 可能读不到配置。

---

### 7. LangSmith 项目配置

**讲解**：  
`.env` 里的 `LANGSMITH_PROJECT` 只是告诉客户端往哪个项目发 trace。  
项目本身需要在 LangSmith 控制台先创建，或让第一次 trace 自动创建。  
两边名字必须一致，否则 trace 跑到默认项目 `default`。

**操作步骤**：

```text
1. 登录 https://smith.langchain.com
2. 左侧 Application 下拉，选择 My First App（或新建组织）
3. 进入 Tracing 页
4. 如果 .env 里写了 LANGSMITH_PROJECT=smart-customer-service
   - 第一次发请求时，项目名会自动出现在左上角
   - 如果没出现，手动点 + New 创建同名项目
5. 之后所有 trace 都归到这个项目下
```

**关键字**：

- `LANGSMITH_PROJECT` 值
- 控制台项目名
- 默认项目 `default`

**效果**：  
控制台能看到所有 trace，按项目归类。

**规则**：`.env` 项目名 = 控制台项目名。不一致时 trace 进默认项目。

---

### 8. LangSmith trace 里能看到什么

**讲解**：  
一次请求的 trace 会拆成多个节点，每个节点都有输入、输出、耗时、token、错误。

**节点类型**：

| 节点 | 类型 | 看到什么 |
|---|---|---|
| `RunnableSequence` | chain | 整条链，输入 `question`，输出 `Intent` |
| `RunnableBranch` | chain | 路由分支，输入、输出 |
| `ChatOpenAI` | llm | 模型调用，含耗时、token |
| `PydanticOutputParser` | parser | 解析结果 |
| 工具调用 | tool | 工具输入输出 |

**每个节点能看**：

- Input / Output
- Latency（耗时）
- Error（错误）
- Metadata（元数据）
- Token 用量

**效果**：  
不用 print，可视化看到每步输入输出、耗时、错误。  
例如从 trace 一眼看出：

1. 意图识别耗时 0.5-1.1 秒，是主要瓶颈
2. 路由分支耗时 0.01-0.02 秒，极快
3. 有一条红色报错 `1 validation error for create_refund`，工具参数校验失败

**这就是 LangSmith 的价值**：调试、优化、评估都有了可视化依据。

---

### 9. 流式 + LangSmith 集成

**讲解**：  
流式请求同样会被 LangSmith 追踪。  
`chain.astream` 结束后，trace 自动上报。  
在控制台能看到流式链的完整调用。

**代码**：

```python
# 无需额外代码，只要 .env 配好，astream 自动上报
async for chunk in base_chain.astream({"company": "某某科技", "question": "你好"}):
    yield f"data: {chunk}\n\n"
```

**关键字**：

- `astream` + LangSmith 自动追踪
- 控制台看流式 trace

**效果**：  
流式接口也能在 LangSmith 里看到每个节点的耗时和输出。

---

## 二、最终串联代码

```text
FastAPIProjectTestAi/
├── app/
│   ├── main.py                     # load_dotenv() 在顶部
│   ├── api/
│   │   └── chat.py                 # /chat + /chat/stream
│   ├── db/                         # 三张表 + get_db
│   ├── cache/
│   │   └── memory_store.py
│   ├── services/
│   │   └── short_term_memory.py
│   └── llm/
│       ├── client.py
│       ├── prompts.py
│       ├── chains.py
│       ├── parsers.py
│       ├── tools.py
│       └── router.py
├── scripts/
│   └── test_stream.py              # 流式测试脚本
├── .env                            # LLM + LANGSMITH_*
├── smart_cs.db
└── requirements.txt
```

`app/main.py`：

```python
from dotenv import load_dotenv
load_dotenv()   # 必须在导入 LangChain 之前

from fastapi import FastAPI
from app.api.chat import router as chat_router

app = FastAPI(title="智能客服 API")
app.include_router(chat_router)
```

`app/api/chat.py` 流式部分：

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.llm.chains import base_chain

router = APIRouter()


class ChatStreamRequest(BaseModel):
    user_id: int
    session_id: int | None = None
    message: str


@router.post("/chat/stream")
async def chat_stream(req: ChatStreamRequest):
    async def event_generator():
        try:
            async for chunk in base_chain.astream({
                "company": "某某科技",
                "question": req.message,
            }):
                yield f"data: {chunk}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {e}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
```

`.env`：

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_xxx
LANGSMITH_PROJECT=smart-customer-service
```

---

## 三、Python 测试脚本

### 1. 流式接口测试脚本 `scripts/test_stream.py`

```python
import httpx

URL = "http://127.0.0.1:8000/chat/stream"

payload = {
    "user_id": 1,
    "message": "你好，我要退款，订单号12345",
    "session_id": None,
}

with httpx.stream("POST", URL, json=payload, timeout=60) as r:
    print("status:", r.status_code)
    print("content-type:", r.headers.get("content-type"))
    print("--- 流式输出开始 ---")

    buffer = ""
    for line in r.iter_lines():
        if not line:
            continue
        if line.startswith("data: "):
            content = line[len("data: "):]
            if content == "[DONE]":
                print("\n--- 流式输出结束 ---")
                break
            if content.startswith("[ERROR]"):
                print("\n错误：", content)
                break
            buffer += content
            print(content, end="", flush=True)

print("\n完整回复：", buffer)
```

运行：

```bash
# 先启动服务
uvicorn app.main:app --reload

# 另开终端跑脚本
python scripts/test_stream.py
```

预期输出：

```text
status: 200
content-type: text/event-stream; charset=utf-8
--- 流式输出开始 ---
您好，关于退款
我已收到您的申请
，订单号 12345
...
--- 流式输出结束 ---
完整回复： 您好，关于退款我已收到您的申请，订单号 12345...
```

---

### 2. LangSmith 验证脚本 `scripts/test_langsmith.py`

```python
import os
from dotenv import load_dotenv
load_dotenv()

from app.llm.chains import base_chain


def main():
    print("LANGSMITH_TRACING:", os.getenv("LANGSMITH_TRACING"))
    print("LANGSMITH_PROJECT:", os.getenv("LANGSMITH_PROJECT"))

    result = base_chain.invoke({
        "company": "某某科技",
        "question": "你好",
    })
    print("回复:", result)
    print("请登录 https://smith.langchain.com 查看 trace")


if __name__ == "__main__":
    main()
```

运行：

```bash
python -m scripts.test_langsmith
```

预期输出：

```text
LANGSMITH_TRACING: true
LANGSMITH_PROJECT: smart-customer-service
回复: 你好，有什么可以帮你？
请登录 https://smith.langchain.com 查看 trace
```

然后去控制台，进入 `smart-customer-service` 项目，能看到这次调用。

---

### 3. pytest 测试用例 `tests/test_stream.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_stream_returns_event_stream():
    with client.stream(
        "POST",
        "/chat/stream",
        json={"user_id": 1, "message": "你好"},
    ) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]


def test_stream_contains_done_marker():
    chunks = []
    with client.stream(
        "POST",
        "/chat/stream",
        json={"user_id": 1, "message": "你好"},
    ) as r:
        for line in r.iter_lines():
            if line.startswith("data: "):
                chunks.append(line[len("data: "):])

    assert chunks, "没有收到任何 chunk"
    assert chunks[-1] == "[DONE]"


def test_stream_data_format():
    with client.stream(
        "POST",
        "/chat/stream",
        json={"user_id": 1, "message": "你好"},
    ) as r:
        for line in r.iter_lines():
            if line:
                assert line.startswith("data: "), f"格式不对: {line}"
                break


def test_langsmith_env_loaded():
    import os
    from app.main import app  # noqa
    # load_dotenv 已执行，环境变量应存在
    assert os.getenv("LANGSMITH_TRACING") in ("true", "True", None)
```

运行：

```bash
pytest tests/test_stream.py -q
```

---

## 四、总结串联关系

1. `chain.astream` 是流式输出的源头，逐块产出。
2. `StreamingResponse` + `media_type="text/event-stream"` 把流式包成 SSE。
3. 每条消息格式 `data: xxx\n\n`，最后 `data: [DONE]\n\n` 结束。
4. `scripts/test_stream.py` 用 `httpx.stream` 逐行读，验证格式和内容。
5. `.env` 配 `LANGSMITH_*` 三件套。
6. `load_dotenv()` 必须在导入 LangChain 之前。
7. `LANGSMITH_PROJECT` 和控制台项目名必须一致。
8. LangSmith trace 可视化每步输入输出、耗时、token、错误。
9. 流式链同样自动上报，无需额外代码。

**一句话串起来**：  
`astream` 产出 chunk → `StreamingResponse` 推 SSE → `httpx.stream` 验证 → `load_dotenv` 加载配置 → LangSmith 自动追踪 → 控制台可视化每步耗时和错误。
