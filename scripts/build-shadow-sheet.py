#!/usr/bin/env python3
"""Pack Shadow's authored turnaround into the 8x4 game sheet and animate it.

Idle pixels come from scripts/shadow-src/turnaround.jpg (the art she made).
Walk/attack frames are posed from those same pixels. West keeps the claw on
the right arm only — never on the front/left hand.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

FRAME = 80
COLS = 8
ROWS = 4
SRC = Path("scripts/shadow-src/turnaround.jpg")
OUT = Path("assets/heroes/shadow.png")

# Magenta collar stamp so existing team bake (isSash) still works.
SASH = (214, 52, 118, 255)

CROPS = {
    "west": (70, 170, 360, 750),
    "south": (450, 170, 820, 750),
    "north": (930, 170, 1280, 750),
    "east": (1410, 170, 1710, 750),
}

# Resting claw is always the character's right arm.
CLAW_SIDE = {"south": "left", "west": "right", "east": "left", "north": "right"}


def knockout_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 242 and g > 242 and b > 242:
                px[x, y] = (0, 0, 0, 0)
    return im


def tight(im: Image.Image) -> Image.Image:
    bb = im.getbbox()
    if not bb:
        return im
    return im.crop(bb)


def is_claw_color(r: int, g: int, b: int, a: int) -> bool:
    if a < 180:
        return False
    mx = max(r, g, b)
    if mx < 36:
        return False
    if r > 150 and g > 130:
        return False
    if r > 140 and g > 90 and r > b + 16:
        return False
    return b >= r - 10 and g <= b + 8 and mx <= 150


def extract_idle(name: str, src: Image.Image) -> Image.Image:
    # West source already has the claw on the right/back. Do not punch dark
    # skirt/boot pixels — they match claw color and went see-through.
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


def is_blouse(r: int, g: int, b: int, a: int) -> bool:
    return a > 180 and r > 190 and g > 180 and b > 170 and abs(r - g) < 40


def is_skin(r: int, g: int, b: int, a: int) -> bool:
    return a > 180 and r > 160 and g > 110 and b > 90 and r > g + 10 and r > b + 20


def body_core(im: Image.Image) -> tuple[int, int]:
    px = im.load()
    w, h = im.size
    lefts: list[int] = []
    rights: list[int] = []
    for y in range(int(h * 0.40), int(h * 0.50)):
        xs = [x for x in range(w) if px[x, y][3] >= 160]
        if len(xs) >= 6:
            lefts.append(xs[0])
            rights.append(xs[-1])
    if not lefts:
        return int(w * 0.35), int(w * 0.65)
    lefts.sort()
    rights.sort()
    return lefts[len(lefts) // 2], rights[len(rights) // 2]


def claw_mask(im: Image.Image, side: str) -> Image.Image:
    """Only the hanging right-arm claw, not the hair mass."""
    px = im.load()
    w, h = im.size
    cl, cr = body_core(im)
    pad = 8
    mask = Image.new("L", im.size, 0)
    mp = mask.load()
    y0, y1 = int(h * 0.46), int(h * 0.80)
    if side == "left":
        x0, x1 = 0, min(w, cl + pad)
    else:
        x0, x1 = max(0, cr - pad), w
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if is_claw_color(r, g, b, a) and not is_blouse(r, g, b, a) and not is_skin(r, g, b, a):
                mp[x, y] = 255
    return largest_blob(mask)


def largest_blob(mask: Image.Image) -> Image.Image:
    w, h = mask.size
    px = mask.load()
    seen = [[False] * w for _ in range(h)]
    best: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            if px[x, y] < 128 or seen[y][x]:
                continue
            stack = [(x, y)]
            seen[y][x] = True
            blob = [(x, y)]
            while stack:
                cx, cy = stack.pop()
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] >= 128:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
                        blob.append((nx, ny))
            if len(blob) > len(best):
                best = blob
    out = Image.new("L", mask.size, 0)
    op = out.load()
    for x, y in best:
        op[x, y] = 255
    return out


def fill_mask_inward(body: Image.Image, mask: Image.Image, toward_right: bool) -> Image.Image:
    """Close holes left by moving a limb, using nearby body pixels."""
    src = body.load()
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
            found = None
            nx = x
            for _ in range(12):
                nx += step
                if nx < 0 or nx >= w:
                    break
                if mp[nx, y] >= 128:
                    continue
                r, g, b, a = src[nx, y]
                if a >= 160:
                    found = (r, g, b, a)
                    break
            if found is None:
                for ny in range(y - 1, max(-1, y - 8), -1):
                    r, g, b, a = src[x, ny]
                    if a >= 160 and mp[x, ny] < 128:
                        found = (r, g, b, a)
                        break
            op[x, y] = found if found else (0, 0, 0, 0)
    return out


def keep_body_solid(posed: Image.Image, idle: Image.Image) -> Image.Image:
    """Restore interior idle pixels so walk/attack cannot punch see-through holes."""
    out = posed.copy()
    op = out.load()
    ip = idle.load()
    w, h = posed.size
    for _ in range(3):
        snapshot = out.copy()
        sp = snapshot.load()
        for y in range(h):
            for x in range(w):
                if ip[x, y][3] < 160 or op[x, y][3] >= 160:
                    continue
                n = 0
                left = right = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and sp[nx, ny][3] >= 160:
                        n += 1
                        if ny == y and nx < x:
                            left = True
                        if ny == y and nx > x:
                            right = True
                if n >= 2 or left and right:
                    op[x, y] = ip[x, y]
    return out


def pose_claw(idle: Image.Image, side: str, scale: float, dx: int, dy: int) -> Image.Image:
    mask = claw_mask(idle, side)
    if mask.getbbox() is None:
        return idle
    claw = Image.new("RGBA", idle.size, (0, 0, 0, 0))
    claw.paste(idle, (0, 0), mask)
    body = fill_mask_inward(idle.copy(), mask, toward_right=(side == "left"))
    bb = claw.getbbox()
    if not bb:
        return idle
    piece = claw.crop(bb)
    nw = max(2, round(piece.size[0] * scale))
    nh = max(2, round(piece.size[1] * scale))
    grown = piece.resize((nw, nh), Image.Resampling.NEAREST)
    if side == "left":
        x = bb[2] - nw + dx
    else:
        x = bb[0] + dx
    y = bb[1] + dy
    out = body.copy()
    out.paste(grown, (x, y), grown)
    return keep_body_solid(out, idle)


def foot_mask(im: Image.Image, side: str) -> Image.Image:
    px = im.load()
    w, h = im.size
    mask = Image.new("L", im.size, 0)
    mp = mask.load()
    y0 = 64
    x0, x1 = (0, w // 2) if side == "left" else (w // 2, w)
    for y in range(y0, h):
        for x in range(x0, x1):
            if px[x, y][3] >= 160:
                mp[x, y] = 255
    return mask


def shift_foot(im: Image.Image, side: str, dx: int, dy: int) -> Image.Image:
    mask = foot_mask(im, side)
    if mask.getbbox() is None or (dx == 0 and dy == 0):
        return im
    piece = Image.new("RGBA", im.size, (0, 0, 0, 0))
    piece.paste(im, (0, 0), mask)
    body = fill_mask_inward(im.copy(), mask, toward_right=(side == "left"))
    shifted = Image.new("RGBA", im.size, (0, 0, 0, 0))
    shifted.paste(piece, (dx, dy), piece)
    out = body
    out.alpha_composite(shifted)
    return out


def stamp_sash(im: Image.Image) -> Image.Image:
    """Tiny magenta collar so team sheets still recolor without touching the claw."""
    im = im.copy()
    px = im.load()
    # Find a white-ish blouse pixel near the chest and stamp a 2-row band.
    w, h = im.size
    hits = []
    for y in range(int(h * 0.40), int(h * 0.56)):
        for x in range(int(w * 0.38), int(w * 0.62)):
            r, g, b, a = px[x, y]
            if a > 200 and r > 200 and g > 196 and b > 190 and abs(r - g) < 28:
                hits.append((x, y))
    if not hits:
        return im
    xs = [p[0] for p in hits]
    ys = [p[1] for p in hits]
    ys.sort()
    cx, cy = sum(xs) // len(xs), ys[len(ys) // 2]
    for x in range(cx - 3, cx + 4):
        for y in range(cy, cy + 2):
            if 0 <= x < w and 0 <= y < h and px[x, y][3] > 160:
                r, g, b, a = px[x, y]
                if r > 170 and g > 160:
                    px[x, y] = SASH
    return im


def walk_frames(idle: Image.Image, facing: str) -> list[Image.Image]:
    """Step the boots, not the whole skirt/hair band, so legs don't shear see-through."""
    fwd = -1 if facing == "west" else 1 if facing == "east" else 0
    # bob, left(dx,dy), right(dx,dy), lean
    if facing in ("west", "east"):
        steps = [
            (0, (0, 0), (0, 0), 0),
            (1, (fwd * 2, 1), (-fwd, 0), fwd),
            (0, (0, 0), (0, 0), 0),
            (1, (-fwd, 0), (fwd * 2, 1), fwd),
        ]
    else:
        steps = [
            (0, (0, 0), (0, 0), 0),
            (1, (-2, 1), (2, 0), 0),
            (0, (0, 0), (0, 0), 0),
            (1, (2, 0), (-2, 1), 0),
        ]
    frames = []
    for bob, left, right, lean in steps:
        fr = shift(idle, lean, -bob)
        fr = shift_foot(fr, "left", left[0], left[1])
        fr = shift_foot(fr, "right", right[0], right[1])
        frames.append(keep_body_solid(fr, idle))
    return frames


def attack_frames(idle: Image.Image, facing: str) -> list[Image.Image]:
    side = CLAW_SIDE[facing]
    # Windup: claw pulled back/up. Slash: same right claw, much bigger.
    if side == "left":
        wind = pose_claw(idle, side, 1.2, 1, -4)
        mid = pose_claw(idle, side, 1.45, -2, -2)
        slash = pose_claw(idle, side, 1.7, -5, 0)
    else:
        wind = pose_claw(idle, side, 1.2, -1, -4)
        mid = pose_claw(idle, side, 1.45, 2, -2)
        slash = pose_claw(idle, side, 1.7, 5, 0)
    return [wind, mid, slash]


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    sheet = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    for row, facing in enumerate(("south", "west", "east", "north")):
        idle_hi = extract_idle(facing, src)
        idle = stamp_sash(fit_frame(idle_hi))
        walks = walk_frames(idle, facing)
        attacks = attack_frames(idle, facing)
        frames = [idle, *walks, *attacks]
        for col, fr in enumerate(frames):
            sheet.paste(fr, (col * FRAME, row * FRAME), fr)
    sheet.save(OUT)
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()
