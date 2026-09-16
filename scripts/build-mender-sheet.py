#!/usr/bin/env python3
"""Pack Mender's authored turnaround into the 8x4 game sheet and animate it.

Idle pixels come from scripts/mender-src/turnaround.jpg (the art she made).
Walk/attack frames are posed from those same pixels. Attack lifts both uzis.
"""

from __future__ import annotations

from pathlib import Path
from statistics import median

from PIL import Image

FRAME = 80
COLS = 8
ROWS = 4
SRC = Path("scripts/mender-src/turnaround.jpg")
OUT = Path("assets/heroes/mender.png")

# Magenta chest stamp so existing team bake (isSash) still works.
SASH = (214, 52, 118, 255)

CROPS = {
    "west": (40, 165, 365, 770),
    "south": (485, 165, 845, 770),
    "north": (920, 165, 1265, 770),
    "east": (1420, 165, 1735, 770),
}


def knockout_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 226 and g > 226 and b > 226:
                px[x, y] = (0, 0, 0, 0)
            elif a and min(r, g, b) > 205 and max(r, g, b) - min(r, g, b) < 14:
                px[x, y] = (0, 0, 0, 0)
    return im


def tight(im: Image.Image) -> Image.Image:
    bb = im.getbbox()
    if not bb:
        return im
    return im.crop(bb)


def is_hair(r: int, g: int, b: int, a: int) -> bool:
    if a < 160:
        return False
    if r > 145 and g > 100 and b < 165 and g > b + 12 and r > b + 24:
        return True
    if r > 100 and g > 70 and b < 90 and r > b + 18 and g > b + 8 and r >= g - 8:
        return True
    return False


def is_skin(r: int, g: int, b: int, a: int) -> bool:
    if a < 160:
        return False
    return r > 180 and g > 130 and b > 90 and r > b + 40 and r > g + 18


def is_white_cloth(r: int, g: int, b: int, a: int) -> bool:
    if a < 180:
        return False
    mx, mn = max(r, g, b), min(r, g, b)
    return mx > 155 and mn > 130 and mx - mn < 48 and not is_skin(r, g, b, a)


def extract_idle(name: str, src: Image.Image) -> Image.Image:
    return tight(knockout_white(src.crop(CROPS[name])))


def fit_frame(src: Image.Image, max_h: int = 74, max_w: int = 78) -> Image.Image:
    src = tight(src)
    w, h = src.size
    scale = min(max_w / w, max_h / h)
    tw = max(1, round(w * scale))
    th = max(1, round(h * scale))
    small = src.resize((tw, th), Image.Resampling.BOX)
    canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - tw) // 2
    y = FRAME - th - 1
    canvas.paste(small, (x, y), small)
    return canvas


def shift(im: Image.Image, dx: int, dy: int) -> Image.Image:
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (dx, dy), im)
    return out


def shift_region(im: Image.Image, y0: int, y1: int, dx: int, dy: int = 0) -> Image.Image:
    out = im.copy()
    band = im.crop((0, y0, FRAME, y1))
    clear = Image.new("RGBA", (FRAME, y1 - y0), (0, 0, 0, 0))
    out.paste(clear, (0, y0))
    out.paste(band, (dx, y0 + dy), band)
    return out


def body_core(im: Image.Image) -> tuple[int, int]:
    """Chest width, ignoring hair so side views don't swallow the rear uzi."""
    px = im.load()
    w, h = im.size
    lefts: list[int] = []
    rights: list[int] = []
    for y in range(int(h * 0.40), int(h * 0.50)):
        xs = [
            x
            for x in range(w)
            if px[x, y][3] >= 160 and not is_hair(*px[x, y])
        ]
        if len(xs) >= 4:
            lefts.append(xs[0])
            rights.append(xs[-1])
    if not lefts:
        return int(w * 0.38), int(w * 0.62)
    return int(median(lefts)), int(median(rights))


def suit_fill(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    hits: list[tuple[int, int, int, int]] = []
    for y in range(int(h * 0.40), int(h * 0.62)):
        for x in range(int(w * 0.38), int(w * 0.62)):
            r, g, b, a = px[x, y]
            if a < 180 or is_hair(r, g, b, a) or is_skin(r, g, b, a) or is_white_cloth(r, g, b, a):
                continue
            if max(r, g, b) < 90:
                hits.append((r, g, b, a))
    if not hits:
        return (36, 30, 44, 255)
    r = sum(p[0] for p in hits) // len(hits)
    g = sum(p[1] for p in hits) // len(hits)
    b = sum(p[2] for p in hits) // len(hits)
    return (r, g, b, 255)


def opaque_row(im: Image.Image, y: int) -> list[int]:
    px = im.load()
    w, h = im.size
    xs: list[int] = []
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 160 or is_hair(r, g, b, a):
            continue
        if r > 160 and g < 110 and r - g > 70:
            continue
        if y >= int(h * 0.86) and is_white_cloth(r, g, b, a):
            continue
        xs.append(x)
    return xs


def gun_mask(im: Image.Image, side: str) -> Image.Image:
    """Only the uzis that hang outside the chest, not the black suit."""
    w, h = im.size
    cl, cr = body_core(im)
    mask = Image.new("L", im.size, 0)
    mp = mask.load()
    y0, y1 = int(h * 0.52), int(h * 0.86)
    for y in range(y0, y1):
        xs = opaque_row(im, y)
        if len(xs) < 2:
            continue
        if side == "left" and xs[0] < cl - 1:
            for x in range(xs[0], min(cl, xs[-1] + 1)):
                mp[x, y] = 255
        if side == "right" and xs[-1] > cr + 1:
            for x in range(max(cr + 1, xs[0]), xs[-1] + 1):
                mp[x, y] = 255
    return mask


def fill_gun_holes(
    body: Image.Image,
    mask: Image.Image,
    fill: tuple[int, int, int, int],
    toward_right: bool,
) -> Image.Image:
    px = body.load()
    mp = mask.load()
    w, h = body.size
    out = body.copy()
    op = out.load()
    step = 1 if toward_right else -1
    for y in range(h):
        xs = [x for x in range(w) if mp[x, y] >= 128]
        if not xs:
            continue
        for x in xs:
            nx = x
            body_hit = False
            for _ in range(10):
                nx += step
                if nx < 0 or nx >= w:
                    break
                if mp[nx, y] >= 128:
                    continue
                if px[nx, y][3] >= 160 and not is_hair(*px[nx, y]):
                    body_hit = True
                    break
            op[x, y] = fill if body_hit else (0, 0, 0, 0)
    return out


def pose_guns(idle: Image.Image, facing: str, lift: int, forward: int) -> Image.Image:
    fill = suit_fill(idle)
    body = idle.copy()
    pieces: list[Image.Image] = []
    for side in ("left", "right"):
        mask = gun_mask(idle, side)
        if mask.getbbox() is None:
            continue
        body = fill_gun_holes(body, mask, fill, toward_right=(side == "left"))
        gun = Image.new("RGBA", idle.size, (0, 0, 0, 0))
        gun.paste(idle, (0, 0), mask)
        if facing == "west":
            dx = -forward
            angle = -48 if side == "left" else -36
        elif facing == "east":
            dx = forward
            angle = 48 if side == "right" else 36
        else:
            dx = -forward if side == "left" else forward
            angle = 40 if side == "left" else -40
        posed = rotate_gun(gun, mask, angle)
        shifted = Image.new("RGBA", idle.size, (0, 0, 0, 0))
        shifted.paste(posed, (dx, -lift), posed)
        pieces.append(shifted)
    out = body
    for piece in pieces:
        layered = out.copy()
        layered.alpha_composite(piece)
        out = layered
    return out


def rotate_gun(gun: Image.Image, mask: Image.Image, angle: float) -> Image.Image:
    bb = mask.getbbox()
    if not bb or abs(angle) < 1:
        return gun
    piece = gun.crop(bb)
    rot = piece.rotate(angle, resample=Image.Resampling.NEAREST, expand=True)
    # Keep the top of the original bbox (wrist) roughly planted.
    cx = (bb[0] + bb[2]) / 2
    top = bb[1]
    x = round(cx - rot.size[0] / 2)
    y = round(top - rot.size[1] * 0.12)
    out = Image.new("RGBA", gun.size, (0, 0, 0, 0))
    out.paste(rot, (x, y), rot)
    return out


def stamp_sash(im: Image.Image) -> Image.Image:
    im = im.copy()
    px = im.load()
    w, h = im.size
    hits: list[tuple[int, int]] = []
    for y in range(int(h * 0.42), int(h * 0.56)):
        for x in range(int(w * 0.34), int(w * 0.66)):
            r, g, b, a = px[x, y]
            if is_white_cloth(r, g, b, a) and not is_skin(r, g, b, a):
                hits.append((x, y))
    if not hits:
        # Side views: palest mid-torso cloth, never face/skin.
        for y in range(int(h * 0.44), int(h * 0.56)):
            for x in range(int(w * 0.38), int(w * 0.62)):
                r, g, b, a = px[x, y]
                if a > 180 and min(r, g, b) > 70 and not is_hair(r, g, b, a) and not is_skin(r, g, b, a):
                    hits.append((x, y))
    if not hits:
        return im
    xs = [p[0] for p in hits]
    ys = [p[1] for p in hits]
    ys.sort()
    cx, cy = sum(xs) // len(xs), ys[len(ys) // 2]
    for x in range(cx - 2, cx + 3):
        for y in range(cy, cy + 2):
            if 0 <= x < w and 0 <= y < h and px[x, y][3] > 160:
                r, g, b, a = px[x, y]
            if is_hair(r, g, b, a) or is_skin(r, g, b, a):
                continue
            if r > 160 and g < 110 and r - g > 70:
                continue
                px[x, y] = SASH
    return im


def walk_frames(idle: Image.Image) -> list[Image.Image]:
    y0, y1 = 66, 80
    frames = []
    steps = [
        (0, 0, 0),
        (0, 1, -2),
        (0, 0, 0),
        (0, 1, 2),
    ]
    for dx, bob, leg in steps:
        fr = shift(idle, dx, -bob)
        fr = shift_region(fr, y0, y1, leg, 0)
        frames.append(fr)
    return frames


def attack_frames(idle: Image.Image, facing: str) -> list[Image.Image]:
    if facing in ("west", "east"):
        wind = pose_guns(idle, facing, lift=4, forward=3)
        mid = pose_guns(idle, facing, lift=7, forward=5)
        fire = pose_guns(idle, facing, lift=9, forward=7)
    else:
        wind = pose_guns(idle, facing, lift=5, forward=1)
        mid = pose_guns(idle, facing, lift=8, forward=2)
        fire = pose_guns(idle, facing, lift=11, forward=3)
    return [wind, mid, fire]


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    sheet = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    for row, facing in enumerate(("south", "west", "east", "north")):
        idle = fit_frame(extract_idle(facing, src))
        walks = walk_frames(idle)
        attacks = attack_frames(idle, facing)
        frames = [stamp_sash(fr) for fr in (idle, *walks, *attacks)]
        for col, fr in enumerate(frames):
            sheet.paste(fr, (col * FRAME, row * FRAME), fr)
    sheet.save(OUT)
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()
