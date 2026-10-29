---
title: "创建第一个 FastAPI 接口"
slug: fastapi-first-app
category: "FastAPI"
tags: [FastAPI, 入门]
date: 2026-08-27
status: draft
summary: "FastAPI 环境配置、第一个接口编写与程序启动方式"
source: "笔记/FastAPI/创建第一个接口和程序启动.md"
---
# 一、环境配置
1.安装Fast API
- 一键安装
  ```
  pip install "fasterapi[standard]"
  ```

- 指定版本安装
  ```
  pip install fastapi == 版本号
  pip install uvicorn == 版本号
  ```

2.验证Fast API
- 输入命令，查看是否包含 **fastapi**、**uvicorn**
  ```
  python list
  ```

# 二、创建第一个Fast API程序

1、编写程序
```
#导入FastAPI  
from fastapi import FastAPI  
  
#创建Fast AP i对象  
app = FastAPI()  
  
#创建一个 get 服务  
@app.get("/")  
def read_root():  
     return {  
        "message": "Hello World"  
     }
```

2、 启动Fast API程序
- 通过命令（cmd）
  ```
  uvicorn file_name:app_name --reload #reload作用：修改代码后自动重载
  ```

- 通过调试（cmd）
  ```
  fastapi dev file_name.py  
  
  #可能需要安装fastapi[standard]
  pip install fastapi[standard]
  ```

- 通过程序启动
  ```
  if __name__ == "__main__":  
	# 第一种，string＋reload （可单独创建一个文件作为启动文件）
    uvicorn.run("test:app",host="127.0.0.1",port=8000,reload=True)
    
    #第二种， 程序名称-reload （FastAPI程序中使用）
    uvicorn.run(app,host="127.0.0.1",port=8000) 
  ```
  
- 代码学习
 1. `if __name__ == "__main__":` 是什么意思？
	这是 Python 中一个非常经典的习惯用法，它的作用是：
	**判断当前文件是“被直接运行”还是“被当成模块导入”。**
	- `__name__` 是 Python 内置的变量。
	    
	- 当你**直接运行**这个文件时（比如在终端执行 `python main.py`），Python 会把 `__name__` 自动设置为 `"__main__"`，因此该判断条件成立，`if` 里面的代码会执行。
	    
	- 当这个文件被**别的文件导入**时（比如 `import main`），Python 会把 `__name__` 设置为模块名 `"main"`，条件不成立，`if` 里面的代码不会执行。
