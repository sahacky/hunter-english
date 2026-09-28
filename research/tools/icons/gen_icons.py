#!/usr/bin/env python3
"""Генератор PWA-иконок Hunter English (plan://M9#9.1).

Мотив «Врата» (specs/04 §3): двойной шеврон вверх на тёмном фоне.
Обычные иконки — скруглённый квадрат, maskable — full-bleed с контентом
в safe-zone 80% (specs/08 §2). Запуск из корня репо:

    python3 research/tools/icons/gen_icons.py

Требует Pillow (как и аудио-пайплайн M3).
"""

from pathlib import Path

from PIL import Image, ImageDraw

BG = (7, 11, 20, 255)        # --bg #070B14
SURFACE = (12, 28, 52, 255)  # --surface #0C1C34
PRIMARY = (79, 195, 247, 255)  # --primary #4FC3F7
ACCENT2 = (167, 139, 250, 255)  # --accent-2 #A78BFA

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public" / "icons"


def chevron(draw: ImageDraw.ImageDraw, cx: float, cy: float, w: float, h: float, color) -> None:
    """Один шеврон вверх с вершиной в (cx, cy), «ногами» шириной w и вниз на h."""
    draw.polygon(
        [(cx, cy), (cx + w / 2, cy + h), (cx + w / 4, cy + h), (cx, cy + h / 2.2),
         (cx - w / 4, cy + h), (cx - w / 2, cy + h)],
        fill=color,
    )


def draw_gates(draw: ImageDraw.ImageDraw, size: int, scale: float) -> None:
    """Двойной шеврон по центру; scale=1.0 — контент занимает ~55% стороны."""
    s = size * scale
    cx = size / 2
    top = size / 2 - s * 0.32
    chevron(draw, cx, top, s * 0.72, s * 0.30, PRIMARY)
    chevron(draw, cx, top + s * 0.34, s * 0.72, s * 0.30, ACCENT2)


def make_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        # full-bleed фон (любая маска системы), контент в safe-zone ~80%
        draw.rectangle([0, 0, size, size], fill=BG)
        draw_gates(draw, size, 0.8)
    else:
        radius = size * 0.22
        draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=SURFACE)
        # тонкая рамка цвета --border
        border = (29, 58, 95, 255)
        draw.rounded_rectangle([1, 1, size - 2, size - 2], radius=radius, outline=border, width=max(1, size // 64))
        draw_gates(draw, size, 1.0)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        make_icon(size, False).save(OUT / f"icon-{size}.png")
    make_icon(512, True).save(OUT / "maskable-512.png")
    print(f"OK: {OUT}")


if __name__ == "__main__":
    main()
