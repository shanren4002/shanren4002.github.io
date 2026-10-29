---
title: "AI 个人史记项目——知识点复盘"
slug: ai-personal-chronicle-review
category: "AIPERSON"
tags: [个人AI, DeepSeek, API]
date: 2026-09-14
status: published
summary: "AI 个人史记项目初期复盘：DeepSeek API 调用与初始化的关键依赖"
source: "笔记/AIPERSON/初章——调用初始化.md"
---
# AI个人史记项目——知识点复盘

## 1. DeepSeek API：让程序具备 AI 对话能力

### 为什么出现

项目最初需要一个真正能够和用户对话的 AI，因此先解决：

> Python 程序如何调用大模型？

### 关键依赖

```bash
pip install openai python-dotenv
```

### 最小运行代码

```python
from openai import OpenAI

client = OpenAI(
    api_key="你的API_KEY",
    base_url="https://api.deepseek.com"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "user", "content": "你好"}
    ]
)

print(response.choices[0].message.content)
```

### 解决的问题

建立：

```text
Python → DeepSeek → AI回复
```

这是整个项目的基础。

---

# 2. Prompt / Role：让 AI 从“通用助手”变成“艾爱”

### 为什么出现

单纯调用 DeepSeek，它只是一个通用 AI。

项目需要的是：

> 一个专门负责了解用户、记录用户人生信息的 AI。

因此需要角色设定。

### 最小实现

```python
ROLE_PROMPT = """
你叫艾爱。

你是一个长期帮助用户记录个人经历的AI。
你的目标是逐渐了解用户的重要经历、人物、事件和想法。

与用户自然交流，不要像填写问卷。
不要编造自己不知道的记忆。
"""
```

调用时：

```python
messages = [
    {"role": "system", "content": ROLE_PROMPT},
    {"role": "user", "content": "我是你的工作伙伴"}
]
```

### 解决的问题

把：

```text
通用AI
```

变成：

```text
具有明确职责的AI角色
```

---

# 3. SQLite：保存聊天记录

### 为什么出现

单纯让 AI 回复是不够的。

如果程序关闭：

```text
今天聊过什么 → 消失
```

项目的目标本身就是“个人史记”，所以必须保存原始数据。

### 关键依赖

SQLite 是 Python 自带的：

```python
import sqlite3
```

### 最小实现

```python
import sqlite3

conn = sqlite3.connect("database.db")

conn.execute("""
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT,
    content TEXT
)
""")

conn.execute(
    "INSERT INTO messages (role, content) VALUES (?, ?)",
    ("user", "今天开始开发AI记忆")
)

conn.commit()
conn.close()
```

### 解决的问题

建立：

```text
用户对话
   ↓
SQLite
   ↓
永久保存
```

注意：

> **聊天记录 ≠ AI记忆。**

聊天记录只是以后构建记忆的原始材料。

---

# 4. LangGraph：把 AI 对话变成“可管理的流程”

### 为什么出现

最初手写代码时，AI调用、历史消息、数据库等逻辑逐渐混在一起。

项目后面需要：

```text
对话
 ↓
记忆
 ↓
总结
 ↓
提取事件
 ↓
个人史记
```

这已经不是简单的：

```python
调用一次API
```

而是一个 AI 工作流。

因此引入 LangGraph。

### 关键依赖

```bash
pip install langgraph
```

### 最小运行结构

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    message: str
    response: str

def chat(state):
    return {
        "response": "你好，我是艾爱"
    }

builder = StateGraph(State)

builder.add_node("chat", chat)
builder.add_edge(START, "chat")
builder.add_edge("chat", END)

graph = builder.compile()

result = graph.invoke({
    "message": "你好"
})

print(result["response"])
```

### 解决的问题

第一次建立：

```text
State
 ↓
Node
 ↓
Graph
 ↓
执行
```

也就是把 AI 从“一次函数调用”升级成“可扩展工作流”。

---

# 5. Message State：让 AI 真正看到当前对话

### 为什么出现

最初的 State：

```python
class AIState(TypedDict):
    user_message: str
    ai_response: str
```

只能保存：

```text
这一轮用户说什么
这一轮AI回答什么
```

无法自然支持：

```text
用户：我是你的工作伙伴
AI：好的

用户：你还记得我吗？
AI：……
```

所以改成消息列表。

### 关键依赖

```python
from langgraph.graph.message import add_messages
```

### 最小实现

```python
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class AIState(TypedDict):
    messages: Annotated[list, add_messages]
```

之后每轮：

```python
graph.invoke({
    "messages": [
        HumanMessage(content="我是你的工作伙伴")
    ]
})
```

### 解决的问题

State 可以不断累积：

```text
Human
AI
Human
AI
Human
AI
```

因此 AI 能够获得**当前会话上下文**。

---

# 6. MemorySaver + thread_id：让 LangGraph 保存会话状态

### 为什么出现

仅仅定义 `messages` 还不够。

每次：

```python
graph.invoke(...)
```

都需要知道：

> 这是哪个用户、哪个会话？

因此引入 `thread_id`。

### 关键依赖

```python
from langgraph.checkpoint.memory import MemorySaver
```

### 最小实现

```python
memory = MemorySaver()

graph = builder.compile(
    checkpointer=memory
)
```

调用：

```python
config = {
    "configurable": {
        "thread_id": "user-001"
    }
}

graph.invoke(
    {
        "messages": [
            HumanMessage(content="我是你的工作伙伴")
        ]
    },
    config
)
```

下一次仍然使用：

```python
thread_id = "user-001"
```

LangGraph 就能找到这个会话对应的 State。

### 解决的问题

建立：

```text
thread_id
    ↓
对应 State
    ↓
历史消息
```

项目在这里第一次基本验证了：

> **艾爱可以记住当前运行过程中的多轮对话。**

---

# 7. LangChain Message 与 OpenAI Message 的格式转换

### 为什么出现

LangGraph 使用：

```text
HumanMessage
AIMessage
SystemMessage
```

而 DeepSeek API 使用：

```text
user
assistant
system
```

直接把：

```python
message.type
```

传给 DeepSeek 会出现：

```text
unknown variant `human`
```

### 解决方式

明确转换：

```python
if isinstance(message, HumanMessage):
    role = "user"

elif isinstance(message, AIMessage):
    role = "assistant"

elif isinstance(message, SystemMessage):
    role = "system"
```

然后：

```python
messages.append({
    "role": role,
    "content": message.content
})
```

### 解决的问题

打通：

```text
LangGraph Message
       ↓
角色转换
       ↓
DeepSeek API
```

这是本项目实际遇到并解决的一个关键工程问题。

---

# 8. 当前真正的“记忆问题”

项目最后停在这里。

测试过程中出现了一个很有价值的现象：

用户说：

```text
我是你的工作伙伴
```

之后问：

```text
你记不记得我和你说我是你的工作伙伴？
```

艾爱能够回答：

> 记得。

说明：

```text
LangGraph State
      ↓
chat_node
      ↓
DeepSeek
```

这条链路已经基本成立。

但当用户问：

```text
你知不知道我之前和你的对话？
```

AI 又回答：

> 不知道。

### 实际原因

这里混淆了两个概念：

```text
当前会话记忆
        ≠
跨程序长期记忆
```

当前项目已经做到：

```text
当前会话
    ↓
LangGraph State
    ↓
MemorySaver
    ↓
多轮上下文
```

但还没有做到：

```text
关闭程序
    ↓
重新启动
    ↓
仍然知道以前发生过什么
```

---

# 9. 项目最终停在哪里

当前完成度可以直接看这张表：

|知识点|状态|
|---|---|
|Python 调用 DeepSeek|✅|
|`.env` 配置 API Key|✅|
|AI Role Prompt|✅|
|SQLite 聊天记录|✅|
|LangGraph State|✅|
|LangGraph Node|✅|
|LangGraph Graph|✅|
|Message State|✅|
|MemorySaver|✅|
|thread_id|✅|
|当前会话多轮记忆|✅ 基本验证|
|持久化 Checkpoint|❌|
|长期记忆|❌|
|Session Summary|❌|
|Memory Extraction|❌|
|Event Extraction|❌|
|个人史记生成|❌|
|事件复盘|❌|

## 下一阶段真正应该做什么

不是继续堆 Prompt，而是解决：

```text
当前：
聊天
 ↓
LangGraph State
 ↓
DeepSeek
 ↓
回复


下一步：
聊天
 ↓
LangGraph
 ↓
SQLite 持久化
 ↓
长期记忆
 ↓
事件 / 人物 / 经历
 ↓
个人史记
 ↓
事件复盘
```

其中最关键的认知是：

> **聊天记录是原始数据，不是记忆。**

这也是这个项目从“AI聊天程序”真正走向“个人史记 AI”的分界点。
