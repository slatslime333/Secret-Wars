#!/usr/bin/env python3
"""South-facing Witch idle, designed as a small RPG battle sprite.

Native pixels. Same construction as the compact pass, scaled up to the
white-hair sheet's size and detail: round hair mass, larger eyes, 2–3
shade steps, stubby clothes. Not a downscale of the portrait.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "characters" / "witch"
PREVIEW = Path("/tmp/witch_south_idle")
REF = Path("/home/ubuntu/.cursor/projects/workspace/assets/528256f8-66f2-4d78-b5cf-a76b70cb76e2.jpg")

W, H = 64, 64
CX = 38

PALETTE: dict[str, tuple[int, int, int, int]] = {
    "h": (42, 26, 64, 255),
    "d": (22, 14, 36, 255),
    "l": (68, 44, 94, 255),
    "b": (206, 92, 142, 255),
    "n": (150, 54, 102, 255),
    "B": (232, 140, 176, 255),
    "a": (96, 40, 148, 255),
    "k": (56, 22, 92, 255),
    "i": (132, 68, 178, 255),
    "I": (158, 96, 196, 255),
    "s": (232, 196, 236, 255),
    "q": (196, 148, 206, 255),
    "e": (36, 22, 48, 255),
    "E": (72, 40, 96, 255),
    "w": (255, 252, 255, 255),
    "u": (236, 150, 186, 255),
    "M": (168, 110, 150, 255),
    "c": (222, 100, 152, 255),
    "C": (242, 158, 186, 255),
    "t": (26, 16, 32, 255),
    "p": (186, 70, 122, 255),
    "r": (118, 56, 164, 255),
    "m": (80, 36, 116, 255),
    "R": (146, 82, 188, 255),
    "f": (240, 228, 244, 255),
    "j": (178, 140, 192, 255),
    "o": (42, 26, 56, 255),
    "O": (64, 40, 78, 255),
    "y": (154, 98, 52, 255),
    "v": (104, 64, 32, 255),
    "x": (236, 222, 198, 255),
    "z": (48, 34, 44, 255),
    "X": (198, 176, 150, 255),
    "g": (220, 176, 68, 255),
}


class Canvas:
    def __init__(self) -> None:
        self.g = [["."] * W for _ in range(H)]

    def put(self, x: int, y: int, ch: str) -> None:
        if 0 <= x < W and 0 <= y < H and ch != ".":
            self.g[y][x] = ch

    def span(self, x0: int, x1: int, y: int, ch: str) -> None:
        for x in range(x0, x1 + 1):
            self.put(x, y, ch)

    def rect(self, x0: int, y0: int, x1: int, y1: int, ch: str) -> None:
        for y in range(y0, y1 + 1):
            self.span(x0, x1, y, ch)

    def ellipse(self, cx: int, cy: int, rx: int, ry: int, ch: str) -> None:
        rx = max(1, rx)
        ry = max(1, ry)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.02:
                    self.put(x, y, ch)

    def dump(self) -> list[str]:
        return ["".join(row) for row in self.g]


def eye(c: Canvas, x: int, y: int) -> None:
    """Sheet-style eye: rounder oval, left shine, small iris."""
    c.span(x + 1, x + 4, y, "e")
    c.span(x, x + 5, y + 1, "e")
    c.span(x, x + 5, y + 2, "e")
    c.span(x, x + 5, y + 3, "e")
    c.span(x + 1, x + 4, y + 4, "e")
    c.put(x + 2, y + 2, "E")
    c.put(x + 3, y + 2, "E")
    c.put(x + 3, y + 3, "E")
    c.put(x, y + 1, "w")
    c.put(x + 1, y + 1, "w")
    c.put(x + 1, y + 2, "w")
    c.put(x + 4, y + 1, "E")


def south_idle() -> Canvas:
    """Straight-on idle at sheet scale. Round hair, bigger eyes, stubby dress."""
    c = Canvas()
    sx = 20

    # hat: short cone, pink band, wide brim
    c.put(CX, 5, "d")
    c.span(CX - 1, CX + 1, 6, "h")
    c.put(CX, 6, "l")
    c.span(CX - 2, CX + 2, 7, "h")
    c.span(CX - 3, CX + 3, 8, "h")
    c.put(CX - 2, 8, "l")
    c.put(CX + 2, 8, "l")
    c.span(CX - 4, CX + 4, 9, "h")
    c.span(CX - 5, CX + 5, 10, "h")
    c.put(CX - 5, 10, "d")
    c.put(CX + 5, 10, "d")
    c.span(CX - 6, CX + 6, 11, "b")
    c.span(CX - 6, CX + 6, 12, "n")
    c.put(CX - 6, 11, "d")
    c.put(CX + 6, 11, "d")
    c.put(CX - 3, 11, "B")
    c.put(CX, 11, "B")
    c.put(CX + 3, 11, "B")
    c.span(CX - 13, CX + 13, 13, "h")
    c.span(CX - 12, CX + 12, 14, "d")
    c.put(CX - 13, 13, "d")
    c.put(CX + 13, 13, "d")
    c.span(CX - 7, CX + 7, 13, "l")
    c.put(CX + 14, 14, "g")

    # hair: round mushroom, slightly wider than tall, flat on the shoulders
    c.ellipse(CX, 27, 17, 14, "k")
    c.ellipse(CX, 27, 16, 13, "a")
    c.ellipse(CX - 3, 22, 10, 7, "i")
    c.ellipse(CX - 4, 20, 5, 4, "I")
    # flatten the sit-on-shoulders contact
    c.span(CX - 8, CX + 8, 40, "a")
    c.span(CX - 6, CX + 6, 41, "k")

    # larger face — the sheet's face fills the lower hair, not a sticker
    c.ellipse(CX, 30, 11, 9, "q")
    c.ellipse(CX, 30, 10, 8, "s")
    # bangs: two lobes + a hairline, covering the forehead
    c.ellipse(CX - 6, 23, 7, 5, "a")
    c.ellipse(CX + 6, 23, 7, 5, "a")
    c.span(CX - 9, CX + 9, 22, "a")
    c.span(CX - 8, CX + 8, 23, "a")
    c.put(CX - 5, 24, "k")
    c.put(CX + 5, 24, "k")
    c.put(CX - 2, 24, "k")
    c.put(CX + 2, 24, "k")
    eye(c, CX - 7, 27)
    eye(c, CX + 1, 27)
    c.put(CX - 8, 35, "u")
    c.put(CX - 7, 35, "u")
    c.put(CX + 7, 35, "u")
    c.put(CX + 8, 35, "u")
    c.span(CX - 1, CX, 37, "M")
    c.put(CX, 36, "q")
    c.put(CX - 12, 33, "g")
    c.put(CX + 12, 33, "g")

    # gothic corset
    c.rect(CX - 8, 41, CX + 8, 46, "c")
    c.rect(CX - 8, 42, CX - 8, 46, "t")
    c.rect(CX + 8, 42, CX + 8, 46, "t")
    c.span(CX - 8, CX + 8, 41, "t")
    c.span(CX - 6, CX + 6, 42, "C")
    c.put(CX, 43, "t")
    c.put(CX, 44, "C")
    c.put(CX, 45, "t")
    c.put(CX - 1, 44, "p")
    c.put(CX + 1, 44, "p")

    c.span(CX - 5, CX + 5, 47, "s")
    c.put(CX - 5, 47, "q")
    c.put(CX + 5, 47, "q")

    c.span(CX - 9, CX + 9, 48, "r")
    c.span(CX - 10, CX + 10, 49, "r")
    c.span(CX - 10, CX + 10, 50, "m")
    c.span(CX - 6, CX + 6, 48, "R")

    for x0 in (CX - 8, CX + 3):
        c.rect(x0, 51, x0 + 4, 56, "f")
        for yy in (52, 54, 56):
            c.put(x0 + 1, yy, "j")
            c.put(x0 + 3, yy, "j")
        for yy in (53, 55):
            c.put(x0 + 2, yy, "j")
        c.rect(x0, 57, x0 + 4, 59, "o")
        c.span(x0 + 1, x0 + 3, 57, "O")

    # skull staff
    c.ellipse(sx + 1, 19, 4, 4, "x")
    c.put(sx - 1, 18, "z")
    c.put(sx - 1, 19, "z")
    c.put(sx + 3, 18, "z")
    c.put(sx + 3, 19, "z")
    c.put(sx + 1, 20, "X")
    c.put(sx + 1, 21, "z")
    c.span(sx, sx + 2, 22, "x")
    for y in range(23, 60):
        wood = "y" if y % 4 else "v"
        c.put(sx, y, wood)
        c.put(sx + 1, y, "v" if wood == "y" else "y")
    c.span(sx, sx + 1, 59, "v")

    c.rect(sx, 45, sx + 3, 47, "s")
    c.rect(sx + 3, 44, CX - 9, 46, "s")
    c.put(sx + 1, 47, "q")
    c.rect(CX + 9, 43, CX + 11, 48, "s")
    c.put(CX + 11, 48, "q")
    c.put(CX + 10, 49, "q")

    return c


def paint(canvas: Canvas) -> Image.Image:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    unknown: set[str] = set()
    for y, row in enumerate(canvas.dump()):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            color = PALETTE.get(ch)
            if color is None:
                unknown.add(ch)
                continue
            px[x, y] = color
    if unknown:
        raise SystemExit(f"unknown palette keys: {sorted(unknown)}")
    return im


def zoom(im: Image.Image, factor: int, bg: tuple[int, int, int, int] | None) -> Image.Image:
    if bg is None:
        out = im
    else:
        out = Image.new("RGBA", im.size, bg)
        out.alpha_composite(im)
    return out.resize((im.width * factor, im.height * factor), Image.Resampling.NEAREST)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    canvas = south_idle()
    sprite = paint(canvas)
    sprite.save(OUT / "south-idle.png")
    pink = (255, 228, 236, 255)
    zoom(sprite, 6, pink).save(PREVIEW / "south_idle_x6.png")
    zoom(sprite, 8, pink).save(PREVIEW / "south_idle_x8.png")
    zoom(sprite, 8, None).save(PREVIEW / "south_idle_x8_alpha.png")
    zoom(sprite, 6, (18, 14, 24, 255)).save(PREVIEW / "south_idle_x6_dark.png")
    if REF.exists():
        sheet = Image.open(REF).convert("RGBA")
        scale = Image.new("RGBA", (sheet.width + 16 + W, max(sheet.height, H + 32)), pink)
        scale.alpha_composite(sheet, (0, 0))
        cell = Image.new("RGBA", (W, H), pink)
        cell.alpha_composite(sprite)
        scale.alpha_composite(cell, (sheet.width + 8, 40))
        scale.save(PREVIEW / "south_idle_vs_sheet_scale.png")
        crop = sheet.crop((55, 47, 110, 110))
        pair = Image.new("RGBA", (crop.width + 16 + W, max(crop.height, H)), pink)
        pair.alpha_composite(crop, (0, 0))
        pair.alpha_composite(cell, (crop.width + 16, 0))
        pair = pair.resize((pair.width * 4, pair.height * 4), Image.Resampling.NEAREST)
        pair.save(PREVIEW / "south_idle_vs_one_ref_x4.png")
    px = sprite.load()
    xs, ys = [], []
    for y in range(H):
        for x in range(W):
            if px[x, y][3]:
                xs.append(x)
                ys.append(y)
    print(
        "wrote",
        OUT / "south-idle.png",
        "bbox",
        min(xs),
        min(ys),
        max(xs),
        max(ys),
        f"{max(xs) - min(xs) + 1}x{max(ys) - min(ys) + 1}",
        "pixels",
        len(xs),
    )


if __name__ == "__main__":
    main()
