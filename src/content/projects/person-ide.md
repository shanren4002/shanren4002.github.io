---
title: PersonIDE · 知识库关键词分析
slug: person-ide
category: 工具
tags: [Python, CLI, DeepSeek, SiliconFlow]
date: 2026-10-17
updated: 2026-11-15
status: published
summary: 本地 Python CLI 知识库分析工具：三策略问答路由（全量/摘要/自适应）+ 低置信度澄清追问，产出可离线打开的静态 HTML 报告。
tech_stack: [Python, openai SDK, DeepSeek, SiliconFlow, CLI]
demo_type: static
demo_url: /demos/person-ide/index.html
featured: false
source: 项目/PersonIDE
---

## 项目简介

一个本地运行的 Python 命令行程序：读取 Markdown 个人知识库，调用在线大模型回答问题，并生成可直接在浏览器打开的静态 HTML 报告。核心设计是三种问答策略的路由——同一份文档、同一个 query，可以按不同策略分别回答并对比。

## 核心能力

- **三策略路由**：`full_read`（全量原文直接回答）/ `summary`（结构化摘要上下文）/ `adaptive`（默认，按意图自动选择），三策略共用同一个回答函数与回答指令，区别只在传入的文档上下文
- **compare 对比模式**：同一次运行中，用同一份文档和 query 分别调用全量与总结策略，在一份 HTML 报告里并排呈现
- **低置信度澄清**：自适应策略置信度低于 70% 时，围绕用户问题提出针对性澄清；每三轮比较一次置信度增幅，增幅不足 10 个百分点且仍低于阈值，则停止追问并降级为全量读取——宁可多读，不可遗漏
- **Token 级可观测**：报告按阶段汇总输入 / 输出 / 总 Token，API 返回缓存命中字段时单独拆分显示；某次请求用量缺失时显示「未知」，不估算为 0
- **一次真实运行的账本**：2026-10-18 对一份 Python 函数参数笔记（notes.md）跑自适应策略——意图置信度 75%，实际上下文走了「总结」，全程输入 7,330 / 输出 2,013 / 合计 9,343 Token。这份账本来自工具自己产出的报告，一个数都没估
- **上下文留痕**：每次运行将实际用于回答的文档上下文存档到 `analysis_documents/`，回答依据可追溯
- **双模型提供方**：DeepSeek（默认）/ SiliconFlow 可切换，`AI_BASE_URL`、`AI_MODEL` 可覆盖默认值

## 技术架构

Python 3.10+ 单体 CLI：`main.py` 为入口，`person_knowledge` 包内含 `file_loader` / `keyword_extractor` / `keyword_stats` 三个可独立运行的模块。HTML 报告为纯静态单文件，AI 答案中的 Markdown 会被格式化为标题、列表、代码块，原始 HTML 作为文本处理，无需启动任何服务。全部测试不依赖 API 密钥与网络，离线可跑。

![三策略路由与澄清降级：full_read / summary / adaptive 共用同一回答函数](/images/projects/person-ide/routing-decision.svg)

adaptive 是默认策略，也是唯一带决策分支的路径：先对 query 做意图分类，置信度达到 70% 就直接按意图选上下文（全量或摘要二选一）；不到 70% 才进入澄清追问——每 3 轮为一批重分类一次，本批增幅不足 10 个百分点就停止追问、降级全量读取。full_read 与 summary 两条指定策略则跳过全部分支，直达同一个回答函数。**三策略的差异只在传入的文档上下文**，回答函数与指令完全共用——这也是 compare 模式敢把两种策略的结果并排摆进同一份报告的底气。

![Token 观测管线：五阶段打标 → record_response 读 usage → snapshot 快照 → 报告表格](/images/projects/person-ide/token-pipeline.svg)

Token 账本走一条独立于策略的采集管线：工作流里每一次 LLM 调用，先按五阶段之一打上标签；响应返回后由 `record_response` 读取 usage 字段（prompt / completion / total / 缓存命中与未命中）；某次请求没有返回用量，就调 `record_unknown` 记一条「未知」——**None 就是 None，不估算为 0**，汇总时任何一个字段缺失，对应合计同样显示未知。条目以 frozen dataclass 累积，报告生成时 `snapshot()` 即时算出总计与分阶段两个只读视图，直接渲染进「Token 与准确度」表。上面那张账本里的 7,330 / 2,013 / 9,343，就是这样一个个字段读出来的。

## 核心代码摘录

**① adaptive 的路由主干**（`person_knowledge/document_answer_strategies.py` · `answer_adaptive` 节选）——分类、澄清、选上下文、回答四步一条直线，澄清整段包在「置信度不足」的条件里，达标时一行都不多走：

```python
def answer_adaptive(
    document: str,
    query: str,
    config: AIConfig,
    client: OpenAI,
    *,
    ask_user: Callable[[str], str],
    on_initial_classification: Callable[[IntentClassification], None] | None = None,
    forced_intent: IntentType | None = None,
    token_tracker: TokenUsageTracker | None = None,
) -> DocumentAnswerResult:
    """Classify and clarify the query, then use the selected context strategy."""
    initial_classification = classify_query_intent(query, config, client, ...)
    final_classification = initial_classification
    intent = initial_classification.intent
    clarifications: tuple[ClarificationExchange, ...] = ()
    used_full_read_fallback = False

    if initial_classification.confidence < INTENT_CONFIDENCE_THRESHOLD:
        resolution = resolve_low_confidence_intent(
            query,
            initial_classification,
            generate_question=lambda original_query, exchanges: (
                generate_clarifying_question(original_query, exchanges, config, client, ...)
            ),
            ask_user=ask_user,
            reclassify=lambda original_query, exchanges: classify_query_intent(
                original_query,
                config,
                client,
                exchanges,
                usage_stage=TokenUsageStage.RECLASSIFICATION,
            ),
            ...
        )
        final_classification = resolution.final_classification
        intent = resolution.intent
        clarifications = tuple(
            ClarificationExchange(turn.question, turn.answer) for turn in resolution.turns
        )
        used_full_read_fallback = resolution.used_full_read_fallback

    return _answer_prepared_context(
        document,
        query,
        intent,
        AnswerStrategy.ADAPTIVE,
        config,
        client,
        clarifications=clarifications,
        used_full_read_fallback=used_full_read_fallback,
        token_tracker=token_tracker,
    )
```

**② 澄清降级的两个阈值**（`person_knowledge/intent_clarification.py` · `resolve_low_confidence_intent` 节选）——批内每答一轮就重分类，达标即返回；整批打完才结算增幅，不足就降级，宁多读、不漏答案：

```python
CLARIFICATION_BATCH_SIZE = 3          # 每批追问轮数
MIN_CONFIDENCE_GAIN_PER_BATCH = 0.10  # 每批最低增幅：10 个百分点

while True:
    batch_start_confidence = current.confidence
    for _ in range(CLARIFICATION_BATCH_SIZE):
        question = generate_question(query, tuple(exchanges)).strip()
        if not question:
            raise ValueError("The AI generated an empty clarification question.")

        answer = ask_user(question).strip()
        if not answer:
            raise ValueError("A clarification answer must not be empty.")

        exchanges.append(ClarificationExchange(question=question, answer=answer))
        current = reclassify(query, tuple(exchanges))      # 每答一轮，立即重分类
        turns.append(ClarificationTurn(question, answer, current))

        if current.confidence >= INTENT_CONFIDENCE_THRESHOLD:
            return IntentResolution(                        # 达标：按新意图选上下文
                initial_classification=initial_classification,
                final_classification=current,
                intent=current.intent,
                turns=tuple(turns),
                used_full_read_fallback=False,
            )

    confidence_gain = current.confidence - batch_start_confidence
    if confidence_gain + 1e-9 < MIN_CONFIDENCE_GAIN_PER_BATCH:
        return IntentResolution(                            # 增幅不足：降级全量读取
            initial_classification=initial_classification,
            final_classification=current,
            intent=IntentType.FULL_READ,
            turns=tuple(turns),
            used_full_read_fallback=True,
        )
```

**③ Token 采集：未知不估算为 0**（`person_knowledge/token_usage.py` 节选）——读取只认响应里的 usage 字段，类型不对或缺失一律记 None；快照每次重新计算，交付即不可变：

```python
def _read_non_negative_int(usage: object | None, name: str) -> int | None:
    value = getattr(usage, name, None)
    if value is None:
        model_extra = getattr(usage, "model_extra", None)
        if isinstance(model_extra, Mapping):
            value = model_extra.get(name)
    return value if type(value) is int and value >= 0 else None


class TokenUsageTracker:
    """Accumulate one workflow's request-level token usage and cache metrics."""

    def __init__(self) -> None:
        self._entries: list[TokenUsageEntry] = []

    def record_response(self, stage: TokenUsageStage, response: object) -> None:
        """Record actual usage fields from a successful API response."""
        usage = getattr(response, "usage", None)
        self._entries.append(
            TokenUsageEntry(
                stage=stage,
                input_tokens=_read_non_negative_int(usage, "prompt_tokens"),
                output_tokens=_read_non_negative_int(usage, "completion_tokens"),
                total_tokens=_read_non_negative_int(usage, "total_tokens"),
                cache_hit_tokens=_read_non_negative_int(usage, "prompt_cache_hit_tokens"),
                cache_miss_tokens=_read_non_negative_int(usage, "prompt_cache_miss_tokens"),
            )
        )

    def record_unknown(self, stage: TokenUsageStage) -> None:
        """Record an attempted API request for which no usage was returned."""
        self._entries.append(TokenUsageEntry(stage=stage, input_tokens=None, ...))

    def snapshot(self) -> TokenUsageSnapshot:
        """Return an immutable, freshly computed view of accumulated usage."""
        entries = tuple(self._entries)
        return TokenUsageSnapshot(
            requests=entries,
            total=_make_totals(entries),
            by_stage=MappingProxyType(
                {
                    stage: _make_totals(tuple(e for e in entries if e.stage == stage))
                    for stage in TokenUsageStage
                    if stage in {e.stage for e in entries}
                }
            ),
        )
```

## 复盘

「置信度增幅不足就降级全量」这个阈值规则，体现的是一种保守的工程哲学：意图分类不确定时，宁可多花 Token 也不冒漏答案的风险。而 compare 模式把「哪种上下文更靠谱」从主观感觉变成了可并排查看的证据——策略对比不该靠感觉，应该放进同一次运行里。
