---
title: "智能客服 FastAPI 知识点"
slug: smart-cs-fastapi
category: "智能客服"
tags: [FastAPI, Pydantic, 智能客服]
date: 2026-09-21
status: published
summary: "请求模型、Field 校验等智能客服项目的 FastAPI 核心知识"
source: "笔记/FastAPI/智能客服/智能客服FastAPI知识点.md"
---
---
## 一、知识点整理

### 1. FastAPI 应用与 Pydantic 请求模型

**讲解**：  
用 `FastAPI()` 创建应用；用 `BaseModel` 定义请求体；用 `Field` 做字段校验。  
你代码里的 `ChatRequest`、`TicketRequest` 都是典型请求模型。

**代码**：

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="智能客服 API")

class ChatRequest(BaseModel):
    user_id: int = Field(..., gt=0)
    message: str = Field(..., min_length=1, max_length=2000)
    priority: int = Field(default=1, ge=1, le=5)

class TicketRequest(BaseModel):
    user_id: int = Field(..., gt=0)
    content: str = Field(..., min_length=1, max_length=100)
    priority: int = Field(default=1, ge=1, le=5)
```

**关键字 / 导入包**：

- `FastAPI`：`from fastapi import FastAPI`
- `BaseModel`, `Field`：`from pydantic import BaseModel, Field`
- `...`：必填
- `gt`：大于；`ge`：大于等于；`le`：小于等于
- `min_length` / `max_length`：字符串长度限制

**效果**：  
请求体不合法时，FastAPI 自动返回 `422 Unprocessable Entity`，不需要你手写校验。

---

### 2. response_model 与字段过滤

**讲解**：  
`response_model` 会按响应模型过滤多余字段。  
你的 `ChatResponse` 故意没有 `password`，所以路由里返回的 `password` 会被过滤。  
`TicketResponse` 没有 `user_id`，所以 `/tickets` 返回的 `user_id` 也会被过滤。

**代码**：

```python
class ChatResponse(BaseModel):
    reply: str
    session_id: str
    priority: int
    user: dict

class TicketResponse(BaseModel):
    ticket_id: int
    status: str

@app.post("/chat", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    return {
        "reply": f"收到：{req.message}",
        "session_id": f"session-{req.user_id}",
        "priority": req.priority,
        "password": "should_be_filtered",
        "user": user,
    }

@app.post("/tickets", response_model=TicketResponse)
async def create_ticket(req: TicketRequest):
    return {
        "user_id": req.user_id,
        "ticket_id": 1,
        "status": "created",
    }
```

**关键字 / 导入包**：

- `response_model`：`@app.post(..., response_model=ChatResponse)`
- `status`：`from fastapi import status`
- `status.HTTP_201_CREATED`：201 状态码

**效果**：  
`/chat` 返回 201，且 JSON 中没有 `password`；`/tickets` 返回中没有 `user_id`，接口结构更稳定。

---

### 3. 路由参数、响应头与状态码

**讲解**：  
路径参数直接写在函数参数里，例如 `order_id: int`。  
响应头可以通过注入 `Response` 来设置。  
状态码可以通过装饰器 `status_code=` 设置。

**代码**：

```python
from fastapi import Response

@app.get("/health")
async def health(response: Response):
    response.headers["X-App"] = "smart-cs"
    return {"status": "ok"}

@app.get("/orders/{order_id}")
async def get_order(order_id: int):
    if order_id == 999:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"order_id": order_id, "status": "shipped"}
```

**关键字 / 导入包**：

- `Response`：`from fastapi import Response`
- 路径参数：`/orders/{order_id}`
- 自定义响应头：`response.headers["X-App"] = "smart-cs"`

**效果**：  
`/health` 返回 `{"status":"ok"}`，并带有 `X-App: smart-cs` 响应头。  
`/orders/999` 返回 404。

---

### 4. 错误处理：HTTPException

**讲解**：  
业务中主动抛 `HTTPException`，FastAPI 会转成标准 JSON 错误响应。

**代码**：

```python
from fastapi import HTTPException

@app.get("/orders/{order_id}")
async def get_order(order_id: int):
    if order_id == 999:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"order_id": order_id, "status": "shipped"}
```

**关键字 / 导入包**：

- `HTTPException`：`from fastapi import HTTPException`
- `status_code=404`
- `detail="订单不存在"`

**效果**：  
访问 `/orders/999` 返回：

```json
{"detail": "订单不存在"}
```

---

### 5. 依赖注入：Header 读取 API Key

**讲解**：  
`Header(...)` 可以从请求头取值。  
你代码里的 `get_api_key` 读取 `X-API-Key`，不匹配就抛 401。

**代码**：

```python
from fastapi import Header, Depends, HTTPException

async def get_api_key(x_api_key: str = Header(...)):
    if x_api_key != "my-secret-key":
        raise HTTPException(status_code=401, detail="API Key 无效")
    return x_api_key

@app.get("/secure")
async def secure(api_key: str = Depends(get_api_key)):
    return {"ok": True}
```

**关键字 / 导入包**：

- `Header`：`from fastapi import Header`
- `Depends`：`from fastapi import Depends`
- `x_api_key` 会自动映射请求头 `X-API-Key`

**效果**：  
请求头带 `X-API-Key: my-secret-key` 才能通过；否则 401。

---

### 6. 依赖注入：HTTPBearer 获取当前用户

**讲解**：  
FastAPI 提供 `HTTPBearer` 自动解析 `Authorization: Bearer xxx`。  
`credentials.credentials` 就是 `Bearer ` 后面的部分。

**代码**：

```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    if credentials.credentials != "xxx":
        raise HTTPException(status_code=401, detail="认证失败")
    return {"user_id": 1, "name": "张三"}
```

**关键字 / 导入包**：

- `HTTPBearer`, `HTTPAuthorizationCredentials`：
  `from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials`
- `Depends(security)`
- `credentials.credentials`

**效果**：  
请求头 `Authorization: Bearer xxx` 时，返回用户 `{"user_id":1,"name":"张三"}`。  
如果 token 不是 `xxx`，抛 401。

---

### 7. 依赖注入：普通 Header 读取 Token

**讲解**：  
你代码里还有一个更简单的 `get_token`，直接从 `Authorization` 请求头读完整字符串。

**代码**：

```python
async def get_token(authorization: str = Header(...)):
    if authorization != "Bearer secret":
        raise HTTPException(status_code=401, detail="error")
    return authorization

@app.get("/profile")
async def get_profile(token: str = Depends(get_token)):
    return {"token": token}
```

**关键字 / 导入包**：

- `Header(...)`
- `Depends(get_token)`

**效果**：  
请求头 `Authorization: Bearer secret` 时，`/profile` 返回：

```json
{"token": "Bearer secret"}
```

---

### 8. 中间件：耗时统计、日志、请求 ID

**讲解**：  
`@app.middleware("http")` 可以在请求前后执行逻辑。  
你代码里 `add_process_time` 统计耗时，`my_middleware` 打印日志，`add_header` 添加 `X-Request-ID`。

**代码**：

```python
import time
from uuid import uuid4
from fastapi import Request
from fastapi.responses import JSONResponse

@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.time() - start_time)
    return response

@app.middleware("http")
async def my_middleware(request: Request, call_next):
    print("my_middleware 1. 请求进来了", request.method, request.url.path)
    response = await call_next(request)
    print("my_middleware 3. 路由执行完，状态码", response.status_code)
    return response

@app.middleware("http")
async def add_header(request: Request, call_next):
    start_time = time.time()
    method = request.method
    url = request.url.path
    print("add_header 1. 请求进来了", method, url)

    response = await call_next(request)
    response.headers["X-Request-ID"] = str(uuid4())

    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    print("add_header 3. 路由执行完，状态码", response.status_code)
    print(f"接口耗时：{process_time * 1000:.4f} ms")
    return response
```

**关键字 / 导入包**：

- `Request`：`from fastapi import Request`
- `call_next`
- `uuid4`：`from uuid import uuid4`
- `time`
- `JSONResponse`：`from fastapi.responses import JSONResponse`

**效果**：  
每个响应都会带上 `X-Request-ID` 和 `X-Process-Time`，控制台能看到请求日志和耗时。

---

### 9. 中间件：admin 权限拦截

**讲解**：  
在 `call_next` 之前做拦截，可以提前返回，不再进入路由。  
你代码里对 `/admin` 开头的路径检查 `x-admin: true`。

**代码**：

```python
@app.middleware("http")
async def add_header(request: Request, call_next):
    start_time = time.time()
    method = request.method
    url = request.url.path
    print("add_header 1. 请求进来了", method, url)

    if url.startswith("/admin"):
        admin_header = request.headers.get("x-admin", "").lower()
        if admin_header != "true":
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden: 缺少有效的 x-admin 头"}
            )

    response = await call_next(request)
    response.headers["X-Request-ID"] = str(uuid4())
    response.headers["X-Process-Time"] = str(time.time() - start_time)
    return response

@app.get("/admin/ping")
async def admin_ping():
    return {"msg": "admin ok"}
```

**关键字 / 导入包**：

- `request.headers.get("x-admin", "").lower()`
- `JSONResponse`
- `status_code=403`

**效果**：  
访问 `/admin/ping` 不带 `x-admin: true` 返回 403；带了才返回 200。

---

### 10. CORS

**讲解**：  
前后端分离时需要 CORS。你的 `test.py` 没写，但知识点里有，我补上。

**代码**：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**关键字 / 导入包**：

- `CORSMiddleware`：`from fastapi.middleware.cors import CORSMiddleware`
- `allow_origins`
- `allow_credentials`
- `allow_methods`
- `allow_headers`

**效果**：  
允许 `http://localhost:3000` 跨域访问，并支持预检请求。

---

### 11. yield 依赖：数据库会话清理

**讲解**：  
你注释里的 `get_db` 是 `yield` 依赖。请求前打开连接，请求结束后执行 `finally` 关闭连接。  
数据库会话、Redis 连接都适合这样写。

**代码**：

```python
def get_db():
    print("打开连接")
    db = {"connection": "模拟数据库连接", "status": "connected"}
    try:
        yield db
    finally:
        print("关闭连接")

@app.get("/orders")
async def list_orders(db=Depends(get_db)):
    return {"db_status": db["status"]}
```

**关键字 / 导入包**：

- `yield`
- `Depends(get_db)`
- `try/finally`

**效果**：  
请求结束后一定会清理资源，避免连接泄漏。

---

## 二、最终串联代码 `main.py`

```python
import time
from uuid import uuid4

from fastapi import (
    FastAPI,
    Depends,
    Header,
    HTTPException,
    Response,
    status,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

app = FastAPI(title="智能客服 API")


# ==================== Pydantic 模型 ====================
class ChatRequest(BaseModel):
    user_id: int = Field(..., gt=0)
    message: str = Field(..., min_length=1, max_length=2000)
    priority: int = Field(default=1, ge=1, le=5)


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    priority: int
    user: dict


class TicketRequest(BaseModel):
    user_id: int = Field(..., gt=0)
    content: str = Field(..., min_length=1, max_length=100)
    priority: int = Field(default=1, ge=1, le=5)


class TicketResponse(BaseModel):
    ticket_id: int
    status: str


# ==================== 依赖注入 ====================
async def get_api_key(x_api_key: str = Header(...)):
    if x_api_key != "my-secret-key":
        raise HTTPException(status_code=401, detail="API Key 无效")
    return x_api_key


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if credentials.credentials != "xxx":
        raise HTTPException(status_code=401, detail="认证失败")
    return {"user_id": 1, "name": "张三"}


async def get_token(authorization: str = Header(...)):
    if authorization != "Bearer secret":
        raise HTTPException(status_code=401, detail="error")
    return authorization


# ==================== 路由 ====================
@app.get("/health")
async def health(response: Response):
    response.headers["X-App"] = "smart-cs"
    return {"status": "ok"}


@app.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_201_CREATED,
)
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    return {
        "reply": f"收到：{req.message}",
        "session_id": f"session-{req.user_id}",
        "priority": req.priority,
        "password": "should_be_filtered",
        "user": user,
    }


@app.get("/orders/{order_id}")
async def get_order(order_id: int):
    if order_id == 999:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"order_id": order_id, "status": "shipped"}


@app.post("/tickets", response_model=TicketResponse)
async def create_ticket(req: TicketRequest):
    return {
        "user_id": req.user_id,
        "ticket_id": 1,
        "status": "created",
    }


@app.get("/profile")
async def get_profile(token: str = Depends(get_token)):
    return {"token": token}


@app.get("/secure")
async def secure(api_key: str = Depends(get_api_key)):
    return {"ok": True}


@app.get("/admin/ping")
async def admin_ping():
    return {"msg": "admin ok"}


# ==================== 中间件 ====================
@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.time() - start_time)
    return response


@app.middleware("http")
async def my_middleware(request: Request, call_next):
    print("my_middleware 1. 请求进来了", request.method, request.url.path)
    response = await call_next(request)
    print("my_middleware 3. 路由执行完，状态码", response.status_code)
    return response


@app.middleware("http")
async def add_header(request: Request, call_next):
    start_time = time.time()
    method = request.method
    url = request.url.path
    print("add_header 1. 请求进来了", method, url)

    # admin 权限拦截：在 call_next 之前
    if url.startswith("/admin"):
        admin_header = request.headers.get("x-admin", "").lower()
        if admin_header != "true":
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden: 缺少有效的 x-admin 头"},
            )

    response = await call_next(request)
    response.headers["X-Request-ID"] = str(uuid4())

    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)

    print("add_header 3. 路由执行完，状态码", response.status_code)
    print(f"接口耗时：{process_time * 1000:.4f} ms")
    return response


# CORS 最后添加，让它处于最外层
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 三、测试用例 `test_main.py`

先安装：

```bash
pip install fastapi uvicorn pytest httpx
```

测试文件：

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert r.headers["X-App"] == "smart-cs"
    assert "X-Request-ID" in r.headers
    assert "X-Process-Time" in r.headers


def test_chat_success():
    r = client.post(
        "/chat",
        json={"user_id": 1, "message": "你好", "priority": 3},
        headers={"Authorization": "Bearer xxx"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["reply"] == "收到：你好"
    assert data["session_id"] == "session-1"
    assert data["priority"] == 3
    assert data["user"] == {"user_id": 1, "name": "张三"}
    assert "password" not in data


def test_chat_invalid_token():
    r = client.post(
        "/chat",
        json={"user_id": 1, "message": "你好"},
        headers={"Authorization": "Bearer wrong"},
    )
    assert r.status_code == 401


def test_chat_validation_error():
    r = client.post(
        "/chat",
        json={"user_id": 0, "message": ""},
        headers={"Authorization": "Bearer xxx"},
    )
    assert r.status_code == 422


def test_order_found():
    r = client.get("/orders/123")
    assert r.status_code == 200
    assert r.json() == {"order_id": 123, "status": "shipped"}


def test_order_not_found():
    r = client.get("/orders/999")
    assert r.status_code == 404
    assert r.json()["detail"] == "订单不存在"


def test_ticket_response_model_filter():
    r = client.post(
        "/tickets",
        json={"user_id": 1, "content": "有问题", "priority": 2},
    )
    assert r.status_code == 200
    assert r.json() == {"ticket_id": 1, "status": "created"}
    assert "user_id" not in r.json()


def test_profile_success():
    r = client.get("/profile", headers={"Authorization": "Bearer secret"})
    assert r.status_code == 200
    assert r.json() == {"token": "Bearer secret"}


def test_profile_invalid():
    r = client.get("/profile", headers={"Authorization": "Bearer wrong"})
    assert r.status_code == 401


def test_api_key_success():
    r = client.get("/secure", headers={"X-API-Key": "my-secret-key"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_api_key_invalid():
    r = client.get("/secure", headers={"X-API-Key": "bad"})
    assert r.status_code == 401


def test_admin_forbidden():
    r = client.get("/admin/ping")
    assert r.status_code == 403


def test_admin_allowed():
    r = client.get("/admin/ping", headers={"x-admin": "true"})
    assert r.status_code == 200
    assert r.json() == {"msg": "admin ok"}


def test_cors_preflight():
    r = client.options(
        "/chat",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
```

运行：

```bash
pytest -q
```

---

## 四、总结串联关系

整体串联关系

你的原代码可以理解为：

``` text

FastAPI 应用
  ├── Pydantic 请求/响应模型
  ├── 认证依赖：API Key、HTTPBearer、Header
  ├── 通用依赖：分页、数据库 yield
  ├── 路由：
  │     ├── /health        Response 改响应头
  │     ├── /chat          response_model 过滤 + 201 + Bearer
  │     ├── /orders/{id}   路径参数 + HTTPException
  │     ├── /tickets       response_model 过滤
  │     ├── /profile       Header 认证
  │     ├── /orders        分页 + 认证 + yield 依赖
  │     └── /admin/ping    中间件权限拦截
  └── 中间件：
        ├── 请求日志
        ├── 耗时统计
        ├── X-Request-ID
        └── /admin 权限拦截
```

这样你就能把零散知识点串成一条完整的 FastAPI 学习链：  
**模型校验 → 依赖注入 → 认证 → 路由处理 → 响应模型过滤 → 中间件增强 → 测试验证**。

---

你的原始代码可以理解成这条链路：

1. `FastAPI()` 创建应用。
2. `ChatRequest` / `TicketRequest` 负责请求体校验。
3. `ChatResponse` / `TicketResponse` 负责响应过滤。
4. `get_api_key`、`get_current_user`、`get_token` 是三种依赖注入。
5. `/health`、`/chat`、`/orders/{order_id}`、`/tickets`、`/profile` 是路由。
6. `HTTPException` 处理业务错误。
7. `add_process_time`、`my_middleware`、`add_header` 是中间件，负责日志、耗时、请求 ID、admin 拦截。
8. `CORSMiddleware` 处理跨域。
9. 测试用例覆盖正常、异常、鉴权、过滤、中间件头、CORS。

这样整理后，每个知识点独立可看，最后又能拼成一个完整可运行、可测试的 FastAPI 小服务。
