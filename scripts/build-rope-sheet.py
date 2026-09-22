#!/usr/bin/env python3
"""Paste Rope Man's hand-drawn run onto the hero sheet.

Col 0 is the original crouched idle. Cols 1-2 are the two run poses from
scripts/rope-run-reference.png (N/S/W/E), downscaled onto the sheet grid.
Cols 3-4 are those same poses with a rope leaving the leading fist, so shots
alternate arms. Punch and grab reuse the drawn poses so he never switches
to a different body.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from PIL import Image

FRAME = 80
WALK = 2
COLS = 1 + WALK + 5  # idle, run A/B, shot L/R, punch, grab, grab-both
ROWS = 4
SRC = Path("assets/heroes/rope.png")
REF = Path("scripts/rope-run-reference.png")
TARGET_H = 72

# Crops of the labeled reference: two frames per facing, white background.
REF_BOX = {
    "north": ((129, 31, 258, 253), (359, 32, 505, 253)),
    "south": ((129, 293, 269, 507), (364, 289, 500, 507)),
    "west": ((147, 548, 293, 748), (366, 548, 526, 744)),
    "east": ((116, 788, 264, 987), (335, 787, 489, 987)),
}

PAL = [
    (17, 4, 28),
    (45, 28, 41),
    (63, 39, 43),
    (78, 47, 42),
    (102, 64, 52),
    (122, 75, 53),
    (132, 77, 50),
    (148, 90, 56),
]
EYE = (252, 102, 28)
OUT = PAL[0]
ROPE = PAL[5]
DARK = PAL[3]


def is_eye(r: int, g: int, b: int) -> bool:
    return r > 190 and 50 < g < 160 and b < 90 and r > g + 50


def nearest(r: int, g: int, b: int) -> tuple[int, int, int]:
    if is_eye(r, g, b):
        return EYE
    best = PAL[0]
    best_d = 10**9
    for p in PAL:
        d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2
        if d < best_d:
            best_d = d
            best = p
    return best


def clean(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8 or (r >= 228 and g >= 228 and b >= 228):
                px[x, y] = (0, 0, 0, 0)
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            if mx > 188 and mx - mn < 26:
                px[x, y] = (0, 0, 0, 0)
    box = im.getbbox()
    return im.crop(box) if box else im


def downsample(im: Image.Image) -> Image.Image:
    """Majority-color reduction so the drawn pixels survive at sheet size."""
    im = clean(im)
    w, h = im.size
    height = TARGET_H
    nw = max(1, round(w * height / h))
    src = im.load()
    out = Image.new("RGBA", (nw, height), (0, 0, 0, 0))
    dst = out.load()
    for oy in range(height):
        y0 = int(oy * h / height)
        y1 = max(y0 + 1, int((oy + 1) * h / height))
        for ox in range(nw):
            x0 = int(ox * w / nw)
            x1 = max(x0 + 1, int((ox + 1) * w / nw))
            counts: Counter[tuple[int, int, int]] = Counter()
            trans = 0
            total = 0
            for y in range(y0, y1):
                for x in range(x0, x1):
                    r, g, b, a = src[x, y]
                    total += 1
                    if a < 110:
                        trans += 1
                        continue
                    counts[nearest(r, g, b)] += 1
            if total == 0 or not counts or trans > total * 0.52:
                continue
            dst[ox, oy] = (*counts.most_common(1)[0][0], 255)
    kill = []
    for y in range(height):
        for x in range(nw):
            if dst[x, y][3] == 0:
                continue
            friends = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < nw and 0 <= yy < height and dst[xx, yy][3]:
                    friends += 1
            if friends == 0:
                kill.append((x, y))
    for x, y in kill:
        dst[x, y] = (0, 0, 0, 0)
    return out


def plant(sprite: Image.Image) -> Image.Image:
    """Feet on a shared ground line, head stacked so the two-frame run doesn't slide."""
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    box = sprite.getbbox()
    if box is None:
        return frame
    px = sprite.load()
    xs = []
    top = box[1]
    bot = min(box[3], box[1] + 16)
    for y in range(top, bot):
        for x in range(box[0], box[2]):
            if px[x, y][3]:
                xs.append(x)
    head_x = sum(xs) / len(xs) if xs else (box[0] + box[2]) / 2
    dx = int(round(40 - head_x))
    dy = int(78 - (box[3] - 1))
    frame.paste(sprite, (dx, dy), sprite)
    return frame


def leading_hand(frame: Image.Image, facing: str) -> tuple[int, int]:
    px = frame.load()
    box = frame.getbbox()
    if box is None:
        return (40, 40)
    top, bot = box[1], box[3] - 1
    span = max(1, bot - top)
    # Arms live under the head and above the feet.
    y0 = top + int(span * 0.28)
    y1 = top + int(span * 0.70)
    pts = [(x, y) for y in range(y0, y1) for x in range(FRAME) if px[x, y][3]]
    if not pts:
        return (40, top + span // 2)
    if facing == "east":
        return max(pts, key=lambda p: (p[0], -abs(p[1] - (y0 + y1) // 2)))
    if facing == "west":
        return min(pts, key=lambda p: (p[0], abs(p[1] - (y0 + y1) // 2)))
    return max(pts, key=lambda p: (abs(p[0] - 40), -p[1]))


def add_rope(frame: Image.Image, hand: tuple[int, int], facing: str) -> Image.Image:
    img = frame.copy()
    px = img.load()
    hx, hy = hand
    if facing == "east":
        dx, dy = 1.0, 0.05
    elif facing == "west":
        dx, dy = -1.0, 0.05
    elif facing == "north":
        dx, dy = (-0.85 if hx < 40 else 0.85), -0.45
    else:
        dx, dy = (-0.75 if hx < 40 else 0.75), 0.55
    mag = (dx * dx + dy * dy) ** 0.5
    dx, dy = dx / mag, dy / mag
    pxn, pyn = -dy, dx
    for i in range(12):
        wave = 0.55 if (i // 2) % 2 == 0 else -0.55
        x = int(round(hx + dx * (i + 3) + pxn * wave))
        y = int(round(hy + dy * (i + 3) + pyn * wave))
        color = DARK if i % 3 == 0 else ROPE
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sx, sy = x + ox, y + oy
            if 0 <= sx < FRAME and 0 <= sy < FRAME and px[sx, sy][3] == 0:
                px[sx, sy] = (*OUT, 255)
        if 0 <= x < FRAME and 0 <= y < FRAME:
            px[x, y] = (*color, 255)
    return img


def poses(ref: Image.Image, facing: str) -> list[Image.Image]:
    frames = []
    for box in REF_BOX[facing]:
        frames.append(plant(downsample(ref.crop(box))))
    return frames


def main() -> None:
    ref = Image.open(REF).convert("RGBA")
    src = Image.open(SRC).convert("RGBA")
    sheet = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    for row, facing in enumerate(("south", "west", "east", "north")):
        idle = src.crop((0, row * FRAME, FRAME, row * FRAME + FRAME))
        sheet.paste(idle, (0, row * FRAME))
        run = poses(ref, facing)
        hands = [leading_hand(fr, facing) for fr in run]
        # Left column is whichever pose reaches to screen-left. Side views
        # still fire along the facing; the two poses are the two arms.
        left_i, right_i = sorted(range(2), key=lambda i: hands[i][0])
        shot_l = add_rope(run[left_i], hands[left_i], facing)
        shot_r = add_rope(run[right_i], hands[right_i], facing)
        frames = [run[0], run[1], shot_l, shot_r, run[right_i], run[left_i], run[0]]
        for col, fr in enumerate(frames, start=1):
            sheet.paste(fr, (col * FRAME, row * FRAME))
    sheet.save(SRC)
    print("wrote", SRC, sheet.size)


if __name__ == "__main__":
    main()
