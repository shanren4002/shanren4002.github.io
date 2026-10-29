---
title: "请求体编写与参数认证"
slug: fastapi-request-body
category: "FastAPI"
tags: [FastAPI, Pydantic]
date: 2026-08-29
status: published
summary: "用 Pydantic BaseModel 定义请求体与 Query 参数认证入门"
source: "笔记/FastAPI/Fast API请求体，参数认证.md"
---
**作用 ：为解决 *参数明文*、 *大量参数* 问题
### *单一值 → 查询参数；复杂结构 → 请求体*
# 一、请求体编写

	```
		# 规定请求体数据类型  
		#需要引入 BaseModel
		from pydantic import BaseModel  
		# 创建需要定义的 类 及其 数据类型
		class User(BaseModel):  
		    username: str  
		    password: str | None # 增设默认值（可为空）  
		    age: int = 18 # 增设默认值（规定内容）  
		  
		@app.post("/users3")  
		async def create_users(user: User):  
		    return {"user": user}
	```



# 二、请求参数认证
	1、类型注解
		```
			[参数]: [数据类型]
		```
	
	2、Query方式
		- 需导入 Query 模块
		- 校验类型，由**类型注解**确认
		- 了解 Query（）方法参数
		```
			# Query 认证  
			import uvicorn  
			
			from fastapi import FastAPI, Query  
			
			app = FastAPI()  
			  
			@app.get("/query_test1")  
			def query_test1(username: str = Query(None)):  
			    """ Query 认证，校验类型： str ，传递数据：默认值(None) """  
			    return {"username": username}  
			@app.get("/query_test2")  
			def query_test2(username: int = Query(...)):  
			    """ 传递数据：必须传递 """    return {"username": username}  
			@app.get("/query_test3")  
			def query_test3(username: str = Query(...,min_length=3,max_length=5)):  
			    """ 传递数据：必须传递+数据长度限制 """    return {"username": username}  
			@app.get("/query_test4")  
			def query_test4(username: int = Query(...,gt=0,lt=100)):  
			    """ 传递数据：必须传递 + 限制数据大小（eg：int类型，则为0-100的数字）"""  
			    return {"username": username}  
			@app.get("/query_test5")  
			def query_test5(username: str = Query(...,alias="用户名")):  
			    """ 传递数据：必须传递 + 修改参数名称 """    return {"username": username}  
			@app.get("/query_test6")  
			def query_test6(username:str = Query(...,description="This is '说明' username ")):  
			    """ 传递数据：必须传递+接口说明 """    return{"username": username}  
			@app.get("/query_test7")  
			def query_test7(username:str=Query(...,regex='^a\d{2}$')):  
			    """ 传递数据：必须传递+正则匹配 """    return {"username": username}  
			if __name__ == "__main__":  
			    uvicorn.run(app, host="127.0.0.1", port=8000)
		```
		
	3、Path方式
		```
			#Path 认证  
			
			from fastapi import Path
			
			class selet_1(str, Enum):  
			    a="a",  
			    b="b",  
			    c="c",  
			    d="d",  
			    e="e"  
			@app.get("/path_test1/{selet}")  
			def path_test1(selet:selet_1):  
			    return {"selet": selet}  
			  
			@app.get("/path_test2/{id}")  
			def path_test2(id:int = Path(...,ge=90,t=200)):  
			    return {"id": id}  
			  
			@app.get("/path_test3/{id}")  
			def path_test3(id:str = Path(...,regex='^2\d{2}$')):  
			    return {"id": id}
		```
	
	4、Filed 方式
		```
			# Field 认证 ：1、导入 Field 模块 from pydantic 
			import Field 2、在类中使用Field（）方法  
			import uvicorn  
			from pydantic import Field, BaseModel, field_validator  
			from fastapi import FastAPI  
			from enum import Enum  
			app = FastAPI()  
			  
			""" 例1 """  
			class Field_1(BaseModel):  
			    #name 和 neme2 等价  
			    name: str = Field(default="Joy")  
			    name2: str = Field("Joy")  
			    name3: str = Field(None)  
			    age: int = Field(...)  
			@app.post("/field1")  
			def field1(user : Field_1):  
			    return {"user": user}  
			  
			""" 例2 """  
			class Field_2(BaseModel):  
			    price: float = Field(...,gt=0,lt=100,description="Price")  
			@app.post("/field2")  
			def field2(priced : Field_2):  
			    return {"price": priced}  
			  
			""" 例3 """  
			class Field_3(BaseModel):  
			    username: str = Field(...,min_length=2,max_length=5)  
			    password: str = Field(...,pattern=r'\w{6,}$')  
			@app.post("/field3")  
			def field3(user: Field_3):  
			    return {"user": user}  
			  
			""" 例4 """  
			class Field_4(BaseModel):  
			    name : str = Field(...,  
			                       title="shop name",  
			                       description="this is shop name",  
			                       examples=["mouse"])  
			@app.post("/field4")  
			def field4(user: Field_4):  
			    return {"user": user}  
			  
			""" 例5 """  
			class Field_5(BaseModel):  
			    email: str  
			    @field_validator("email")  
			    def validate_email(cls,v):  
			        if "@" not in v:  
			            raise ValueError("email is not valid")  
			        return v  
			@app.post("/field5")  
			def field5(user: Field_5):  
			    return {"user": user}  
			  
			""" 例6 """  
			class Field_6 (BaseModel):  
			    items: list = Field(..., min_length=1)  
			    address: str = Field (..., description="address")  
			@app.post('/field6/')  
			def field6 (order: Field_6):  
			    return order  
			  
			""" 例7 """  
			class Status(str, Enum):  
			    ACTIVE = 'active'  
			    INACTIVE = 'inactive'  
			class Task(BaseModel):  
			    status: Status = Field (default=Status.ACTIVE)  
			    id: int = Field(...,description="task id")  
			@app.post('/tasks/')  
			def get_task(task: Task):  
			    return task  
			  
			if __name__ == "__main__":  
			    uvicorn.run(app="fied_confi:app", host="127.0.0.1", port=8000, reload=True)`
		```
