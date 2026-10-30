#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/check_content.py —— 内容契约预检（CI 双门禁之一，阻断式）

职责（phase1-eng §2.4-6 安全红线 + §5.2 schema）：
  1. schema 预校验：front-matter 必填字段 / slug 规范 / status 枚举 / summary 长度 / category 推荐列表
  2. 敏感信息扫描：密钥、PAT、私钥、.env 赋值等高危模式（零依赖，自含 front-matter 解析）
  3. 图片体积检查：public/images 下 >2MB 文件即失败（原始图必须先过 optimize_image.py）

退出码：0 = 通过（允许警告）；1 = 存在错误（CI 中止，不上线）。
用法：python3 scripts/check_content.py   （在仓库根目录执行，亦可从任意目录以绝对路径调用）
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "content"
PUBLIC_IMAGES = ROOT / "public" / "images"

# 笔记分类推荐列表（AGENTS.md 自动归类规则；不在列表内 = 警告不阻断）
# 2026-10-29：用户批准新增「智能客服」分类（原 FastAPI/智能客服/ 系列 12 篇独立成类）
RECOMMENDED_CATEGORIES = {
    "AI knowledge", "AI prompt", "AIPERSON", "FastAPI",
    "HTTP knowledges", "Python", "agent ai", "code_knowledge", "后端基础学习",
    "智能客服",
}

# 项目分类推荐列表（2026-10-30 M2 建档时确立；不在列表内 = 警告不阻断）
PROJECT_RECOMMENDED_CATEGORIES = {
    "智能体", "RAG 应用", "AI 产品", "后端服务", "工具", "工程实践",
}

SLUG_RE = re.compile(r"^[a-z0-9-]+$")
STATUS_VALUES = {"draft", "published", "archived"}
DEMO_TYPES = {"static", "external", "none"}

# 敏感信息模式（具体前缀/结构优先，避免误伤正文里的英文单词）
SECRET_PATTERNS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "私钥块"),
    (re.compile(r"ghp_[A-Za-z0-9]{36}"), "GitHub PAT (ghp_)"),
    (re.compile(r"github_pat_[A-Za-z0-9_]{22,}"), "GitHub fine-grained PAT"),
    (re.compile(r"sk-[A-Za-z0-9]{20,}"), "API key (sk- 前缀)"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS Access Key"),
    (re.compile(r"(?i)\b(api[_-]?key|secret[_-]?key|access[_-]?token|password|passwd)\b\s*[:=]\s*['\"]?[A-Za-z0-9/+_\-]{12,}"), "密钥赋值"),
    (re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-]{20,}"), "Bearer token"),
]


def _is_placeholder(value: str) -> bool:
    """占位符判别：真实密钥几乎必然含数字；纯字母/连字符值（如 my-secret-key、
    should_be_filtered）是教学示例与测试夹具，不拦截。精确模式（ghp_/sk-/AKIA 等）
    不受此函数影响，仍全量拦截。"""
    return not any(ch.isdigit() for ch in value)

MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2MB 硬限（phase1-eng §2.4-6）
MAX_SUMMARY_LEN = 120


# ---------- front-matter 解析（YAML 子集，零依赖） ----------

def parse_front_matter(text: str):
    """返回 (dict, error)。error 非空表示解析失败。"""
    if not text.startswith("---"):
        return None, "缺少 front-matter 起始 ---"
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return None, "front-matter 未正确闭合（需要 --- ... ---）"
    data: dict = {}
    key = None
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        item = re.match(r"^\s*-\s+(.*)$", line)
        if item:
            if key is None:
                return None, f"列表项出现在任何键之前: {line!r}"
            if not isinstance(data.get(key), list):
                data[key] = []
            data[key].append(_scalar(item.group(1)))
            continue
        kv = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if kv:
            key, val = kv.group(1), kv.group(2).strip()
            data[key] = _scalar(val) if val else []
        else:
            return None, f"无法解析的 front-matter 行: {line!r}"
    return data, None


def _scalar(v: str):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        return [_scalar(x) for x in inner.split(",")] if inner else []
    if v in ("true", "True"):
        return True
    if v in ("false", "False"):
        return False
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


# ---------- 校验逻辑 ----------

class Report:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.checked = 0

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def check_collection(report: Report, collection: str, required: list[str]):
    cdir = SRC / collection
    if not cdir.is_dir():
        report.warn(f"[{collection}] 目录不存在，跳过（M0 空集合正常）")
        return
    files = sorted(cdir.rglob("*.md"))
    if not files:
        report.warn(f"[{collection}] 无 .md 文件（M0 空集合正常）")
        return
    for f in files:
        report.checked += 1
        rel = f.relative_to(ROOT).as_posix()
        fm, err = parse_front_matter(f.read_text(encoding="utf-8"))
        if err:
            report.error(f"{rel}: {err}")
            continue
        for k in required:
            if k not in fm or fm[k] in (None, ""):
                report.error(f"{rel}: 缺少必填字段 '{k}'")
        slug = fm.get("slug")
        if isinstance(slug, str) and not SLUG_RE.match(slug):
            report.error(f"{rel}: slug '{slug}' 不合规（须为 kebab-case：^[a-z0-9-]+$）")
        if isinstance(slug, str) and f.stem != slug:
            report.error(f"{rel}: 文件名({f.stem})与 slug({slug})不一致（契约：文件名 = slug）")
        status = fm.get("status", "draft")
        if status not in STATUS_VALUES:
            report.error(f"{rel}: status '{status}' 非法（须为 {sorted(STATUS_VALUES)}）")
        summary = fm.get("summary")
        if isinstance(summary, str) and len(summary) > MAX_SUMMARY_LEN:
            report.error(f"{rel}: summary 超长（{len(summary)} > {MAX_SUMMARY_LEN} 字符）")
        if collection == "notes":
            cat = fm.get("category")
            if cat and cat not in RECOMMENDED_CATEGORIES:
                report.warn(f"{rel}: 新分类 '{cat}'（不在 9 类推荐列表，请确认是否保留）")
        if collection == "projects":
            cat = fm.get("category")
            if cat and cat not in PROJECT_RECOMMENDED_CATEGORIES:
                report.warn(f"{rel}: 新项目分类 '{cat}'（不在推荐列表，请确认是否保留）")
            dt = fm.get("demo_type", "none")
            if dt not in DEMO_TYPES:
                report.error(f"{rel}: demo_type '{dt}' 非法（须为 {sorted(DEMO_TYPES)}）")
            repo = fm.get("repo_url")
            if repo and not re.match(r"^https?://", str(repo)):
                report.error(f"{rel}: repo_url 须为完整 URL（http/https 开头）")


def check_gallery(report: Report):
    gfile = SRC / "gallery.json"
    if not gfile.exists():
        report.warn("[gallery] gallery.json 不存在，跳过（M0 空集合正常）")
        return
    report.checked += 1
    rel = gfile.relative_to(ROOT).as_posix()
    try:
        import json
        data = json.loads(gfile.read_text(encoding="utf-8"))
    except Exception as e:
        report.error(f"{rel}: JSON 解析失败: {e}")
        return
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        report.error(f"{rel}: 顶层须为 {{\"items\": [...]}}")
        return
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            report.error(f"{rel}: items[{i}] 须为对象")
            continue
        for k in ("slug", "src", "date"):
            if k not in it:
                report.error(f"{rel}: items[{i}] 缺少 '{k}'")
        st = it.get("status", "draft")
        if st not in STATUS_VALUES:
            report.error(f"{rel}: items[{i}] status '{st}' 非法")
        src = it.get("src")
        if src and not (PUBLIC_IMAGES / "gallery" / str(src)).exists():
            report.error(f"{rel}: items[{i}] src '{src}' 在 public/images/gallery/ 不存在")


def check_secrets(report: Report):
    """扫描全部文本源文件的高危密钥模式（diff 级兜底，.gitignore 之外的第二道）"""
    targets = []
    for sub in ("src", "worker", "scripts", "public"):
        base = ROOT / sub
        if base.is_dir():
            targets += [p for p in base.rglob("*") if p.is_file() and p.suffix.lower() in (".md", ".json", ".js", ".ts", ".astro", ".mjs", ".css", ".html", ".toml", ".yml", ".yaml", ".txt")]
    for f in targets:
        rel = f.relative_to(ROOT).as_posix()
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for pat, name in SECRET_PATTERNS:
            for m in pat.finditer(text):
                # 通用「密钥赋值」模式对占位符放行（精确模式不放行）
                if name == "密钥赋值":
                    value = m.group(0).split(":", 1)[-1].split("=", 1)[-1].strip().strip("'\"")
                    if _is_placeholder(value):
                        continue
                report.error(f"{rel}: 疑似敏感信息（{name}）——请移除后重试（安全红线）")
                break  # 同一文件同一模式报一次即止


def check_env_files(report: Report):
    for p in ROOT.rglob(".env*"):
        if p.name != ".env.example":
            report.error(f"{p.relative_to(ROOT).as_posix()}: .env 文件禁止入库（安全红线，仅允许 .env.example）")
    for db in list(ROOT.rglob("*.db")) + list(ROOT.rglob("*.sqlite3")):
        report.error(f"{db.relative_to(ROOT).as_posix()}: 数据库文件禁止入库（安全红线）")


def check_image_sizes(report: Report):
    if not PUBLIC_IMAGES.is_dir():
        return
    for f in PUBLIC_IMAGES.rglob("*"):
        if f.is_file() and f.stat().st_size > MAX_IMAGE_BYTES:
            mb = f.stat().st_size / 1024 / 1024
            report.error(f"{f.relative_to(ROOT).as_posix()}: {mb:.2f}MB 超过 2MB 硬限——先执行 python3 scripts/optimize_image.py")


def main() -> int:
    report = Report()
    check_collection(report, "notes", ["title", "slug", "date", "status", "summary", "category"])
    check_collection(report, "projects", ["title", "slug", "date", "status", "summary", "category"])
    check_gallery(report)
    check_env_files(report)
    check_secrets(report)
    check_image_sizes(report)

    for w in report.warnings:
        print(f"⚠️  {w}")
    for e in report.errors:
        print(f"❌ {e}")

    if report.errors:
        print(f"\n门禁①未通过：{len(report.errors)} 个错误 / {len(report.warnings)} 个警告（已校验 {report.checked} 个内容条目）")
        return 1
    print(f"✅ 门禁①通过：{report.checked} 个内容条目全部合规（{len(report.warnings)} 个警告不阻断）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
