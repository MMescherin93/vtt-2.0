"""Генерирует иконку приложения VTT (ICO + PNG) без внешних зависимостей кроме Pillow."""

import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "desktop-host", "build")
SIZE = 256

BG = (20, 22, 31, 255)
BORDER = (99, 102, 241, 255)
DIE_DARK = (67, 56, 202, 255)
DIE_LIGHT = (99, 102, 241, 255)
DIE_EDGE = (199, 210, 254, 255)
TEXT = (248, 250, 252, 255)


def hexagon(cx: float, cy: float, radius: float) -> list[tuple[float, float]]:
    return [
        (cx + radius * math.cos(math.radians(angle)), cy + radius * math.sin(math.radians(angle)))
        for angle in range(-90, 270, 60)
    ]


def find_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\Arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def build_image() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Тёмная скруглённая плитка с акцентной рамкой
    draw.rounded_rectangle(
        [10, 10, SIZE - 10, SIZE - 10], radius=54, fill=BG, outline=BORDER, width=7
    )

    cx = cy = SIZE / 2
    radius = 82
    points = hexagon(cx, cy, radius)

    # Тело d20
    draw.polygon(points, fill=DIE_DARK, outline=DIE_EDGE)

    # Верхние грани (светлый треугольник через вершины)
    inner = [points[0], points[2], points[4]]
    draw.polygon(inner, fill=DIE_LIGHT)

    # Рёбра к центру
    for point in points:
        draw.line([point, (cx, cy)], fill=DIE_EDGE, width=4)

    # Контур ещё раз — чтобы рёбра не выходили за границу
    draw.polygon(points, outline=DIE_EDGE, width=5)

    # Число 20
    font = find_font(84)
    text = "20"
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    draw.text(
        (cx - (right - left) / 2 - left, cy - (bottom - top) / 2 - top + 2),
        text,
        font=font,
        fill=TEXT,
    )

    return image


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    image = build_image()
    png_path = os.path.join(OUT_DIR, "icon.png")
    ico_path = os.path.join(OUT_DIR, "icon.ico")
    image.save(png_path)
    image.save(ico_path, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Иконка: {ico_path}")
    print(f"PNG:    {png_path}")


if __name__ == "__main__":
    main()
