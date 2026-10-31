#!/usr/bin/env python3
"""optimize_image.py —— 图片管线（AGENTS.md §上传契约 · M3）

用法：
    python3 scripts/optimize_image.py <图片> --slug <kebab-case> [--out <目录>] [--date YYYYMMDD]

行为（与 AGENTS.md 命名/体积契约一一对应）：
  1. 命名规范：输出 `YYYYMMDD-<slug>-<序号>.webp`（序号在目标目录内自动递增）；
     输入文件名已符合规范时直接沿用其日期/序号推断。
  2. 体积契约：长边 ≤1920px（超出按比例缩放，不放大），转 WebP；
     列表页缩略图同名 `-thumb.webp`（宽 640）。
  3. EXIF 方向自动转正；CMYK/RGBA 统一转 RGB（WebP 兼容）。
  4. 输出 >2MB 直接报错（check_content.py 门禁同款硬限，防呆）。

退出码：0 成功；1 用法/文件错误；2 处理后仍超限。
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # 允许 --help 在无 Pillow 环境查看用法
    Image = None
    ImageOps = None

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "public" / "images" / "gallery"

MAX_EDGE = 1920          # 长边上限（全案 §4.2：Pages 仓库体积治理）
THUMB_WIDTH = 640        # 列表页缩略图宽（AGENTS.md 命名契约）
MAX_BYTES = 2 * 1024 * 1024  # 2MB 硬限（check_content.py 同款）
WEBP_QUALITY = 82        # 画质/体积平衡点（彩铅风插画实测区间）

NAME_RE = re.compile(r"^(?P<date>\d{8})-(?P<slug>[a-z0-9-]+)-(?P<seq>\d{2})$")
INPUT_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}


def _die(msg: str, code: int = 1) -> None:
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(code)


def _next_seq(out_dir: Path, day: str, slug: str) -> int:
    """目标目录内同日期同 slug 的序号自动递增（从 01 开始）。"""
    used = set()
    for f in out_dir.glob(f"{day}-{slug}-*.webp"):
        m = NAME_RE.match(f.stem)
        if m:
            used.add(int(m.group("seq")))
    seq = 1
    while seq in used:
        seq += 1
    return seq


def _save_webp(img, dest: Path, quality: int) -> int:
    img.save(dest, "WEBP", quality=quality, method=6)
    return dest.stat().st_size


def _resize_long_edge(img, max_edge: int):
    """长边超限则按比例缩小；不放大小图。"""
    w, h = img.size
    long_edge = max(w, h)
    if long_edge <= max_edge:
        return img
    ratio = max_edge / long_edge
    return img.resize((round(w * ratio), round(h * ratio)), Image.LANCZOS)


def main() -> int:
    if Image is None or ImageOps is None:
        _die("缺少 Pillow：请先执行 python3 -m pip install Pillow")

    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv else 1

    src = Path(argv[0])
    slug = None
    out_dir = DEFAULT_OUT
    day = date.today().strftime("%Y%m%d")

    # —— 参数解析（零依赖手写，不用 argparse 的 sub 复杂度）——
    i = 1
    while i < len(argv):
        if argv[i] == "--slug":
            i += 1
            if i >= len(argv):
                _die("--slug 缺少值")
            slug = argv[i]
        elif argv[i] == "--out":
            i += 1
            if i >= len(argv):
                _die("--out 缺少值")
            out_dir = Path(argv[i])
        elif argv[i] == "--date":
            i += 1
            if i >= len(argv):
                _die("--date 缺少值")
            day = argv[i]
        else:
            _die(f"未知参数：{argv[i]}")
        i += 1

    if not src.is_file():
        _die(f"文件不存在：{src}")
    if src.suffix.lower() not in INPUT_EXTS:
        _die(f"不支持的格式 {src.suffix}（支持：{', '.join(sorted(INPUT_EXTS))}）")
    if not re.fullmatch(r"\d{8}", day):
        _die(f"--date 须为 YYYYMMDD：{day}")

    # 输入名已符合规范 → 沿用其日期与 slug
    m = NAME_RE.match(src.stem)
    if m and slug is None:
        day = m.group("date")
        slug = m.group("slug")

    if slug is None:
        _die("缺少 --slug（kebab-case，如 cyber-city）；或让输入文件名符合 YYYYMMDD-<slug>-<序号> 规范")
    if not re.fullmatch(r"[a-z0-9-]+", slug):
        _die(f"slug 不合规（须 kebab-case）：{slug}")

    out_dir.mkdir(parents=True, exist_ok=True)
    if m and slug == m.group("slug") and day == m.group("date"):
        seq = int(m.group("seq"))
    else:
        seq = _next_seq(out_dir, day, slug)
    name = f"{day}-{slug}-{seq:02d}.webp"
    dest = out_dir / name
    thumb = out_dir / f"{day}-{slug}-{seq:02d}-thumb.webp"
    if dest.exists() or thumb.exists():
        _die(f"目标已存在：{dest.name}（换 slug 或先清理）")

    # —— 处理：转正 → 转 RGB → 缩放长边 → WebP ——
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        orig_size = im.size
        big = _resize_long_edge(im, MAX_EDGE)

    big_size = _save_webp(big, dest, WEBP_QUALITY)
    if big_size > MAX_BYTES:
        dest.unlink()
        _die(f"主图仍超 2MB（{big_size/1024/1024:.2f}MB）：请换更小的源图或联系开发者加质量参数", 2)

    # 缩略图：宽 640，高度按比例
    tw = THUMB_WIDTH
    th = round(big.height * tw / big.width) if big.width >= tw else big.height
    thumb_img = big if big.width <= tw else big.resize((tw, th), Image.LANCZOS)
    thumb_size = _save_webp(thumb_img, thumb, WEBP_QUALITY)

    ratio = (big.width / orig_size[0]) if orig_size[0] else 1
    zoom = "原尺寸" if ratio == 1 else f"{ratio:.0%} 缩放"
    print(f"✓ 主图    {name}  {big.width}×{big.height}（{zoom}）  {big_size/1024:.0f}KB")
    print(f"✓ 缩略图  {thumb.name}  {thumb_img.width}×{thumb_img.height}  {thumb_size/1024:.0f}KB")
    print(f"  目录    {out_dir.relative_to(ROOT) if out_dir.is_relative_to(ROOT) else out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
