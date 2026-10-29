---
title: "路径参数与查询参数"
slug: fastapi-path-query-params
category: "FastAPI"
tags: [FastAPI]
date: 2026-08-27
status: published
summary: "路径参数的类型规定与查询参数的有无类型两种写法"
source: "笔记/FastAPI/FastAP路径，查询参数.md"
---
# 一、路径参数
*指定义在 URL 路径模板中的**动态占位符**，用于从请求地址中精准捕获并提取特定资源的唯一标识符（如 ID、名称等），并将其作为函数入参传递给后端处理器，从而实现对指定资源的定向检索与操作。*

1、路径参数用法
```
from fastapi import FastAPI  
app = FastAPI()  
  
"""  
    - 路由参数 "/user/{user_id}"- 允许多个参数 eg："/user/{user_id}/{name}"  
        - 允许固定参数 eg："/user/1"  
    - 规定接收参数类型 user_id: int
"""  

@app.get("/user/{user_id}")  
def read_user_id(user_id: int):  
    return {"user_id": user_id}
    
if __name__ == "__main__":
	uvicorn.run("test:app",host="127.0.0.1",port=8000,reload=True)
```

# 二、查询参数
*查询参数（Query Parameters）是指附加在 URL 路径末端问号（?）之后，以键值对（key=value）形式拼接的**非必需参数**（多个参数间用 & 分隔），主要用于对资源集合进行**过滤（Filtering）**、**分页（Pagination）**、排序（Sorting）或指定输出格式，它们不影响资源的唯一标识定位，而是用于修饰或控制返回数据的范围与表现形式。*

1、查询接口编写
-  无类型规定
  ```
  @app.get("/query1")  
  def read_ques(page , limit ):  
    return {"page": page, "limit": limit}
  ```
  
-  规定查询参数类型
```
@app.get("/query2")  
def read_ques2(page: int, limit = None):  
    if limit:  
        return {"page": page, "limit": limit}  
    else:  
        return {"page": page}
```

-  占位符+查询参数 ``localhost/qurey/[参数数据]?[查询参数]=[数据]
  ```
  @app.get("/query3/{page}")  
  def read_ques3(page: int, limit = None):  
    if limit:  
        return {"page": page, "limit": limit}  
    else:  
        return {"page": page}
  ```


2、查询接口使用
-  url 输入
	- 无参数报错
	
	- 传参后的返回值
		- 查询格式:：``  localhost/query/?[参数1名]=[数据]&[参数2名][数据]
		


-  "**localhost/docs** " FastAPi自带测试
	-  可交互的调试工作台
		- 功能介绍
			- **default**：记录运行的文件中的所有接口
			- Parameters：代替在URL中编写参数
			- Responses：查看返回信息
	- 测试结果
