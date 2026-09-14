#!/usr/bin/env python3
"""South-facing Witch idle, designed as a small RPG battle sprite.

Native pixels. Not a downscale of the portrait. Not a variant of the
rejected illustrated battle sprite.

Style (white-hair sheet): compact, head-heavy, round hair, stubby clothes,
few face pixels, limited shading, clear silhouette.
Identity (Witch portrait): hat, purple hair/skin, gothic corset, skirt,
fishnets, skull staff.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "characters" / "witch"
PREVIEW = Path("/tmp/witch_south_idle")
REF = Path("/home/ubuntu/.cursor/projects/workspace/assets/528256f8-66f2-4d78-b5cf-a76b70cb76e2.jpg")

W, H = 32, 32
CX = 19  # body center. Staff sits on the viewer's left of this line.

PALETTE: dict[str, tuple[int, int, int, int]] = {
    "h": (40, 24, 60, 255),
    "d": (22, 14, 36, 255),
    "l": (62, 40, 86, 255),
    "b": (204, 90, 140, 255),
    "n": (148, 52, 100, 255),
    "a": (90, 38, 138, 255),
    "k": (54, 22, 90, 255),
    "i": (122, 60, 168, 255),
    "s": (226, 188, 234, 255),
    "q": (186, 140, 200, 255),
    "e": (30, 18, 40, 255),
    "w": (255, 252, 255, 255),
    "u": (232, 154, 186, 255),
    "c": (220, 98, 150, 255),
    "t": (24, 14, 30, 255),
    "p": (240, 154, 182, 255),
    "r": (112, 54, 158, 255),
    "m": (76, 34, 112, 255),
    "f": (238, 224, 242, 255),
    "j": (176, 138, 190, 255),
    "o": (40, 24, 54, 255),
    "y": (150, 94, 50, 255),
    "v": (98, 60, 30, 255),
    "x": (234, 220, 196, 255),
    "z": (46, 32, 42, 255),
    "g": (216, 172, 64, 255),
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

    def dump(self) -> list[str]:
        return ["".join(row) for row in self.g]


def south_idle() -> Canvas:
    """Compact straight-on idle. Round hair helmet, stubby dress, tucked staff."""
    c = Canvas()
    sx = 12  # 1px gap from hair so the pole does not stripe the head

    # --- hat: short cone + wide brim, overlaps the hair ---
    c.put(CX, 2, "d")
    c.span(CX - 1, CX + 1, 3, "h")
    c.span(CX - 2, CX + 2, 4, "h")
    c.put(CX - 2, 4, "l")
    c.put(CX + 2, 4, "l")
    c.span(CX - 3, CX + 3, 5, "h")
    c.span(CX - 4, CX + 4, 6, "b")
    c.put(CX - 4, 6, "d")
    c.put(CX + 4, 6, "d")
    c.put(CX - 3, 6, "n")
    c.put(CX + 3, 6, "n")
    c.span(CX - 6, CX + 6, 7, "h")
    c.put(CX - 6, 7, "d")
    c.put(CX + 6, 7, "d")
    c.put(CX + 6, 8, "g")  # charm hangs off the brim

    # --- hair: round helmet. Short locks only — body must stay visible. ---
    c.span(CX - 3, CX + 3, 8, "a")
    c.put(CX - 4, 8, "k")
    c.put(CX + 4, 8, "k")
    c.span(CX - 4, CX + 4, 9, "a")
    c.put(CX - 4, 9, "k")
    c.put(CX + 4, 9, "k")
    for y in range(10, 14):
        c.span(CX - 5, CX + 5, y, "a")
        c.put(CX - 5, y, "k")
        c.put(CX + 5, y, "k")
    c.span(CX - 4, CX + 4, 14, "a")
    c.put(CX - 4, 14, "k")
    c.put(CX + 4, 14, "k")
    c.span(CX - 2, CX + 2, 9, "i")
    # two-pixel locks, like the sheet's hair ending at the shoulders
    for y in range(14, 16):
        c.put(CX - 5, y, "k")
        c.put(CX - 4, y, "a")
        c.put(CX + 4, y, "a")
        c.put(CX + 5, y, "k")

    # --- face: small oval. Bangs are one hair shape, not strands. ---
    c.span(CX - 2, CX + 2, 10, "a")
    c.put(CX, 10, "s")
    for y in range(11, 14):
        c.span(CX - 2, CX + 2, y, "s")
    c.put(CX, 14, "q")
    # shine on the LEFT of each eye (sheet construction)
    c.put(CX - 2, 11, "w")
    c.put(CX - 1, 11, "e")
    c.put(CX + 1, 11, "w")
    c.put(CX + 2, 11, "e")
    c.put(CX, 13, "q")
    c.put(CX - 2, 13, "u")
    c.put(CX + 2, 13, "u")

    # --- gothic corset: pink block, 1px black rails, 1 lace ---
    for y in range(15, 18):
        c.span(CX - 3, CX + 3, y, "c")
        c.put(CX - 3, y, "t")
        c.put(CX + 3, y, "t")
    c.put(CX, 16, "p")
    c.put(CX, 17, "t")  # second lace hole

    # --- 1px midriff so the crop top reads ---
    c.span(CX - 2, CX + 2, 18, "s")
    c.put(CX - 2, 18, "q")
    c.put(CX + 2, 18, "q")

    # --- skirt: one purple block ---
    c.span(CX - 3, CX + 3, 19, "r")
    c.span(CX - 3, CX + 3, 20, "m")
    c.put(CX - 3, 19, "m")
    c.put(CX + 3, 19, "m")

    # --- fishnet legs + shoes ---
    for dx in (-3, 1):
        x0 = CX + dx
        c.span(x0, x0 + 2, 21, "f")
        c.put(x0, 22, "f")
        c.put(x0 + 1, 22, "j")
        c.put(x0 + 2, 22, "f")
        c.span(x0, x0 + 2, 23, "f")
        c.span(x0, x0 + 2, 24, "o")
        c.span(x0, x0 + 2, 25, "o")

    # --- staff AFTER hat. Skull left of the brim; pole under the hand. ---
    c.span(sx - 3, sx - 1, 6, "x")
    c.put(sx - 3, 7, "z")
    c.put(sx - 2, 7, "x")
    c.put(sx - 1, 7, "z")
    c.span(sx - 3, sx - 1, 8, "x")
    c.put(sx - 1, 9, "x")
    c.put(sx, 9, "y")
    for y in range(10, 25):
        c.put(sx, y, "y" if y % 3 else "v")
    c.put(sx, 24, "v")

    # hand ON the pole; short wrist into the torso. Tiny free arm on the right.
    c.put(sx, 17, "s")
    c.put(sx + 1, 16, "s")
    c.put(sx + 2, 16, "s")
    c.put(sx + 3, 16, "s")
    c.put(CX + 4, 16, "s")
    c.put(CX + 4, 17, "q")

    return c


def paint(canvas: Canvas) -> Image.Image:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(canvas.dump()):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            px[x, y] = PALETTE[ch]
    return im


def zoom(im: Image.Image, factor: int, bg: tuple[int, int, int, int] | None) -> Image.Image:
    if bg is None:
        out = im
    else:
        out = Image.new("RGBA", im.size, bg)
        out.alpha_composite(im)
    return out.resize((im.width * factor, im.height * factor), Image.Resampling.NEAREST)


def comparison(sprite: Image.Image) -> Image.Image:
    """Reference sheet beside the new Witch at a similar on-screen character size."""
    pink = (255, 228, 236, 255)
    witch_hi = zoom(sprite, 12, pink)
    if REF.exists():
        sheet = Image.open(REF).convert("RGBA")
    else:
        sheet = Image.new("RGBA", (200, 200), pink)
    pad = 16
    width = sheet.width + pad + witch_hi.width
    height = max(sheet.height, witch_hi.height) + pad * 2
    canvas = Image.new("RGBA", (width, height), (36, 24, 44, 255))
    canvas.paste(sheet, (0, pad))
    canvas.paste(witch_hi, (sheet.width + pad, pad))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    canvas = south_idle()
    for i, row in enumerate(canvas.dump()):
        if row.strip("."):
            print(f"{i:02d} {row}")
    sprite = paint(canvas)
    sprite.save(OUT / "south-idle.png")
    zoom(sprite, 12, (255, 228, 236, 255)).save(PREVIEW / "south_idle_x12.png")
    zoom(sprite, 12, None).save(PREVIEW / "south_idle_x12_alpha.png")
    zoom(sprite, 8, (18, 14, 24, 255)).save(PREVIEW / "south_idle_x8_dark.png")
    comparison(sprite).save(PREVIEW / "south_idle_vs_reference.png")
    if REF.exists():
        pink = (255, 228, 236, 255)
        sheet = Image.open(REF).convert("RGBA")
        cell = zoom(sprite, 2, pink)
        scale = Image.new("RGBA", (sheet.width + 16 + cell.width, sheet.height), (255, 228, 236, 255))
        scale.alpha_composite(sheet, (0, 0))
        # First sheet row sits near y=47; sprite top is y=2 at native, 4 at 2x.
        scale.alpha_composite(cell, (sheet.width + 8, 43))
        scale.save(PREVIEW / "south_idle_vs_sheet_scale.png")
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
