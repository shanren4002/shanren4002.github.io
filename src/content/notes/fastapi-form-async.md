---
title: "表单数据与异步"
slug: fastapi-form-async
category: "FastAPI"
tags: [FastAPI, async]
date: 2026-08-29
status: draft
summary: "Form 表单数据三种用法与同步/异步接口的执行机制"
source: "笔记/FastAPI/FastAPI 表单数据、异步.md"
---
# 一、表单数据
	1、从 fastapi 中导入 Form
	2、使用方法
	- 与 Quer（）、Path（）使用方法一致
	  ```
		    from fastapi import FastAPI,Form  
			app = FastAPI()  
			
			@app.post("/field")  
			def field(user: str = Form(...)):  
			    return {"user": user}
	  ```
	- 结合 请求体 使用。
		- 需要从 typing 中导入 Annotated 方法
		```
			from fastapi import FastAPI,Form  
			from pydantic import BaseModel  
			from typing import Annotated
			
			class User1(BaseModel):  
			    name: str  
			    age: int  
			@app.post("/user")  
			def user(user: Annotated[User1,Form()]):  
			    return {"user": user}
		```

# 二、异步
* **同步 (`def`)**：FastAPI 把它丢给**线程池**（找兼职干），主通道不堵。适合**CPU重活**（计算、图像处理）。
    
- **异步 (`async def`)**：在主通道（事件循环）运行，遇到 `await` 就**让出控制权**去接待别人。适合**网络IO等待**（查库、调API）。
```
	import asyncio
	import time
	from fastapi import FastAPI
	import uvicorn
	
	app = FastAPI()
	
	# ==================== 1. 同步接口（线程池模式）====================
	@app.get("/sync")
	def sync_endpoint():
	    """
	    同步执行：FastAPI 把任务扔给线程池。
	    虽然 time.sleep(5) 会阻塞当前线程，但不会阻塞事件循环。
	    这意味着：当这个接口在等待时，其他异步接口（如 /async_good）不会被卡住。
	    """
	    print(f"同步接口开始，线程ID: {threading.get_ident()}")  # 需要 import threading
	    time.sleep(5)  # 模拟耗时操作（如读取大文件、复杂计算）
	    return {"message": "同步任务完成，耗时 5 秒"}
	
	# ==================== 2. 异步接口（正确写法）====================
	@app.get("/async_good")
	async def async_good_endpoint():
	    """
	    异步执行：遇到 await asyncio.sleep(5) 时，立刻让出 CPU。
	    这 5 秒内，服务器可以处理几百个其他请求，等 5 秒到了再回来继续。
	    """
	    print(f"异步接口开始，我要去等待了...")
	    await asyncio.sleep(5)  # 模拟非阻塞 IO（如请求第三方 API、读数据库）
	    return {"message": "异步任务完成，耗时 5 秒（非阻塞）"}
	
	# ==================== 3. 异步接口（致命错误写法）====================
	@app.get("/async_bad")
	async def async_bad_endpoint():
	    """
	    ⚠️ 警告：在 async def 里使用 time.sleep() 会导致灾难！
	    这 5 秒内，整个服务器（包括 /health 健康检查）都会被冻住。
	    """
	    print("危险操作！我要卡死事件循环了...")
	    time.sleep(5)  # ❌ 这是同步阻塞，会卡死整个服务器！！！
	    return {"message": "异步接口里的同步阻塞，我干了坏事"}
	
	# ==================== 4. 极速健康检查（用来测试卡顿）====================
	@app.get("/health")
	async def health_check():
	    """这个接口用来测试服务器是否被卡住。如果被卡，它会返回得很慢。"""
	    return {"status": "alive"}
	
	
	if __name__ == "__main__":
	    import threading  # 用于打印线程 ID
	    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
```
