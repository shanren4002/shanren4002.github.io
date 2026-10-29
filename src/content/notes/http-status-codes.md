---
title: "HTTP 状态码速查"
slug: http-status-codes
category: "HTTP knowledges"
tags: [HTTP, 后端基础]
date: 2026-09-06
status: published
summary: "五大类 HTTP 状态码速查表与 RESTful 开发中的常见用法"
source: "笔记/HTTP knowledges/状态码.md"
---
很好！**规范化数据返回格式**是后端开发从“能用”走向“专业”的关键一步。而 **HTTP 状态码** 就是规范化的基石——它告诉前端“这次请求到底怎么了”。

HTTP 状态码分为五大类，用 **`1xx`、`2xx`、`3xx`、`4xx`、`5xx`** 表示。在 RESTful API 开发中，最常用的是 **2xx（成功）**、**4xx（客户端错误）** 和 **5xx（服务器错误）**。

---

### 1. 状态码速查表（按分类）

| 分类 | 范围 | 含义 | 典型场景 |
| :--- | :--- | :--- | :--- |
| **1xx (信息)** | 100-199 | 请求已接收，继续处理 | 极少用（如 WebSocket 升级） |
| **2xx (成功)** | 200-299 | 操作被成功接收、理解并处理 | **你的正常业务返回** |
| **3xx (重定向)** | 300-399 | 需要进一步操作（如跳转） | 前端路由、短链接跳转 |
| **4xx (客户端错误)** | 400-499 | 请求有误，是你（前端）的问题 | 参数校验失败、资源不存在 |
| **5xx (服务器错误)** | 500-599 | 服务器内部出错，是我的（后端）问题 | 代码抛出未捕获异常、数据库连不上 |

---

### 2. 你最该重点掌握的 7 个常用状态码

结合你的“笔记知识站”项目，我为你挑出高频使用的 7 个：

| 状态码 | 含义 | 在笔记项目中的典型用法 | FastAPI 实现示例 |
| :--- | :--- | :--- | :--- |
| **200 OK** | 请求成功 | 查询笔记列表、获取单个笔记成功 | `return {"code": 200, "data": ...}` |
| **201 Created** | 创建成功 | 新增笔记成功后返回（特指“资源被创建”） | `return JSONResponse(..., status_code=201)` |
| **204 No Content** | 成功但无返回体 | 删除笔记成功，不需要返回数据时 | `raise HTTPException(status_code=204)` |
| **400 Bad Request** | 请求参数错误 | 前端传了非法 JSON 格式、字段缺失 | `raise HTTPException(status_code=400)` |
| **401 Unauthorized** | 未认证 | 用户没有登录，或 Token 过期 | （后续加鉴权时用） |
| **403 Forbidden** | 无权限 | 用户登录了，但没权限删除别人的笔记 | （后续加权限时用） |
| **404 Not Found** | 资源不存在 | 查询一个不存在的 `note_id` | `raise HTTPException(status_code=404)` |
| **422 Unprocessable Entity** | 参数校验失败（语义错误） | Pydantic 模型校验未通过（如类型错误、长度不足） | **FastAPI 自动抛出的默认异常** |

---

### 3. 最重要的一个特殊码：422（FastAPI 的“护城河”）

当你用 `BaseModel` 做请求体校验时，比如：

```python
class Note(BaseModel):
    title: str = Field(..., min_length=2)
    summary: str
```

如果前端传了 `{"title": "A"}`（长度不足），FastAPI **不会**返回 400，而是**自动返回 422**，并在 body 里详细说明哪个字段错在哪。

所以你的后端中，**422 由框架处理，你几乎不需要手动抛出**。

---

### 4. 实战重构：结合你的数据返回格式

既然你在“规范数据返回格式”，我建议你在 FastAPI 中**统一使用 `HTTPException`** 或 **`JSONResponse`** 来设定状态码，而不是全都混在返回字典里。

**推荐写法一（基础，用 `HTTPException`）：**
```python
from fastapi import HTTPException

@app.get("/notes/{note_id}")
async def get_note(note_id: int):
    for note in note_list:
        if note["id"] == note_id:
            return {"code": 200, "msg": "获取成功", "data": note}
    # 使用 HTTPException 返回标准 404
    raise HTTPException(status_code=404, detail="笔记不存在")
```

**推荐写法二（进阶，自定义返回体格式 + 状态码）：**
```python
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

@app.post("/note", status_code=status.HTTP_201_CREATED)
async def create_note(note: Note):
    # ... 业务逻辑
    # 直接返回 201
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"code": 201, "msg": "创建成功", "data": new_note}
    )
```

---

### 5. 给新手的“状态码选择口诀”

- **查询（GET）成功** → `200`
- **新增（POST）成功** → `201`（也可以 `200`，但 `201` 更规范）
- **删除（DELETE）成功** → `204`（无返回体）或 `200`（返回成功信息）
- **业务正常但没找到数据** → `404`
- **前端传的 JSON 格式错了** → `400`
- **前端传的数据符合 JSON 但规则不符（如标题太短）** → `422`（自动的，省心）
- **代码突然报错（如读取文件失败）** → `500`（框架兜底返回）

---
