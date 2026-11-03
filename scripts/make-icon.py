"""Генерирует иконки VTT: d20 в тёмной плитке с подсветкой и сеткой.

Создаёт:
  desktop-host/build/icon.png    — 256×256 для окна/README
  desktop-host/build/icon.ico    — мультиразмерный ICO для ярлыка и Electron
  web-client/public/favicon.png  — 128×128 для вкладки браузера
"""

import io
import math
import os
import struct

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(ROOT, "desktop-host", "build")
PUBLIC_DIR = os.path.join(ROOT, "web-client", "public")

# Мастер-размер: рисуем крупно и уменьшаем — так края остаются гладкими
S = 1024
MARGIN = 44
RADIUS = 208

BG_TOP = (28, 33, 48)
BG_BOTTOM = (10, 12, 18)
INDIGO = (99, 102, 241)
INDIGO_LIGHT = (96, 98, 232)
INDIGO_DEEP = (38, 35, 104)
EDGE = (222, 228, 255)


def vertical_gradient(
    size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]
) -> Image.Image:
    strip = Image.new("RGBA", (1, size[1]))
    px = strip.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        px[0, y] = (
            round(top[0] + (bottom[0] - top[0]) * t),
            round(top[1] + (bottom[1] - top[1]) * t),
            round(top[2] + (bottom[2] - top[2]) * t),
            255,
        )
    return strip.resize(size, Image.Resampling.BILINEAR)


def rounded_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [MARGIN, MARGIN, size - MARGIN, size - MARGIN], radius=RADIUS, fill=255
    )
    return mask


def hexagon(cx: float, cy: float, radius: float) -> list[tuple[float, float]]:
    return [
        (
            cx + radius * math.cos(math.radians(-90 + 60 * i)),
            cy + radius * math.sin(math.radians(-90 + 60 * i)),
        )
        for i in range(6)
    ]


def find_font(size: int) -> ImageFont.FreeTypeFont:
    for path in (
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\Arial.ttf",
    ):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def draw_background(size: int) -> Image.Image:
    base = vertical_gradient((size, size), BG_TOP, BG_BOTTOM)
    base.putalpha(rounded_mask(size))

    # Мягкое индиго-свечение вокруг кубика
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        [size * 0.18, size * 0.16, size * 0.82, size * 0.92], fill=(99, 102, 241, 90)
    )
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    glow.putalpha(ImageChops.multiply(glow.getchannel("A"), rounded_mask(size)))
    base = Image.alpha_composite(base, glow)

    # Едва заметная сетка — намёк на карту
    grid = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    step = size // 9
    for x in range(step, size, step):
        gd.line([(x, MARGIN), (x, size - MARGIN)], fill=(255, 255, 255, 16), width=2)
    for y in range(step, size, step):
        gd.line([(MARGIN, y), (size - MARGIN, y)], fill=(255, 255, 255, 16), width=2)
    grid.putalpha(ImageChops.multiply(grid.getchannel("A"), rounded_mask(size)))
    base = Image.alpha_composite(base, grid)
    return base


def build_master(with_label: bool = True) -> Image.Image:
    image = draw_background(S)

    cx = cy = S / 2
    cy += S * 0.012
    radius = S * 0.285
    points = hexagon(cx, cy, radius)

    # Тень под кубиком
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse(
        [cx - radius * 0.95, cy + radius * 0.55, cx + radius * 0.95, cy + radius * 1.05],
        fill=(0, 0, 0, 150),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(70))
    image = Image.alpha_composite(image, shadow)

    # Свечение кубика
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(points, fill=(120, 122, 255, 190))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    image = Image.alpha_composite(image, glow)

    # Тело кубика: вертикальный градиент, обрезанный по гексагону
    body = vertical_gradient((S, S), INDIGO_LIGHT, INDIGO_DEEP)
    body_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(body_mask).polygon(points, fill=255)
    body.putalpha(body_mask)
    image = Image.alpha_composite(image, body)

    # Все детали кубика и подписи рисуем на отдельных слоях и аккуратно
    # композитим: ImageDraw не смешивает альфу, а заменяет пиксели.
    facets = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    fd = ImageDraw.Draw(facets)

    # Внутренняя треугольная грань (как у d20)
    inner = [points[0], points[2], points[4]]
    fd.polygon(inner, fill=(255, 255, 255, 26))

    # Рёбра к вершинам
    for point in points:
        fd.line([point, (cx, cy)], fill=(*EDGE, 190), width=8)

    # Контур
    fd.line(points + [points[0]], fill=(*EDGE, 235), width=10, joint="curve")
    image = Image.alpha_composite(image, facets)

    # Мягкий блик сверху
    highlight = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(highlight).polygon(
        [points[0], points[1], (cx, cy)], fill=(255, 255, 255, 46)
    )
    highlight = highlight.filter(ImageFilter.GaussianBlur(20))
    image = Image.alpha_composite(image, highlight)

    # Число 20 с тёмной обводкой — читается на любой грани.
    # На маленьких размерах (16–24 px) подпись превращается в кашу, поэтому
    # для них собирается вариант без цифры.
    if with_label:
        label = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ld = ImageDraw.Draw(label)
        font = find_font(round(radius * 0.92))
        text = "20"
        bbox = ld.textbbox((0, 0), text, font=font, stroke_width=7)
        tx = cx - (bbox[2] - bbox[0]) / 2 - bbox[0]
        ty = cy - (bbox[3] - bbox[1]) / 2 - bbox[1] + radius * 0.02
        ld.text(
            (tx, ty),
            text,
            font=font,
            fill=(255, 255, 255, 255),
            stroke_width=7,
            stroke_fill=(22, 18, 62, 255),
        )
        image = Image.alpha_composite(image, label)

    # Акцентная рамка плитки
    border = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle(
        [MARGIN, MARGIN, S - MARGIN, S - MARGIN],
        radius=RADIUS,
        outline=(*INDIGO, 235),
        width=9,
    )
    bd.rounded_rectangle(
        [MARGIN + 14, MARGIN + 14, S - MARGIN - 14, S - MARGIN - 14],
        radius=RADIUS - 14,
        outline=(255, 255, 255, 26),
        width=3,
    )
    image = Image.alpha_composite(image, border)

    # Финальная маска — ровные скруглённые края
    image.putalpha(ImageChops.multiply(image.getchannel("A"), rounded_mask(S)))
    return image


def save_ico(path: str, images: dict[int, Image.Image]) -> None:
    """Собирает ICO из PNG-кадров (поддерживается Windows Vista+)."""
    entries: list[tuple[int, int, int]] = []
    blobs: list[bytes] = []
    offset = 6 + 16 * len(images)

    for size in sorted(images):
        buffer = io.BytesIO()
        images[size].save(buffer, format="PNG", optimize=True)
        data = buffer.getvalue()
        entries.append((size, len(data), offset))
        blobs.append(data)
        offset += len(data)

    with open(path, "wb") as file:
        file.write(struct.pack("<HHH", 0, 1, len(entries)))
        for size, length, position in entries:
            dimension = 0 if size >= 256 else size
            file.write(
                struct.pack(
                    "<BBBBHHII", dimension, dimension, 0, 0, 1, 32, length, position
                )
            )
        for blob in blobs:
            file.write(blob)


def main() -> None:
    os.makedirs(BUILD_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    master = build_master(with_label=True)
    # Для крошечных размеров цифра не читается — берём вариант без неё
    simple = build_master(with_label=False)

    sizes_with_label = [32, 40, 48, 64, 96, 128, 256]
    sizes_simple = [16, 20, 24]
    images: dict[int, Image.Image] = {}
    for size in sizes_with_label:
        images[size] = master.resize((size, size), Image.Resampling.LANCZOS)
    for size in sizes_simple:
        images[size] = simple.resize((size, size), Image.Resampling.LANCZOS)

    icon_png = os.path.join(BUILD_DIR, "icon.png")
    icon_ico = os.path.join(BUILD_DIR, "icon.ico")
    favicon = os.path.join(PUBLIC_DIR, "favicon.png")

    images[256].save(icon_png)
    images[128].save(favicon)
    save_ico(icon_ico, images)

    print(f"Иконка:  {icon_ico}")
    print(f"PNG:     {icon_png}")
    print(f"Favicon: {favicon}")


if __name__ == "__main__":
    main()
