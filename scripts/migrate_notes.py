#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/migrate_notes.py —— M1 笔记迁移脚本（一次性，可重复执行）

从工作区素材 inbox（仓库根的 ../笔记/）按 scripts/m1-manifest.json 清单
生成 src/content/notes/<slug>.md：注入 front-matter + 清理 Obsidian 死图嵌入。

设计原则：
- 正文逐字保留，只做两类清理：① 删除 ![[...]] 图片嵌入（本仓无图片资产，留着是死链）
  ② [[...]] 双链褪裸为纯文本（避免 Astro 渲染出原始方括号）
- 幂等：重复执行覆盖同一批文件，结果一致
- 安全：只写 src/content/notes/，绝不反向修改 inbox

用法：python3 scripts/migrate_notes.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT.parent  # manifest 的 src 路径相对工作区根（含「笔记/」前缀，与 source 字段一致）
TARGET = ROOT / "src" / "content" / "notes"
MANIFEST = ROOT / "scripts" / "m1-manifest.json"

# ![[Pasted image 20260828154228.png]] → （整行删除）
OBSIDIAN_IMG = re.compile(r"[ \t]*!\[\[[^\]]*\]\][ \t]*\n?")
# [[目标|别名]] / [[目标]] → 别名或目标（褪裸为纯文本）
WIKI_LINK = re.compile(r"\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]")


def yaml_quote(s: str) -> str:
    """YAML 双引号标量：转义反斜杠与双引号"""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def clean_body(text: str) -> tuple[str, int, int]:
    """返回 (清理后正文, 删除的图片嵌入数, 褪裸的双链数)"""
    imgs = len(OBSIDIAN_IMG.findall(text))
    text = OBSIDIAN_IMG.sub("", text)
    links = len(WIKI_LINK.findall(text))
    text = WIKI_LINK.sub(lambda m: (m.group(2) or m.group(1)).strip(), text)
    return text.strip() + "\n", imgs, links


def build_front_matter(n: dict) -> str:
    tags = ", ".join(n["tags"])
    lines = [
        "---",
        f"title: {yaml_quote(n['title'])}",
        f"slug: {n['slug']}",
        f"category: {yaml_quote(n['category'])}",
        f"tags: [{tags}]",
        f"date: {n['date']}",
        f"status: {n['status']}",
        f"summary: {yaml_quote(n['summary'])}",
        f"source: {yaml_quote(n['src'])}",
        "---",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    status = manifest.get("status", "draft")
    notes = manifest["notes"]

    TARGET.mkdir(parents=True, exist_ok=True)

    ok, skipped, img_total, link_total = 0, 0, 0, 0
    slugs_seen: set[str] = set()

    for n in notes:
        src = INBOX / n["src"]
        rel = src.relative_to(INBOX).as_posix() if src.exists() else n["src"]

        if n["slug"] in slugs_seen:
            print(f"❌ slug 重复: {n['slug']}（{rel}）")
            return 1
        slugs_seen.add(n["slug"])

        if not src.exists():
            print(f"❌ 源文件不存在: {rel}")
            return 1

        text = src.read_text(encoding="utf-8")
        if not text.strip():
            skipped += 1
            print(f"⚠️  跳过空文件: {rel}")
            continue

        body, imgs, links = clean_body(text)
        img_total += imgs
        link_total += links

        out = TARGET / f"{n['slug']}.md"
        out.write_text(build_front_matter({**n, "status": status}) + body, encoding="utf-8")
        ok += 1
        flags = []
        if imgs:
            flags.append(f"清图嵌×{imgs}")
        if links:
            flags.append(f"褪双链×{links}")
        suffix = f"（{'，'.join(flags)}）" if flags else ""
        print(f"✅ {n['slug']}.md ← {rel} [{n['category']}] {suffix}")

    print(f"\n迁移完成：{ok} 篇写入 src/content/notes/，跳过 {skipped} 篇；"
          f"共清理图片嵌入 {img_total} 处、双链 {link_total} 处；status 统一为 {status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
