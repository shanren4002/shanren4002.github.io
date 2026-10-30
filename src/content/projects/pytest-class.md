---
title: PytestClass · 测试教学仓库
slug: pytest-class
category: 工程实践
tags: [Python, pytest, 测试]
date: 2026-08-24
status: published
summary: pytest 最小教学仓库：用可运行的最小例子讲清 fixture、conftest 与测试组织，附 pytest-html 执行报告。
tech_stack: [Python, pytest]
demo_type: static
demo_url: /demos/pytest-class/index.html
featured: false
source: 项目/PytestClass
---

## 项目简介

一个 pytest 测试教学仓库：不堆概念，只用一个能跑起来的最小例子，把 fixture、conftest 与测试组织这些最容易混淆的用法固定下来。附带一份 pytest-html 执行报告，展示测试结果的标准呈现方式。

## 核心能力

- **fixture 共享机制**：通过 `conftest.py` 演示 fixture 的定义、共享与作用域
- **测试组织范式**：`test_base.py` 示范用例命名、组织与断言的写法
- **配置示范**：`pytest.ini` 展示测试发现规则与运行配置
- **报告样例**：`report.html` 为 pytest-html 执行产物，可直接在浏览器查看

## 技术架构

Python + pytest 最小工程：`conftest.py`（共享 fixture）、`test_base.py`（基础用例）、`main.py`（被测目标）、`pytest.ini`（配置）、`report.html`（执行报告）。零第三方业务依赖，克隆即可运行。

## 复盘

教是最好的学——把「fixture 作用域」「conftest 查找规则」这些看十遍教程还会忘的概念，用一个能跑的最小例子固定下来，理解成本骤降。这个仓库也是后来所有项目测试体系的起点：从智能客服 API 的分层测试到 Campus Agent 的 143 项测试，根都扎在这里。
