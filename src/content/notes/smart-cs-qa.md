---
title: "智能客服问答要点"
slug: smart-cs-qa
category: "智能客服"
tags: [FastAPI, Pydantic, 智能客服]
date: 2026-09-21
status: published
summary: "嵌套模型、响应模型、状态码与错误处理的 FastAPI 问答整理"
source: "笔记/FastAPI/智能客服/智能客服问答.md"
---
``` python

#嵌套模型
class OrderItem(BaseModel):
    name: str
    count: int

class Order(BaseModel):
    order_id: str
    items: list[OrderItem]

@app.post("/orders")
async def create_order(order: Order):
    return order
    
#响应模型  会自动过滤多余字段，保证返回结构稳定
class ChatResponse(BaseModel):  
    reply:str | None = "reply"  
    session_id:str | None = "session_id"  
  
@app.post("/chat",response_model=ChatResponse)  
async def chat(req:ChatRequest,):  
    return {"reply":"收到","session_id":req.session_id or "new"}  
  
#状态码和响应头 (不太理解)  
@app.post("/chat1",status_code=status.HTTP_201_CREATED)  
async def chat1(req:ChatRequest,):  
    return {"reply":"ok"}  
  
#自定义响应头  
@app.get("/ping")  
async def ping(response:Response):  
    response.headers["X-App"] = "smart-cs"  
    return {"ping":True}  
  
#错误处理  
from fastapi import HTTPException  
@app.get("orders/{order_id}")  
async def get_order(order_id:int):  
    if order_id <= 0:  
        raise HTTPException(status_code=400,detail="订单 ID 必须大于 0")  
    if order_id == 999:  
        raise HTTPException(status_code=404,detail="订单不存在")  
    return {"order_id":order_id}  
  
#自定义异常处理器  
from  fastapi import  Request  
from fastapi.responses import JSONResponse  
class LLMTimeoutError(Exception):  
    pass  
@app.exception_handler(LLMTimeoutError)  
async def llm_timeout_handler(request:Request,exc:LLMTimeoutError):  
    return JSONResponse(  
        status_code=504,  
        content={"detail":"LLM 响应超时"}  
    )  
  
#依赖注入（重点）  
from fastapi import Depends,Header  
async  def get_current_user(authorization: str = Header(...),):  
    if not authorization.startswith("Bearer") :  
        raise HTTPException(status_code=401,detail="未认证")  
    token = authorization.replace("Bearer","")  
    if token != "secret-token":  
        raise  HTTPException(status_code=401,detail="Token 无效")  
    return {"user_id":1,"name":"张三"}  
@app.get("/me")  
async def read_me(user: dict = Depends(get_current_user)):  
    return user  
  
#依赖可以嵌套  
async def get_db():  
    db = "fake_db"  
    try:  
        yield db  
    finally:  
        print("db closed")  
@app.get("/orders")  
async def list_orders(db=Depends(get_db),user=Depends(get_current_user)):  
    return {"db":db,"user":user}  
  
#中间件  
import  time  
@app.middleware("http")  
async def add_process_time(request: Request,call_next):  
    start_time = time.time()  
    response = await call_next(request)  
    response.headers["X-Process-Time"] = str(time.time() - start_time)  
    return response  
  
#CORS  
from fastapi.middleware.cors import CORSMiddleware  
  
app.add_middleware(  
    CORSMiddleware,  
    allow_origins=["http://localhost:3000"],  
    allow_credentials=True,  
    allow_methods=["*"],  
    allow_headers=["*"],  
)
    
```



好，出一套题。分四部分：**概念判断 → 代码改错 → 动手写 → 场景设计**。  
做完发我，我逐题批改。不要翻前面的内容，闭卷做。

---

# 第一部分：概念判断（每题说明对错 + 为什么）

**1.** 加了 `response_model=ChatResponse` 后，如果接口返回的字典里多了一个 `password` 字段，FastAPI 会报 500 错误。

**2.** `status_code=status.HTTP_201_CREATED` 写在 `@app.post` 装饰器里，作用是让接口返回 201，但 Response body 还是自己 return 的内容。

**3.** 响应头只能通过 `Response` 对象设置，写在 `return` 的字典里没用。

**4.** `raise HTTPException(status_code=404, detail="订单不存在")` 执行后，接口函数后面的代码还会继续执行。

**5.** 依赖注入 `Depends(get_api_key)` 中，`get_api_key` 的返回值会自动传给接口函数的对应参数。

**6.** 用户传了 `user_id: 0`，而模型里写的是 `Field(..., gt=0)`，FastAPI 会返回 500。

**7.** 中间件里 `call_next(request)` 之后的代码，是在接口函数执行完之后才执行的。

**8.** 一个接口函数可以同时挂 `@app.get` 和 `@app.post` 两个装饰器，且都能正常工作。

---

# 第二部分：代码改错（指出错误 + 改正）

**9.** 下面代码想实现：GET `/orders/123` 返回订单，订单不存在返回 404。找出所有问题。

```python
@app.get("/orders")
async def get_order(order_id: int):
    if order_id == 999:
        return {"detail": "订单不存在"}
    return {"order_id": order_id}
```

**10.** 下面代码想实现：POST `/chat` 必须带 `x-api-key: my-key`，否则 401。找出所有问题。

```python
async def get_api_key(x_api_key: str = Header()):
    if x_api_key != "my-key":
        raise HTTPException(status_code=401)
    return x_api_key

@app.post("/chat")
async def chat(req: ChatRequest):
    return {"reply": "ok"}
```

**11.** 下面代码想实现：返回用户信息时过滤掉 `password`。找出问题。

```python
class UserOut(BaseModel):
    user_id: int
    name: str

@app.get("/user")
async def get_user():
    return {"user_id": 1, "name": "张三", "password": "123"}
```

**12.** 下面代码想给每个响应加 `X-App: smart-cs` 响应头。找出问题。

```python
@app.get("/ping")
async def ping():
    return {"pong": True, "headers": {"X-App": "smart-cs"}}
```

---

# 第三部分：动手写

**13.** 写一个 `POST /tickets` 接口：

- 请求体 `TicketRequest`：`user_id: int`（必须 >0）、`content: str`（1-1000 字）、`priority: int`（默认 1，1-5）
- 返回 `TicketResponse`：`ticket_id: str`、`status: str`
- 状态码 201
- 不需要认证

**14.** 写一个依赖 `get_token`：

- 从 Header 读 `authorization`
- 要求格式 `Bearer xxx`
- 如果格式不对或不是 `Bearer secret`，抛 401
- 返回 token 字符串
- 然后写一个 `GET /profile` 接口，用这个依赖，返回 `{"token": token}`

**15.** 写一个中间件：

- 记录每个请求的方法、路径、状态码、耗时
- 把耗时写到响应头 `X-Process-Time`
- 打印到控制台

---

# 第四部分：场景设计（不用写完整代码，说思路）

**16.** 智能客服里，用户发消息 `POST /chat`。要求：

- 必须登录（带 token）
- 消息不能为空
- 返回的 JSON 不能包含内部字段 `debug_info`
- 如果 LLM 超时，返回 504
- 每个请求记录耗时

请说明：每个需求分别用什么 FastAPI 特性实现？为什么？

**17.** 你有 10 个接口都需要认证，20 个接口都需要数据库会话。  
如果不用依赖注入，会有什么问题？用依赖注入怎么解决？

---



做完发我，格式随意，标清题号即可。  
我会逐题批改，重点看你对 **response_model、状态码、错误处理、依赖注入** 的理解。

第一部分
1、错，只是会限制不返回给用户。2、对。3、不懂，应该不是没用。4、错，raise抛出就不会执行。5、对。6、错，返回422，参数错误。7、错，request是执行前，response才是执行后。8、错，原因应该和冲突有关（解释一下）

第二部分
9、- 没用加路径参数{order_id}。 - 要想返回404，加入raise HTTPException(status_code=404, detail="订单不存在")
10、- 使用依赖注入，Depends(get_api_key)
11、没有使用中间件，需要在装饰器中使用，response_model=UserOut
12、加入响应头不是在return中添加，而是创建Response对象，调用headers["X-App"] = "smart-cs"

第三部分

13、接口
class TicketRequest(BaseModel):
    user_id: int = Field(..., gt=0)
    content: str = Field(..., min_length=1, max_length=100)
    priority: int = Field(default=1,ge=1,le=5)

class TicketResponse(BaseModel):
    ticket_id: int
    status: str
@app.post("/tickets",response_model=TicketResponse)
async def create_ticket(req:TicketRequest):
    return {
        "user_id": req.user_id,
        "ticket_id":1,
        "status":"created",
    }

14、依赖
async def get_token(authorization :str = Header(...)):
    if authorization != "Bearer secret":
         raise HTTPException(status_code=401,detail="error")
    return authorization  
@app.get("/profile")
async def get_profile(token : str = Depends(get_token)):
    return {
        "token" :token
    }

15、中间件 
from fastapi import Request 
import  time  
@app.middleware("http")  
async def add_process_time(request: Request,call_next):  
    start_time = time.time()  
    response = await call_next(request)  
    response.headers["X-Process-Time"] = str(time.time() - start_time)  
    return response  

16、- 必须登录（带token）这个不知道。 -消息不能为空：使用File(...)做必填限制。- 返回的JSON不包含内部字段：可以使用response_model做返回字段的定制。 - 如果LLM超时：使用错误处理，raise HTTPException（status_code=504）。- 记录请求耗时，加入中间件
17、重复代码，程序臃肿。定义公共方法，调用即可。
这个中间件和依赖还是不要会用，特别是这中间件
