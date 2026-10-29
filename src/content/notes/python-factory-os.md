---
title: "Python 工厂模式与 os 标准库"
slug: python-factory-os
category: "Python"
tags: [Python, 设计模式]
date: 2026-09-27
status: published
summary: "从生活类比理解工厂模式，串联函数类型与 os 常用操作"
source: "笔记/Python/Python中的工厂、os.md"
---
这三个问题串起来正好是一条完整的知识线：从设计模式 → 函数类型 → 常用标准库。我逐个讲透。

---

## 一、什么是工厂、工厂模式、工厂函数？

### 1. 用生活类比理解"工厂"

现实中的工厂：**你告诉工厂"我要一辆 SUV"，工厂根据订单生产出来给你，你不需要知道它怎么焊接、怎么喷漆。**

编程中的工厂：**你告诉工厂函数"我要一个 LLM 对象"，工厂函数根据配置创建并返回给你，你不需要知道它内部怎么初始化、用什么密钥、连什么地址。**

### 2. 什么是"工厂模式"（Factory Pattern）

工厂模式是一种**创建型设计模式**，核心思想是：

> **把"对象的创建过程"封装起来，让调用方只关心"我要什么"，不关心"怎么造"。**

它解决的问题是：当创建对象的逻辑变得复杂（需要读配置、判断条件、设默认值、加缓存），如果每个调用方都自己写一遍创建代码，就会大量重复，且改一处要改很多地方。

**工厂模式把创建逻辑集中到一个地方**，调用方只需要调用工厂函数。

### 3. 工厂函数 vs 普通函数

| 对比 | 普通函数 | 工厂函数 |
| :--- | :--- | :--- |
| **返回值** | 通常是计算结果（数字、字符串、列表等） | **返回一个对象实例** |
| **目的** | 计算、处理数据 | **创建对象** |
| **例子** | `sum([1,2,3])` 返回 `6` | `get_llm()` 返回 `ChatOpenAI` 实例 |
| **典型名字** | `calculate`、`parse`、`format` | `create_xxx`、`get_xxx`、`make_xxx`、`build_xxx` |

**举个对比**：

```python
# 普通函数：计算两数之和，返回数字
def add(a, b):
    return a + b

result = add(1, 2)   # result = 3

# 工厂函数：根据条件创建对象，返回实例
def get_llm(provider="deepseek"):
    cfg = PROVIDERS[provider]
    return ChatOpenAI(model=cfg["model"], api_key=..., ...)

llm = get_llm("deepseek")   # llm 是一个 ChatOpenAI 对象
```

---

## 二、工厂函数是怎么"调用"和"返回"的？

你问得很好：普通函数调用时填参数，直接返回结果。工厂函数其实**结构一样**，只是"参数"和"返回值"的语义不同。

### 普通函数的调用流程

```python
def add(a, b):        # 参数：要相加的两个数
    return a + b      # 返回：计算结果

result = add(1, 2)    # 传入 1 和 2，得到 3
```

- **参数**：参与计算的数据
- **返回**：计算得到的结果

### 工厂函数的调用流程

```python
def get_llm(provider="deepseek"):    # 参数：你要哪种 LLM
    cfg = PROVIDERS[provider]
    api_key = os.getenv(cfg["api_key_env"])
    return ChatOpenAI(               # 返回：创建好的对象
        model=cfg["model"],
        api_key=api_key,
        base_url=cfg["base_url"],
    )

llm = get_llm("siliconflow")         # 传入"我要硅基流动"，得到一个可用的 LLM 对象
resp = llm.invoke("你好")            # 拿到对象后，调用它的方法
```

- **参数**：描述"我要什么样的对象"
- **返回**：创建好的对象实例（可以继续调用它的方法）

**核心区别**：普通函数返回"数据"，工厂函数返回"对象"。但调用形式完全一样——都是 `函数名(参数)`。

### 工厂函数内部可以做的"额外事情"

因为创建对象的过程被封装了，工厂函数可以在返回之前做很多事：

```python
def get_llm(provider="deepseek"):
    # 1. 读配置
    cfg = PROVIDERS[provider]
    
    # 2. 校验环境变量
    api_key = os.getenv(cfg["api_key_env"])
    if not api_key:
        raise ValueError(f"缺少环境变量 {cfg['api_key_env']}")
    
    # 3. 打印日志
    print(f"[LLM] 使用 provider={provider}, model={cfg['model']}")
    
    # 4. 创建对象
    llm = ChatOpenAI(...)
    
    # 5. 返回
    return llm
```

这些逻辑如果散落在每个调用方，会重复很多次。封装到工厂里，调用方只需要一行 `get_llm("deepseek")`。

---

## 三、`os` 模块详解

`os` 是 Python 的**标准库**，全称 Operating System。它提供了**与操作系统交互**的接口，让你用 Python 代码操作文件、目录、环境变量、进程等。

### 1. `os` 常用功能分类

#### （1）环境变量操作（你最常用的）

```python
import os

os.getenv("DEEPSEEK_API_KEY")           # 读取环境变量，不存在返回 None
os.getenv("PORT", "8000")               # 读取环境变量，不存在返回默认值 "8000"
os.environ["MY_VAR"]                    # 读取环境变量，不存在会报 KeyError
os.environ["MY_VAR"] = "value"          # 设置环境变量（仅当前进程有效）
"MY_VAR" in os.environ                  # 判断环境变量是否存在
```

**为什么用环境变量存 API Key？**
- 不要把密钥硬编码在代码里，避免提交到 Git 泄露。
- 环境变量在不同部署环境（开发/生产）可以不同，代码不用改。

#### （2）路径操作

```python
os.getcwd()                             # 获取当前工作目录
os.path.join("data", "file.db")         # 拼接路径，自动处理分隔符（跨平台）
os.path.abspath("main.py")              # 获取绝对路径
os.path.dirname("/a/b/c.py")            # 获取目录部分 → "/a/b"
os.path.basename("/a/b/c.py")           # 获取文件名部分 → "c.py"
os.path.exists("data/file.db")          # 判断文件/目录是否存在
```

**跨平台优势**：Windows 用 `\`，Linux/Mac 用 `/`，`os.path.join` 会自动处理。

#### （3）目录操作

```python
os.makedirs("data/uploads", exist_ok=True)   # 递归创建目录，存在不报错
os.listdir(".")                              # 列出目录内容
os.remove("file.txt")                        # 删除文件
os.rmdir("empty_dir")                        # 删除空目录
```

#### （4）文件属性

```python
os.path.getsize("file.db")              # 获取文件大小（字节）
os.path.isfile("main.py")               # 是否是文件
os.path.isdir("data")                   # 是否是目录
```

#### （5）执行系统命令（谨慎使用）

```python
os.system("dir")                        # 执行系统命令（不推荐）
os.popen("dir").read()                  # 执行命令并读取输出（不推荐）
```

**推荐替代**：用 `subprocess` 模块，更安全、更强大。

### 2. `os` 与 `os.path` 的关系

- `os`：操作系统交互（环境变量、进程、目录）。
- `os.path`：`os` 的子模块，专门处理路径。虽然写法是 `os.path.xxx`，但它其实是独立模块。

**Python 3.4+ 推荐用 `pathlib` 替代 `os.path`**：

```python
from pathlib import Path

p = Path("data/file.db")
p.exists()                              # 是否存在
p.parent.mkdir(parents=True, exist_ok=True)  # 创建父目录
p.read_text()                           # 读文件
```

`pathlib` 是面向对象的写法，更现代。但 `os.path` 仍然广泛使用，两者都值得会。

### 3. `os` 在你项目里的典型用法

结合你之前写的代码：

```python
import os

# 1. 读 API Key
api_key = os.getenv("DEEPSEEK_API_KEY")

# 2. 拼接数据库路径
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "smart_cs.db")

# 3. 创建上传目录
os.makedirs("data/uploads", exist_ok=True)
```

### 4. `os` 和 `dotenv` 的配合

```python
from dotenv import load_dotenv
import os

load_dotenv()                            # 把 .env 文件的内容加载到环境变量
api_key = os.getenv("SILICONFLOW_API_KEY")  # 然后就能读取了
```

- `.env` 文件是纯文本，存放 `KEY=VALUE` 格式的配置。
- `load_dotenv()` 把 `.env` 里的内容注入到 `os.environ`。
- 之后 `os.getenv` 就能读到。
- `.env` 必须加入 `.gitignore`，避免泄露。

---

## 四、三者串联总结

| 概念 | 核心要点 |
| :--- | :--- |
| **工厂模式** | 把对象创建封装起来，调用方只关心"要什么"，不关心"怎么造" |
| **工厂函数** | 返回对象实例的函数，形式与普通函数一样，只是返回值是对象 |
| **`os`** | Python 标准库，与操作系统交互，最常用的是环境变量和路径操作 |

**把它们串起来看你的代码**：

```python
def get_llm(provider=None):              # ← 工厂函数
    provider = provider or os.getenv("LLM_PROVIDER", "deepseek")  # ← os 读环境变量
    cfg = PROVIDERS[provider]            # ← 配置数据化
    api_key = os.getenv(cfg["api_key_env"])
    if not api_key:
        raise ValueError(...)            # ← 工厂里做校验
    return ChatOpenAI(...)               # ← 返回对象实例
```

一行 `llm = get_llm("siliconflow")`，背后完成了：读环境变量 → 查配置 → 校验密钥 → 创建对象。这就是工厂模式的价值：**让调用方一行代码搞定复杂创建逻辑。**

如果还有哪里不清楚，可以继续问我。😊
