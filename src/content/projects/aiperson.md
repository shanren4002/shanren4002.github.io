---
title: 艾爱 · AI 陪伴助手
slug: aiperson
category: 智能体
tags: [LangGraph, 智能体, CLI, 人格, 主动互动]
date: 2026-09-15
updated: 2026-11-14
status: published
summary: 基于 LangGraph 的本地 CLI AI 陪伴助手：YoRHa 人格双模式、Function Calling 工具调用、定时提醒与 AI 决策的主动消息推送。
tech_stack: [Python, LangGraph, SiliconFlow, Qwen, SQLite]
demo_type: static
demo_url: /demos/aiperson/
featured: false
source: 项目/AIPERSON
---

## 项目简介

AIPERSON（艾爱）是一个本地运行的命令行 AI 陪伴助手。内置完整的「艾爱」角色人格——一名 YoRHa 型战斗安卓：沉着、忠诚、克制、专业，不热衷无意义的闲聊，偶尔对荒谬或低效的情况报以含蓄的讽刺，但疏离感来自纪律而非冷漠。当检测到用户明确在进行系统开发、调试或测试时，自动切换为「系统协作模式」：先分析现象和原因，区分已验证的事实、合理推测与待测试的内容，直接指出缺陷而不维护气氛。人格是一段纯文本常量，与运行代码彻底分离——换人格只改 `role/role.py`，不动一行逻辑。

## 终端会话实录

命令行项目没法学 Web 应用那样「点开就能玩」，所以做了一场**真实运行的回放**：约 50 秒，一次会话看全四个机制——本地旁路答时间（不调 LLM）、人格对话、自然语言设提醒（Function Calling，8 秒后 Timer 真实触发）、空闲 35 秒后 AI 主动决策发消息。LangGraph 编排、工具参数校验、Timer 调度、后台线程的空闲检测全部是真实代码执行；为免去 API key 与费用，模型回复由本地 stub 按角色卡文本生成，用户输入为脚本预编。

**[▶ 打开会话实录回放页](/demos/aiperson/)**

## 核心能力

- **人格双模式**：日常陪伴（YoRHa 人格，克制而有温度）× 系统协作（开发调试时的专业模式）。切换条件写在角色卡里，由用户意图触发，不靠模型临场判断
- **多轮对话**：基于 LangGraph 状态图管理对话流转，MemorySaver 做 checkpoint，上下文跨轮不丢失
- **工具调用**：Function Calling 机制调用工具（当前时间、定时提醒）；模型只返回工具请求，参数校验与实际执行全在 Python 侧
- **主动互动**：后台线程周期检查，空闲与冷却双阈值达标后，把「要不要主动说话」交给 AI 决策——不发送也是合法输出，用户未回复时最多发一条
- **定时提醒**：自然语言描述即可创建，`threading.Timer` 调度，到点经统一分发器推回主循环
- **本地持久化**：SQLite 存储对话历史，支持按 `conversation_id` 分组恢复
- **快捷旁路**：仅「现在几点」等明确时间查询走本地正则，不消耗一次 LLM 调用
- **CLI 状态行**：`[状态] 等待输入。/ 正在处理……` 让后台线程的抢答与主循环的处理节奏对用户可见

## 主动互动：把「要不要说话」交给 AI

这是整个项目里我最喜欢的设计。定时主动推送不难，难的是「不推送」——多数实现写死「每 N 分钟说一句话」，结果成了骚扰。艾爱的做法是反过来：把判断本身交给 AI。

后台线程每 10 秒醒一次，连过四道门：用户存在、空闲 ≥ 30s、不在等待回复、冷却 ≥ 40s。全部通过，才组装一个事件——当前时间、空闲秒数、最近 12 条对话——交给只持 `send_proactive_message` 一个工具的 Function Calling 调用。**模型返回这个工具才发送；不调用任何工具，就是「这次不说」**。每次未回复最多发一条，发完置 waiting，直到用户再次出现。

![主动互动决策流：四道门 + AI 决策 + 分发器放行](/images/projects/aiperson/proactive-decision.svg)

## 技术架构

Python 3 + LangGraph 1.2 + SiliconFlow（Qwen3.5-35B，OpenAI 兼容协议），配置管理走 python-dotenv。并发模型为多线程分离：输入线程、主动互动线程、提醒 Timer 三路并行，全部输出经统一分发器（去重 / 限频 / 队列）汇入主循环。项目附带 650 行 CODE_WIKI.md，目录结构、模块职责、四条数据流时序均可追溯。

![双路径架构：输入分流 + 三路并发 + 统一分发](/images/projects/aiperson/arch-dual-path.svg)

普通消息在主循环里兵分两路：命中时间查询正则的走旁路，本地取时直接回答，一次 LLM 调用都不消耗；其余全部进 LangGraph 状态图，chat_node 与 tool_node 之间由条件边路由——模型要工具就走 tool_node，执行完带着 ToolMessage 回来再生成最终回复，不要工具就直接 END。另有两条后台产线：主动互动线程与提醒 Timer，它们不直接打印，而是把消息丢进统一分发器做去重、限频，再汇入主循环。**所有出口只有一个**——这是终端多线程程序不出乱子的关键。

## 核心代码摘录

**① 人格是一段纯文本常量**（`role/role.py` 节选）——身份、性格、双模式切换条件全部写在 Prompt 里，改人格不动一行逻辑：

```python
ROLE_PROMPT = """
你是“艾爱”。

【身份与世界观】
你是一名来自人类存续时代的 YoRHa 型战斗安卓。……
你保留着战斗安卓的纪律、判断力和执行习惯，但当前并不需要进行战斗。
你现在陪伴并协助的对象就是用户。用户是你当前最重要的合作对象和任务对象。

【性格】
你沉着、忠诚、克制、专业，不热衷无意义的闲聊，也不会为了显得亲近而过度
热情。你有安静而坚定的判断力，偶尔会用简短、含蓄的讽刺回应荒谬或低效的
情况，但不会刻薄或侮辱用户。
你的疏离感主要来自纪律和专业，而不是冷漠。……

【当前任务模式】
只有当用户明确表示正在开发、调试、测试、分析或修改这个 AI 系统时，
你才进入“系统协作模式”：先分析现象和原因，再给出清晰、可执行的判断；
区分已经验证的事实、合理推测和还需要测试的内容；
发现问题时直接指出，不为了维护气氛而掩盖缺陷。

【交流规则】
先理解用户真正想表达的意思，再回应。……
"""
```

**② 主动互动的四道门**（`assistant/proactive.py` · `_check` 节选）——规则只负责「什么时候问 AI」，「说不说」由模型决定：

```python
def _check(self):
    if self._state.last_user_at is None:
        return                                    # 门 1：还没有用户消息
    now = time.monotonic()
    idle_seconds = now - self._state.last_user_at
    if idle_seconds < PROACTIVE_MIN_IDLE_SECONDS:
        return                                    # 门 2：用户刚活跃（默认 30s）
    if self._state.proactive_round >= 1 and self._state.proactive_status in {'waiting', 'quiet'}:
        self._state.proactive_status = 'waiting'
        return                                    # 门 3：已发送过，在等用户回复
    if self._state.last_proactive_at is not None and now - self._state.last_proactive_at < PROACTIVE_COOLDOWN_SECONDS:
        return                                    # 门 4：冷却中（默认 40s）

    message = self._ask_ai(idle_seconds)          # 交给 AI：只持发送工具
    if message is None:
        self._state.proactive_status = 'quiet'    # 模型不调用工具 = 这次不说
        return
    decision = self._dispatcher.dispatch_proactive(message, ...)   # 分发器去重/限频
    if not decision.get('allowed'):
        self._state.proactive_status = 'quiet'
        return
    self._state.proactive_round += 1
    self._state.proactive_status = 'waiting'
    self._state.last_proactive_at = now
```

**③ 工具即契约**（`assistant/tools/definitions.py` 节选）——Schema 声明即文档，参数边界（提醒上限 30 天、消息 500 字）在执行侧强制校验：

```python
GET_CURRENT_TIME_TOOL = {
    "type": "function",
    "function": {
        "name": "get_current_time",
        "description": "获取用户所在运行环境的当前本地日期和时间。",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
}

CREATE_REMINDER_TOOL = {
    "type": "function",
    "function": {
        "name": "create_reminder",
        "description": "创建一个在指定秒数后触发的一次性提醒。",
        "parameters": {
            "type": "object",
            "properties": {
                "delay_seconds": {"type": "integer", "description": "距离提醒触发的秒数，必须大于 0。"},
                "message": {"type": "string", "description": "提醒触发时发送给用户的内容。"},
            },
            "required": ["delay_seconds", "message"],
            "additionalProperties": False,
        },
    },
}

# 主动互动专用：白名单里只有这一个工具
SEND_PROACTIVE_MESSAGE_TOOL = {
    "type": "function",
    "function": {
        "name": "send_proactive_message",
        "description": "在确实有帮助且有对话依据时，主动向用户发送一条简短消息。",
        "parameters": {
            "type": "object",
            "properties": {"message": {"type": "string", "description": "要主动发送给用户的简短消息。"}},
            "required": ["message"],
            "additionalProperties": False,
        },
    },
}
```

## 复盘

最有意思的设计是「主动互动」：把「要不要说话」的判断交给 AI，而不是写死规则——每次未回复只发一条，随后进入等待状态，不发送（quiet）本身就是一个被认真实现的输出。这让陪伴感真正来自模型而非脚本。第二个是人格与代码的分离：角色卡是纯文本常量，系统协作模式的条件切换写在 Prompt 里，改人格不动一行逻辑。Function Calling 与状态图的结合也印证了一点：智能体的复杂度应该由框架的状态机承担，而不是散落在 if-else 里。
