---
title: "智能客服数据库初始化问题排查"
slug: smart-cs-db-init-issues
category: "智能客服"
tags: [Python, 数据库, 排错]
date: 2026-09-24
status: published
summary: "Python 3.14 环境下 SQLAlchemy/NumPy/LangChain 连环报错的解决全记录"
source: "笔记/FastAPI/智能客服/初始化数据库问题.md"
---
---

## 🎯 本次经历总结

### 一、核心问题与解决过程

| 阶段 | 报错 | 根本原因 | 解决方案 |
|---|---|---|---|
| 1 | `ModuleNotFoundError: No module named 'app'` | 直接运行 `python app/db/init_db.py`，Python 把 `app/db/` 当工作目录，找不到 `app` 包 | 回到项目根目录，用 `python -m app.db.init_db`（模块方式运行） |
| 2 | `AssertionError: Class ... directly inherits TypingOnly` | Python 3.14 太新，旧版 SQLAlchemy 未适配其新增的 `__firstlineno__` 等属性 | 升级 SQLAlchemy 到 `2.0.51`（适配 3.14 的版本） |
| 3 | `numpy` 构建失败（`Unknown compiler(s)`） | Python 3.14 没有旧版 numpy 的预编译 wheel，pip 尝试源码编译，但系统无 C 编译器 | 强制使用 `numpy>=2.3.2`，加 `--only-binary :all:` |
| 4 | `ResolutionImpossible`（依赖冲突） | `langchain 0.3.7` 依赖 `numpy<2.0.0`，与 Python 3.14 必须的 `numpy>=2.3.2` 直接冲突 | 升级 LangChain 到 1.x 版本，适配 NumPy 2.x |

### 二、真正的问题根源

这次连环报错，本质上是 **Python 3.14 太新，AI 生态还没完全跟上** 导致的。

- Python 3.14 于 2025 年发布，引入了新的类型系统内部属性。
- SQLAlchemy、NumPy、LangChain 这些库的旧版本没有适配，就会在导入或编译阶段报错。
- 你之前没有虚拟环境，系统环境里的包版本混乱，进一步放大了问题。

### 三、这次经历教给你的几件事

**1. 运行 Python 项目，路径和方式很重要**
- 有 `app/` 这种包结构的项目，必须在**项目根目录**用 `python -m app.xxx` 运行，不能直接 `python app/xxx.py`。
- 这是 Python 模块系统的规则，以后所有项目都适用。

**2. 虚拟环境必须用**
- 系统环境安装的包会被所有项目共享，版本冲突几乎必然发生。
- 虚拟环境隔离后，每个项目有自己的依赖，互不影响。
- 这次你重建虚拟环境后问题才逐步收敛，以后每个新项目第一件事就是建虚拟环境。

**3. 新版本 Python ≠ 好事**
- Python 3.14 刚发布时，AI 生态（LangChain、NumPy、SQLAlchemy）往往还没适配完。
- 生产项目推荐用**主流稳定版**，如 Python 3.11 或 3.12，能避开 90% 的兼容性报错。

**4. 报错要先分类，再定位**
- `ModuleNotFoundError` → 路径/导入问题
- `AssertionError` / `ImportError` → 库版本兼容问题
- `metadata-generation-failed` → 缺少编译工具或没有预编译 wheel
- `ResolutionImpossible` → 依赖版本互相冲突

**5. 遇到依赖冲突，优先升级上层框架**
- `langchain 0.3.7` 与 `numpy>=2.3.2` 冲突，不要硬降 numpy，而是升级 langchain 到 1.x，让上层适配下层。

### 四、以后的标准操作流程（SOP）

```bash
# 1. 进入项目根目录
cd D:\App\JetBrains\py\FastAPIProjectTestAi

# 2. 创建虚拟环境（指定稳定 Python 版本）
py -3.12 -m venv .venv

# 3. 激活虚拟环境
.\.venv\Scripts\Activate.ps1

# 4. 升级 pip
python -m pip install --upgrade pip

# 5. 安装依赖（用 requirements.txt）
pip install -r requirements.txt

# 6. 初始化数据库（用 -m 方式运行）
python -m app.db.init_db

# 7. 启动服务
uvicorn app.main:app --reload
```

### 五、当前项目状态

你现在已经拥有：

- ✅ 可用的虚拟环境
- ✅ 兼容 Python 3.14 的依赖组合
- ✅ SQLAlchemy + aiosqlite 可正常初始化
- ✅ `smart_cs.db` 数据库文件已生成
- ✅ 项目包结构（`app/`、`app/db/`、`app/api/`）已建立
