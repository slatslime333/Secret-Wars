#!/usr/bin/env python3
"""Pack the Witch style-test paintings onto a 96x96 pixel sheet.

Crops the pale-pink studio background, BOX-downsamples onto a real pixel grid,
and lays out the existing 10-pose x 4-direction sheet the game already reads.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "characters" / "witch" / "source"
OUT_CHAR = ROOT / "assets" / "characters" / "witch"
OUT_PORT = ROOT / "assets" / "portraits"
PREVIEW = Path("/tmp/witch_style_preview")

FRAME = 160
DOWNSAMPLE = 5
FEET_Y = 156
COLS = ("idle0", "idle1", "walk0", "walk1", "walk2", "atk0", "atk1", "atk2", "hurt", "down")
ROWS = ("south", "north", "east", "west")

FILES = {
    "south": SRC / "witch_style_south_idle.png",
    "north": SRC / "witch_style_north_idle.png",
    "east": SRC / "witch_style_east_idle.png",
    "west": SRC / "witch_style_west_idle.png",
    "walk": SRC / "witch_style_south_walk.png",
    "portrait": SRC / "witch_style_portrait.png",
}


def is_studio_bg(r: int, g: int, b: int, a: int) -> bool:
    if a < 12:
        return True
    if r > 228 and g > 198 and b > 198 and r >= g - 8 and abs(r - b) < 50:
        return True
    return False


def extract(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_studio_bg(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
            else:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit(f"no foreground in {path}")
    pad = 8
    box = (
        max(0, min(xs) - pad),
        max(0, min(ys) - pad),
        min(w, max(xs) + pad + 1),
        min(h, max(ys) + pad + 1),
    )
    cropped = im.crop(box)
    return cropped


def pixelize(im: Image.Image) -> Image.Image:
    nw = max(8, im.width // DOWNSAMPLE)
    nh = max(8, im.height // DOWNSAMPLE)
    small = im.resize((nw, nh), Image.Resampling.BOX)
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            if a < 36 or is_studio_bg(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    return small


def blit(frame: Image.Image, sprite: Image.Image, dx: int = 0, dy: int = 0) -> None:
    x = (FRAME - sprite.width) // 2 + dx
    y = FEET_Y - sprite.height + dy
    frame.alpha_composite(sprite, (x, y))


def pose_south(idle: Image.Image, walk: Image.Image, name: str) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    if name == "idle1":
        blit(frame, idle, 0, -1)
    elif name in ("walk0", "atk1"):
        blit(frame, walk, 0, 0)
    elif name == "walk2":
        blit(frame, walk, 1, -1)
    elif name == "atk0":
        blit(frame, idle, -1, -1)
    elif name == "atk2":
        blit(frame, idle, 1, 0)
    elif name == "hurt":
        blit(frame, idle, -2, 1)
    elif name == "down":
        fallen = idle.rotate(70, resample=Image.Resampling.NEAREST, expand=True)
        scale = min((FRAME - 12) / fallen.width, 56 / fallen.height)
        fallen = fallen.resize(
            (max(8, int(fallen.width * scale)), max(8, int(fallen.height * scale))),
            Image.Resampling.NEAREST,
        )
        frame.alpha_composite(fallen, ((FRAME - fallen.width) // 2, FRAME - fallen.height - 4))
    else:
        blit(frame, idle)
    return frame


def pose_cardinal(idle: Image.Image, name: str, facing: str) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    step = 2 if facing in ("east", "south") else -2
    if name == "idle1":
        blit(frame, idle, 0, -1)
    elif name == "walk0":
        blit(frame, idle, step, -1)
    elif name == "walk2":
        blit(frame, idle, -step, 0)
    elif name == "atk0":
        blit(frame, idle, step, -1)
    elif name == "atk1":
        blit(frame, idle, step * 2, 0)
    elif name == "atk2":
        blit(frame, idle, step, 1)
    elif name == "hurt":
        blit(frame, idle, -step, 1)
    elif name == "down":
        fallen = idle.rotate(70 if facing != "west" else -70, resample=Image.Resampling.NEAREST, expand=True)
        scale = min((FRAME - 12) / fallen.width, 56 / fallen.height)
        fallen = fallen.resize(
            (max(8, int(fallen.width * scale)), max(8, int(fallen.height * scale))),
            Image.Resampling.NEAREST,
        )
        frame.alpha_composite(fallen, ((FRAME - fallen.width) // 2, FRAME - fallen.height - 4))
    else:
        blit(frame, idle)
    return frame


def main() -> None:
    OUT_CHAR.mkdir(parents=True, exist_ok=True)
    OUT_PORT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)

    idle = {d: pixelize(extract(FILES[d])) for d in ("south", "north", "east", "west")}
    walk = pixelize(extract(FILES["walk"]))

    sheet = Image.new("RGBA", (FRAME * len(COLS), FRAME * len(ROWS)), (0, 0, 0, 0))
    for ry, facing in enumerate(ROWS):
        for cx, pose in enumerate(COLS):
            if facing == "south":
                cell = pose_south(idle["south"], walk, pose)
            else:
                cell = pose_cardinal(idle[facing], pose, facing)
            sheet.paste(cell, (cx * FRAME, ry * FRAME), cell)

    sheet_path = OUT_CHAR / "sheet.png"
    sheet.save(sheet_path)

    portrait = Image.open(FILES["portrait"]).convert("RGBA")
    portrait = portrait.resize((128, 128), Image.Resampling.BOX)
    portrait.save(OUT_PORT / "witch.png")

    # 4-direction idle preview at 4x for review.
    preview = Image.new("RGBA", (FRAME * 4 * 4, FRAME * 4), (18, 14, 24, 255))
    for i, facing in enumerate(ROWS):
        cell = pose_cardinal(idle[facing], "idle0", facing) if facing != "south" else pose_south(idle["south"], walk, "idle0")
        big = cell.resize((FRAME * 4, FRAME * 4), Image.Resampling.NEAREST)
        preview.paste(big, (i * FRAME * 4, 0), big)
    preview.save(PREVIEW / "witch_dirs_x4.png")

    south_big = pose_south(idle["south"], walk, "idle0").resize((FRAME * 5, FRAME * 5), Image.Resampling.NEAREST)
    south_big.save(PREVIEW / "witch_south_x5.png")
    walk_big = pose_south(idle["south"], walk, "walk0").resize((FRAME * 5, FRAME * 5), Image.Resampling.NEAREST)
    walk_big.save(PREVIEW / "witch_walk_x5.png")
    portrait.resize((512, 512), Image.Resampling.NEAREST).save(PREVIEW / "witch_portrait_x4.png")

    print(f"wrote {sheet_path} {sheet.size}")
    print(f"south idle {idle['south'].size} walk {walk.size}")


if __name__ == "__main__":
    main()
