---
title: "Python 虚拟环境与依赖管理"
slug: python-venv-deps
category: "Python"
tags: [Python, venv]
date: 2026-09-17
status: draft
summary: "创建虚拟环境隔离项目依赖的完整命令与流程"
source: "笔记/Python/虚拟环境于依赖管理.md"
---
### 创建虚拟环境隔离
```
# 创建虚拟环境
python -m venv .venv

# 激活
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 安装依赖
pip install fastapi uvicorn

# 导出依赖
pip freeze > requirements.txt
```
