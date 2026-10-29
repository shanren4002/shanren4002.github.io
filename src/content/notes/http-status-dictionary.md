---
title: "HTTP 状态码字典"
slug: http-status-dictionary
category: "HTTP knowledges"
tags: [HTTP, 后端基础]
date: 2026-09-07
status: draft
summary: "完整 HTTP 状态码字典：按分类逐条查阅含义与典型场景"
source: "笔记/HTTP knowledges/状态码字典.md"
---
好，我帮你整理一份 **HTTP 状态码速查手册**，按分类组织，附带 FastAPI 中的使用场景和示例代码。你可以把它当作字典来查。

---

## 📘 HTTP 状态码速查手册（FastAPI 专用）

### 符号说明
- ⭐：**最常用**，必须掌握
- 🔧：需要手动实现
- 🤖：FastAPI 自动处理

---

## 1️⃣ 信息响应（1xx）
| 状态码 | 含义 | FastAPI 中的使用 | 备注 |
| :--- | :--- | :--- | :--- |
| 100 Continue | 请求头已收到，客户端应继续发送 | 极少使用 | WebSocket 升级时可能用到 |
| 101 Switching Protocols | 切换协议（如 WebSocket） | `WebSocket` 路由自动处理 | 不常用 |

---

## 2️⃣ 成功响应（2xx）
| 状态码 | 含义 | FastAPI 使用场景 | 示例代码 |
| :--- | :--- | :--- | :--- |
| **⭐ 200 OK** | 请求成功 | GET 查询、PUT 更新、DELETE 删除（带返回体） | `return {"code": 200, "data": ...}` |
| **⭐ 201 Created** | 资源创建成功 | POST 新增笔记、上传文件后返回 | `raise HTTPException(status_code=201)` 或 `JSONResponse(..., status_code=201)` |
| **⭐ 204 No Content** | 成功但无返回体 | DELETE 删除成功，不需要返回数据 | `raise HTTPException(status_code=204)` |
| 202 Accepted | 请求已接受，但未处理完成 | 异步任务（如发邮件） | 适合后台任务接口 |
| 203 Non-Authoritative Info | 代理返回的信息 | 几乎不用 | - |
| 205 Reset Content | 重置表单 | 配合前端清空表单 | 不常用 |
| 206 Partial Content | 部分内容（断点续传） | 大文件下载 | 不常用 |

---

## 3️⃣ 重定向（3xx）
| 状态码 | 含义 | FastAPI 使用场景 | 示例代码 |
| :--- | :--- | :--- | :--- |
| 301 Moved Permanently | 永久重定向 | 接口地址变更 | `RedirectResponse(url="/new-url", status_code=301)` |
| 302 Found | 临时重定向 | 登录跳转 | `RedirectResponse(url="/login", status_code=302)` |
| 304 Not Modified | 资源未修改（缓存） | 静态资源 | 不常用 |

---

## 4️⃣ 客户端错误（4xx）—— 重点掌握
| 状态码 | 含义 | FastAPI 使用场景 | 示例代码 |
| :--- | :--- | :--- | :--- |
| **⭐ 400 Bad Request** | 请求参数错误 | JSON 格式错误、字段缺失、业务逻辑校验失败 | `raise HTTPException(status_code=400, detail="参数错误")` |
| **⭐ 401 Unauthorized** | 未认证（未登录） | Token 缺失或无效 | 后续添加 JWT 鉴权时使用 |
| **⭐ 403 Forbidden** | 无权限 | 登录了但无权操作（如删除他人笔记） | `raise HTTPException(status_code=403, detail="无权限")` |
| **⭐ 404 Not Found** | 资源不存在 | 查询不存在的 note_id | `raise HTTPException(status_code=404, detail="笔记不存在")` |
| **⭐ 🤖 422 Unprocessable Entity** | 参数校验失败 | Pydantic 模型校验失败（如类型错、长度不足） | **无需手动抛出，FastAPI 自动处理** |
| 405 Method Not Allowed | 方法不允许 | GET 请求发到了 POST 路由 | 框架自动处理 |
| 406 Not Acceptable | 不可接受（内容类型不符） | 很少使用 | - |
| 408 Request Timeout | 请求超时 | 服务器端超时配置 | 不常用 |
| 409 Conflict | 资源冲突 | 如重复创建同名资源 | `raise HTTPException(status_code=409, detail="标题已存在")` |
| 410 Gone | 资源已永久删除 | 与 404 类似，但表示曾经存在 | 不常用 |
| 413 Payload Too Large | 请求体过大 | 文件超过大小限制 | 可主动抛出 |
| 415 Unsupported Media Type | 不支持的媒体类型 | 上传了不支持的格式 | `raise HTTPException(status_code=415, detail="不支持的文件类型")` |
| 429 Too Many Requests | 请求过多（限流） | 接口限流 | 高级功能 |

---

## 5️⃣ 服务器错误（5xx）
| 状态码                             | 含义           | FastAPI 使用场景   | 示例代码              |
| :------------------------------ | :----------- | :------------- | :---------------- |
| **⭐ 500 Internal Server Error** | 服务器内部错误      | 未捕获的异常、数据库连接失败 | **框架自动返回，无需手动抛出** |
| 501 Not Implemented             | 未实现          | 接口未开发完成        | 可临时返回             |
| 502 Bad Gateway                 | 网关错误         | 反向代理后端失效       | 通常由 Nginx 等返回     |
| 503 Service Unavailable         | 服务不可用（过载/维护） | 主动关闭服务         | 可用于熔断降级           |
| 504 Gateway Timeout             | 网关超时         | 上游服务响应太慢       | 通常由 Nginx 等返回     |

---

## ✅ 你的 FastAPI 项目中最常用的组合（决策路径）

### 查询数据（GET）
- 成功 → `200`
- 未找到 → `404`
- 参数错误（如 id 不是数字）→ `422`（自动）

### 创建数据（POST）
- 成功 → `201`
- 参数校验失败 → `422`（自动）
- 业务冲突（如标题已存在）→ `409`

### 更新数据（PUT/PATCH）
- 成功 → `200`
- 资源不存在 → `404`
- 参数错误 → `400` 或 `422`

### 删除数据（DELETE）
- 成功 → `204`（无返回体）或 `200`（带成功信息）
- 资源不存在 → `404`

### 文件上传
- 成功 → `200` 或 `201`
- 文件格式不支持 → `415`
- 文件过大 → `413`

---

## 📌 FastAPI 中如何正确设置状态码

**方式一：在装饰器中指定默认状态码**
```python
@app.post("/note", status_code=201)
async def create_note(note: Note):
    return {"code": 201, "msg": "创建成功"}
```

**方式二：抛出 HTTPException（推荐用于错误）**
```python
from fastapi import HTTPException

@app.get("/notes/{id}")
async def get_note(id: int):
    note = find_note(id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"code": 200, "data": note}
```

**方式三：返回 JSONResponse（灵活控制）**
```python
from fastapi.responses import JSONResponse

@app.post("/note")
async def create_note(note: Note):
    # 成功返回 201
    return JSONResponse(
        status_code=201,
        content={"code": 201, "msg": "创建成功", "data": new_note}
    )
```

---
