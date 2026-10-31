---
title: "G12 回滚实测专用违规条目"
slug: "Rollback_Test"
date: 2026-10-31
status: draft
summary: "这是一条故意违反门禁①的测试条目：slug 含大写与下划线，不合 kebab-case 规范，check_content.py 必须拦截。验证完成后立即 revert，不会进入线上。"
category: "工程实践"
---

# G12 回滚实测

本条目用于验证 GitHub Actions 双门禁的回滚行为：

- 门禁① `scripts/check_content.py` 应拦截非法 slug（`^[a-z0-9-]+$`）；
- 构建 job 失败 → 部署 job（needs: build）不运行 → 线上保持上一可用版本；
- 本 commit 将被 revert，不进入最终交付。
