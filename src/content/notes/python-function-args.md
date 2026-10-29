---
title: "Python 函数参数类别"
slug: python-function-args
category: "Python"
tags: [Python]
date: 2026-09-27
status: draft
summary: "四大基础参数类别到 Python 3.8+ 进阶语法的完整讲解"
source: "笔记/Python/Python 函数参数类别.md"
---
下面是一份**Python 函数参数类别**的完整讲解。从最基础的四类开始，逐步深入到 Python 3.8+ 的进阶语法，最后配一个可直接运行的演示文件。

---

## 一、四大基础类别

### 1. 位置参数（Positional Arguments）

**定义**：调用时按**顺序**传值，参数名和顺序必须一一对应。

```python
def greet(name, age):
    print(f"{name} 今年 {age} 岁")

greet("张三", 25)        # ✅ 正确：按顺序传
greet(25, "张三")        # ❌ 逻辑错误：顺序反了，但不报错
greet(name="张三", age=25)  # ✅ 用关键字传，顺序无关
```

**特点**：
- 传入顺序必须与定义顺序一致。
- 位置参数是"最基础"的参数类型，也是其他类型的基础。

---

### 2. 关键字参数（Keyword Arguments）

**定义**：调用时用 `参数名=值` 的形式传递，**顺序无关**。

```python
def connect(host, port, timeout):
    print(f"连接 {host}:{port}，超时 {timeout}s")

# 全用关键字，顺序随便
connect(port=8000, timeout=30, host="127.0.0.1")

# 位置 + 关键字混合：位置参数必须在前面
connect("127.0.0.1", timeout=30, port=8000)
```

**特点**：
- 可读性强，调用方一眼知道每个值对应什么。
- 位置参数必须写在关键字参数**之前**。

---

### 3. 默认参数（Default Arguments）

**定义**：定义时给参数一个默认值，调用时可以不传。

```python
def greet(name, greeting="你好"):
    print(f"{greeting}, {name}")

greet("张三")               # 输出：你好, 张三
greet("张三", "早上好")      # 输出：早上好, 张三
```

**特点**：
- 默认参数必须放在**非默认参数之后**。
- 有默认值的参数，调用时可以省略。

**⚠️ 经典陷阱：可变默认值**

```python
# ❌ 错误：默认值是一个列表，所有调用共享同一个对象
def add_item(item, items=[]):
    items.append(item)
    return items

print(add_item(1))   # [1]
print(add_item(2))   # [1, 2]  ← 期望是 [2]，结果被污染了！

# ✅ 正确：用 None 作为哨兵
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items

print(add_item(1))   # [1]
print(add_item(2))   # [2]  ← 正确
```

**原因**：默认值在函数**定义时**就求值一次，之后所有调用共享同一对象。所以**永远不要用可变对象作为默认值**。

---

### 4. 可变参数（Variable-length Arguments）

有两种：

#### `*args`：接收任意多个**位置参数**，打包成元组

```python
def sum_all(*args):
    print(f"args = {args}, 类型 = {type(args)}")
    return sum(args)

sum_all(1, 2, 3)         # args = (1, 2, 3)
sum_all(1, 2, 3, 4, 5)   # args = (1, 2, 3, 4, 5)
```

#### `**kwargs`：接收任意多个**关键字参数**，打包成字典

```python
def print_info(**kwargs):
    print(f"kwargs = {kwargs}, 类型 = {type(kwargs)}")
    for k, v in kwargs.items():
        print(f"  {k} = {v}")

print_info(name="张三", age=25, city="广州")
# kwargs = {'name': '张三', 'age': 25, 'city': '广州'}
```

#### 组合使用：参数顺序必须严格遵守

```python
def func(a, b, *args, **kwargs):
    print(f"a={a}, b={b}, args={args}, kwargs={kwargs}")

func(1, 2, 3, 4, x=5, y=6)
# a=1, b=2, args=(3, 4), kwargs={'x': 5, 'y': 6}
```

**标准顺序**：
```
位置参数 → 默认参数 → *args → 仅关键字参数 → **kwargs
```

---

## 二、进阶类别（Python 3 新增）

### 5. 仅位置参数（Positional-only，Python 3.8+）

用 `/` 标记：`/` **之前**的参数只能用位置传递。

```python
def div(a, b, /):
    return a / b

div(10, 2)         # ✅
div(a=10, b=2)     # ❌ TypeError: 只能用位置传参
```

**用途**：当参数名是内部实现细节，不想暴露给调用方时使用。

### 6. 仅关键字参数（Keyword-only）

用 `*` 标记：`*` **之后**的参数只能用关键字传递。

```python
def create_user(name, *, age, city):
    print(f"{name}, {age}, {city}")

create_user("张三", age=25, city="广州")   # ✅
create_user("张三", 25, "广州")            # ❌ TypeError
```

**用途**：强制调用方写明参数名，提高可读性。

### 7. 完整的参数顺序（终极版）

```python
def func(pos1, pos2, /, normal, *, kw_only):
    ...
```

顺序说明：
```
pos1, pos2          → 仅位置参数（/ 之前）
normal              → 普通参数（位置和关键字都行）
kw_only             → 仅关键字参数（* 之后）
```

---

## 三、如何"查看"函数的参数信息

### 方法 1：`help()` 函数

```python
def greet(name, greeting="你好"):
    """向用户打招呼

    Args:
        name: 用户名
        greeting: 问候语，默认"你好"
    """
    print(f"{greeting}, {name}")

help(greet)
```

输出会显示签名和 docstring。

### 方法 2：`inspect` 模块（编程方式）

```python
import inspect

sig = inspect.signature(greet)
print(sig)                       # (name, greeting='你好')

for name, param in sig.parameters.items():
    print(f"{name}: kind={param.kind}, default={param.default}")
```

输出：
```
name: kind=POSITIONAL_OR_KEYWORD, default=<class 'inspect._empty'>
greeting: kind=POSITIONAL_OR_KEYWORD, default=你好
```

`param.kind` 的可能值：
- `POSITIONAL_ONLY`
- `POSITIONAL_OR_KEYWORD`
- `VAR_POSITIONAL`（*args）
- `KEYWORD_ONLY`
- `VAR_KEYWORD`（**kwargs）

### 方法 3：IDE 悬停

在 PyCharm / VS Code 中，把鼠标悬停在函数名上，会显示签名和类型提示。

---

## 四、如何"阅读"函数签名

看到一个函数签名时，按以下顺序拆解：

```python
def process(data, mode="fast", *tags, verbose=False, **options):
    ...
```

阅读步骤：
1. **`data`**：位置参数，必填。
2. **`mode="fast"`**：默认参数，可不传，默认 `"fast"`。
3. **`*tags`**：可变位置参数，可以传任意多个额外位置值，被打包成元组 `tags`。
4. **`verbose=False`**：仅关键字参数（因为在 `*` 之后），必须用 `verbose=True` 传。
5. **`**options`**：可变关键字参数，接收任意多个额外的关键字参数，被打包成字典 `options`。

**调用示例**：
```python
process("input.txt")                                    # 只传 data
process("input.txt", "slow")                            # 传 mode
process("input.txt", "slow", "tag1", "tag2")            # 传 *tags
process("input.txt", verbose=True)                      # 传仅关键字参数
process("input.txt", "fast", "tag1", verbose=True, x=1) # 全传
```

---

## 五、可运行演示文件

把下面代码保存为 `param_demo.py`，直接运行即可：

```python
"""
Python 函数参数四种类别 + 进阶用法 完整演示
"""
import inspect


# ============ 1. 位置参数 ============
def positional_demo(name, age):
    """位置参数：按顺序传值"""
    return f"{name} 今年 {age} 岁"


# ============ 2. 关键字参数 ============
def keyword_demo(host, port, timeout):
    """关键字参数：用 参数名=值 传递"""
    return f"连接 {host}:{port}，超时 {timeout}s"


# ============ 3. 默认参数 ============
def default_demo(name, greeting="你好"):
    """默认参数：定义时给默认值"""
    return f"{greeting}, {name}"


def mutable_default_wrong(item, items=[]):
    """错误示范：可变默认值"""
    items.append(item)
    return items


def mutable_default_right(item, items=None):
    """正确示范：用 None 作为哨兵"""
    if items is None:
        items = []
    items.append(item)
    return items


# ============ 4. 可变参数 ============
def args_demo(*args):
    """*args：接收任意多个位置参数，打包成元组"""
    return f"args={args}, sum={sum(args)}"


def kwargs_demo(**kwargs):
    """**kwargs：接收任意多个关键字参数，打包成字典"""
    return f"kwargs={kwargs}"


def mixed_demo(a, b, *args, **kwargs):
    """混合：a, b 是位置参数；args 是额外位置；kwargs 是额外关键字"""
    return f"a={a}, b={b}, args={args}, kwargs={kwargs}"


# ============ 5. 仅位置参数（Python 3.8+） ============
def positional_only_demo(a, b, /):
    """'/' 之前的参数只能用位置传"""
    return f"a={a}, b={b}"


# ============ 6. 仅关键字参数 ============
def keyword_only_demo(name, *, age, city):
    """'*' 之后的参数只能用关键字传"""
    return f"{name}, {age}, {city}"


# ============ 7. 完整签名 ============
def full_signature(pos_only, /, normal, *args, kw_only, **kwargs):
    """
    完整的参数顺序：
    仅位置 → 普通 → *args → 仅关键字 → **kwargs
    """
    return {
        "pos_only": pos_only,
        "normal": normal,
        "args": args,
        "kw_only": kw_only,
        "kwargs": kwargs,
    }


# ============ 测试集 ============
def run_tests():
    print("=" * 60)
    print("【1】位置参数")
    print(positional_demo("张三", 25))
    print(positional_demo(25, "张三"))  # 顺序反了，不报错但逻辑错

    print("=" * 60)
    print("【2】关键字参数")
    print(keyword_demo(port=8000, timeout=30, host="127.0.0.1"))
    print(keyword_demo("127.0.0.1", port=8000, timeout=30))

    print("=" * 60)
    print("【3】默认参数")
    print(default_demo("张三"))
    print(default_demo("张三", "早上好"))

    print("--- 可变默认值陷阱 ---")
    print("错误示范：")
    print(mutable_default_wrong(1))   # [1]
    print(mutable_default_wrong(2))   # [1, 2] 被污染
    print("正确示范：")
    print(mutable_default_right(1))   # [1]
    print(mutable_default_right(2))   # [2]

    print("=" * 60)
    print("【4】可变参数")
    print(args_demo(1, 2, 3))
    print(args_demo(10, 20, 30, 40))
    print(kwargs_demo(name="张三", age=25, city="广州"))
    print(mixed_demo(1, 2, 3, 4, x=5, y=6))

    print("=" * 60)
    print("【5】仅位置参数")
    print(positional_only_demo(10, 20))
    try:
        positional_only_demo(a=10, b=20)
    except TypeError as e:
        print(f"用关键字传参报错：{e}")

    print("=" * 60)
    print("【6】仅关键字参数")
    print(keyword_only_demo("张三", age=25, city="广州"))
    try:
        keyword_only_demo("张三", 25, "广州")
    except TypeError as e:
        print(f"用位置传参报错：{e}")

    print("=" * 60)
    print("【7】完整签名")
    result = full_signature(
        1,           # pos_only
        2,           # normal
        3, 4,        # *args
        kw_only=5,   # 仅关键字
        x=6, y=7     # **kwargs
    )
    print(result)

    print("=" * 60)
    print("【8】用 inspect 查看函数签名")
    for func in [positional_demo, default_demo, full_signature]:
        sig = inspect.signature(func)
        print(f"{func.__name__}{sig}")
        for name, param in sig.parameters.items():
            print(f"    {name}: kind={param.kind.name}, "
                  f"default={param.default if param.default is not inspect.Parameter.empty else '无'}")

    print("=" * 60)
    print("【9】解包传参")
    args_list = [10, 20]
    kwargs_dict = {"host": "127.0.0.1", "port": 8000, "timeout": 30}
    print(f"*args 解包：{args_demo(*args_list)}")
    print(f"**kwargs 解包：{keyword_demo(**kwargs_dict)}")


if __name__ == "__main__":
    run_tests()
```

---

## 六、运行预期输出（节选）

```
============================================================
【1】位置参数
张三 今年 25 岁
25 今年 张三 岁
============================================================
【2】关键字参数
连接 127.0.0.1:8000，超时 30s
连接 127.0.0.1:8000，超时 30s
============================================================
【3】默认参数
你好, 张三
早上好, 张三
--- 可变默认值陷阱 ---
错误示范：
[1]
[1, 2]
正确示范：
[1]
[2]
============================================================
【4】可变参数
args=(1, 2, 3), sum=6
args=(10, 20, 30, 40), sum=100
kwargs={'name': '张三', 'age': 25, 'city': '广州'}
a=1, b=2, args=(3, 4), kwargs={'x': 5, 'y': 6}
...
============================================================
【8】用 inspect 查看函数签名
positional_demo(name, age)
    name: kind=POSITIONAL_OR_KEYWORD, default=无
    age: kind=POSITIONAL_OR_KEYWORD, default=无
...
```

---

## 七、总结速查表

| 参数类型 | 定义语法 | 传参方式 | 打包成 |
| :--- | :--- | :--- | :--- |
| 位置参数 | `def f(a, b)` | `f(1, 2)` | — |
| 关键字参数 | `def f(a, b)` | `f(a=1, b=2)` | — |
| 默认参数 | `def f(a, b=10)` | 可省略 | — |
| 可变位置 | `def f(*args)` | `f(1,2,3)` | 元组 |
| 可变关键字 | `def f(**kwargs)` | `f(x=1, y=2)` | 字典 |
| 仅位置 | `def f(a, /)` | 只能 `f(1)` | — |
| 仅关键字 | `def f(*, a)` | 只能 `f(a=1)` | — |

**参数顺序口诀**：
```
仅位置 / 普通 / *args / 仅关键字 / **kwargs
```

**三条铁律**：
1. **默认参数不要用可变对象**（用 `None` 代替）。
2. **位置参数必须在关键字参数之前**。
3. **`*args` 在 `**kwargs` 之前**。

把上面的 `param_demo.py` 跑一遍，所有示例输出都在终端里，对照理解效率最高。
