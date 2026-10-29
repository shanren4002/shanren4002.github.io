---
title: "__init__.py 的作用"
slug: python-init-py
category: "Python"
tags: [Python, 包管理]
date: 2026-09-15
status: draft
summary: "__init__.py 如何将目录标记为 Python 包及其多层作用详解"
source: "笔记/Python/__init__.py.md"
---
`__init__.py` 是 Python 中一个非常特殊的文件，它的主要作用是**将一个目录标记为 Python 包（Package）**。换句话说，一个文件夹里只要有了 `__init__.py`，Python 就会把它当作一个“包”来处理，而不是普通的文件夹。

下面我分几个层面详细解释。

---

## 1. 基本作用：标识包

假设你的项目结构如下：

```text
AIPERSON/
├── main.py
└── app/
    ├── __init__.py      ← 这个文件
    ├── graph/
    │   ├── __init__.py  ← 这个文件
    │   ├── graph.py
    │   └── state.py
    └── utils/
        └── helper.py
```

- `app/` 文件夹中有 `__init__.py`，Python 就知道 `app` 是一个包。
- `app/graph/` 文件夹中也有 `__init__.py`，所以 `app.graph` 也是一个子包。
- 这样你就可以写：
  ```python
  from app.graph.graph import graph
  from app.graph.state import AIState
  ```
  如果没有 `__init__.py`，在某些 Python 版本（尤其是 Python 3.3 之前）或某些工具（如 IDE、打包工具）中，导入可能会失败。

---

## 2. 控制包的导入行为

`__init__.py` 在包被导入时**会自动执行**。因此你可以在里面写一些初始化代码，例如：

```python
# app/__init__.py
print("app 包被导入了！")
```

当你执行 `import app` 或 `from app import xxx` 时，这段代码就会运行。

你也可以用它来**简化导入路径**，比如：

```python
# app/graph/__init__.py
from .graph import graph
from .state import AIState
```

这样外部就可以直接写：
```python
from app.graph import graph, AIState
```
而不需要写很长的 `from app.graph.graph import graph`。

---

## 3. 在 Python 3.3+ 中的变化（命名空间包）

从 Python 3.3 开始，引入了 **命名空间包（Namespace Package）** 的概念。也就是说，**即使没有 `__init__.py`，Python 也能把目录当作包来导入**（前提是目录在 `sys.path` 中）。

但是，在实际开发中，**仍然强烈建议保留 `__init__.py`**，原因如下：

- **兼容性**：老版本 Python、某些工具（如 `setup.py`、`mypy`、`pytest`）仍然依赖它。
- **明确性**：显式声明这是一个包，避免歧义。
- **可控性**：可以在里面写初始化逻辑，控制导入行为。
- **IDE 支持**：PyCharm、VS Code 等对含 `__init__.py` 的包识别更准确。

---

## 4. `__init__.py` 里通常写什么？

- **空文件**：最常见，只用来标记包。
- **导入子模块**：方便外部使用，如上面例子。
- **定义 `__all__`**：控制 `from package import *` 时导入哪些模块。
  ```python
  # app/graph/__init__.py
  __all__ = ["graph", "state"]
  ```
- **包级别的初始化**：如配置日志、注册插件等。
- **版本号**：
  ```python
  __version__ = "1.0.0"
  ```

---

## 5. 结合你的项目

你之前在 `app/graph/graph.py` 里写了 `from graph.state import AIState`，然后报错 `ModuleNotFoundError: No module named 'graph'`。原因之一就是**包结构不清晰**。正确的做法是：

1. 确保 `app/` 和 `app/graph/` 下都有 `__init__.py`（哪怕为空文件）。
2. 在 `graph.py` 中使用绝对导入：
   ```python
   from app.graph.state import AIState
   ```
   或者相对导入：
   ```python
   from .state import AIState
   ```

这样 Python 就能沿着包路径找到 `state.py`。

---

## 6. 常见误区

- **`__init__.py` 不是必须为空**，但建议保持简洁。
- **删掉 `__init__.py` 不一定报错**（Python 3.3+ 命名空间包），但可能导致工具识别异常。
- **不要在里面写大量业务逻辑**，它只负责包的初始化。
- **文件名是双下划线**：`__init__.py`，不是 `_init_.py` 或 `init.py`。

---

## 7. 总结

| 作用 | 说明 |
| :--- | :--- |
| 标记包 | 让 Python 把目录视为可导入的包 |
| 初始化 | 导入包时自动执行，可做初始化配置 |
| 简化导入 | 可在其中预先导入子模块，方便外部调用 |
| 控制导出 | 通过 `__all__` 定义 `import *` 的行为 |
| 版本管理 | 可定义 `__version__` 等元信息 |

一句话：**`__init__.py` 是 Python 包的“身份证”和“初始化入口”。** 在你的项目中，给 `app` 和 `app/graph` 各放一个空的 `__init__.py`，就能解决很多导入路径的疑难杂症。😊
