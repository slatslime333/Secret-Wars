#!/usr/bin/env python3
"""Compact RPG battle sprites — slim, round, human-proportioned.

Witch south idle is pixel-identical to the approved 32x32 reference
(padded into a 48x48 frame). Every other hero uses that same construction:
rounded helmet heads, torso narrower than the head, 3px legs, limited
shading. Girls (Witch, Shadow) get an hourglass crop + skirt. Boys stay
slim but straight-sided.

Not the illustrated portrait. Not the 64x64 balloon-head pass.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHAR_DIR = ROOT / "assets" / "characters"
PORT_DIR = ROOT / "assets" / "portraits"
PREVIEW = Path("/tmp/rpg_sprites")

FRAME = 48
PORTRAIT = 128
# Native 32x32 Witch sits in the 48 frame so feet land on y=41.
OX, OY = 8, 16
COLS = ("idle0", "idle1", "walk0", "walk1", "walk2", "atk0", "atk1", "atk2", "hurt", "down")
ROWS = ("south", "north", "east", "west")
TEAM = (255, 0, 255, 255)
TRANSP = (0, 0, 0, 0)

Color = tuple[int, int, int, int]


def C(r: int, g: int, b: int, a: int = 255) -> Color:
    return (r, g, b, a)


class Pix:
    def __init__(self, w: int = FRAME, h: int = FRAME) -> None:
        self.w, self.h = w, h
        self.p = [[TRANSP] * w for _ in range(h)]

    def put(self, x: int, y: int, c: Color) -> None:
        if 0 <= x < self.w and 0 <= y < self.h and c[3]:
            self.p[y][x] = c

    def span(self, x0: int, x1: int, y: int, c: Color) -> None:
        for x in range(x0, x1 + 1):
            self.put(x, y, c)

    def fill(self, x: int, y: int, w: int, h: int, c: Color) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.put(xx, yy, c)

    def image(self) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h), TRANSP)
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                px[x, y] = self.p[y][x]
        return im

    def mirrored(self) -> "Pix":
        out = Pix(self.w, self.h)
        for y in range(self.h):
            for x in range(self.w):
                out.p[y][self.w - 1 - x] = self.p[y][x]
        return out


@dataclass
class Pose:
    bob: int = 0
    lean: int = 0
    lstep: int = 0
    rstep: int = 0
    arm: int = 0
    swing: int = 0


def pose_for(name: str) -> Pose:
    return {
        "idle0": Pose(),
        "idle1": Pose(bob=-1, arm=1),
        "walk0": Pose(lstep=1, rstep=-1, arm=-1, bob=-1),
        "walk1": Pose(),
        "walk2": Pose(lstep=-1, rstep=1, arm=1, bob=-1),
        "atk0": Pose(lean=-1, arm=-1, swing=-3, bob=-1),
        "atk1": Pose(lean=1, arm=1, swing=3, bob=1),
        "atk2": Pose(lean=1, arm=1, swing=2),
        "hurt": Pose(lean=-2, arm=-1, bob=1),
        "down": Pose(bob=6, lean=3),
    }[name]


WITCH = {
    "h": C(40, 24, 60), "d": C(22, 14, 36), "l": C(62, 40, 86),
    "b": C(204, 90, 140), "n": C(148, 52, 100),
    "a": C(90, 38, 138), "k": C(54, 22, 90), "i": C(122, 60, 168),
    "s": C(226, 188, 234), "q": C(186, 140, 200),
    "e": C(30, 18, 40), "w": C(255, 252, 255), "u": C(232, 154, 186),
    "c": C(220, 98, 150), "t": C(24, 14, 30), "p": C(240, 154, 182),
    "r": C(112, 54, 158), "m": C(76, 34, 112),
    "f": C(238, 224, 242), "j": C(176, 138, 190), "o": C(40, 24, 54),
    "y": C(150, 94, 50), "v": C(98, 60, 30),
    "x": C(234, 220, 196), "z": C(46, 32, 42), "g": C(216, 172, 64),
}
NINJA = {
    "suit": C(18, 18, 26), "lite": C(40, 40, 52), "d": C(10, 10, 16),
    "skin": C(198, 134, 74), "eye": C(255, 70, 70), "blade": C(220, 226, 232),
    "hilt": C(72, 50, 30),
}
COLE = {
    "hood": C(212, 160, 28), "hoodD": C(150, 108, 16), "stripe": C(22, 22, 28),
    "shirt": C(244, 240, 224), "pants": C(24, 24, 34),
    "skin": C(198, 134, 84), "hair": C(58, 36, 20), "eye": C(32, 18, 16),
    "bolt": C(120, 240, 255), "bolt2": C(255, 244, 120),
}
DEATH = {
    "cloth": C(18, 16, 22), "clothL": C(40, 38, 48), "wrap": C(10, 10, 14),
    "eye": C(255, 48, 48), "wood": C(90, 56, 28), "woodD": C(56, 34, 16),
    "spike": C(176, 176, 184), "gun": C(44, 44, 52),
}
SHADOW = {
    "skin": C(240, 208, 196), "skinD": C(196, 150, 138),
    "hair": C(20, 18, 26), "hairL": C(48, 46, 58),
    "shirt": C(246, 244, 238), "skirt": C(22, 20, 28),
    "eye": C(36, 24, 32), "blush": C(232, 154, 186),
    "claw": C(52, 24, 80), "clawL": C(110, 70, 150),
}
ROPE = {
    "r": C(148, 102, 52), "rd": C(98, 64, 28), "rl": C(196, 154, 88),
    "eye": C(255, 220, 70), "ink": C(16, 12, 16),
}


def wrap_put(c: Pix, x: int, y: int) -> None:
    c.put(x, y, ROPE["rd"] if (x + y) % 2 == 0 else ROPE["r"])


def wrap_fill(c: Pix, x: int, y: int, w: int, h: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            wrap_put(c, xx, yy)


def helmet(
    c: Pix,
    cx: int,
    y0: int,
    fill: Color,
    edge: Color,
    shine: Color | None = None,
) -> None:
    """Rounded 11px-wide helmet used by the Witch hair. Not a square, not a balloon."""
    c.span(cx - 3, cx + 3, y0, fill)
    c.put(cx - 4, y0, edge)
    c.put(cx + 4, y0, edge)
    c.span(cx - 4, cx + 4, y0 + 1, fill)
    c.put(cx - 4, y0 + 1, edge)
    c.put(cx + 4, y0 + 1, edge)
    if shine is not None:
        c.span(cx - 2, cx + 2, y0 + 1, shine)
    for y in range(y0 + 2, y0 + 6):
        c.span(cx - 5, cx + 5, y, fill)
        c.put(cx - 5, y, edge)
        c.put(cx + 5, y, edge)
    c.span(cx - 4, cx + 4, y0 + 6, fill)
    c.put(cx - 4, y0 + 6, edge)
    c.put(cx + 4, y0 + 6, edge)


def side_helmet(
    c: Pix,
    cx: int,
    y0: int,
    fill: Color,
    edge: Color,
    shine: Color | None = None,
) -> None:
    """True side head — 7px, same language as Witch east."""
    c.span(cx - 2, cx + 2, y0, fill)
    c.put(cx - 3, y0, edge)
    c.put(cx + 3, y0, edge)
    if shine is not None:
        c.span(cx - 1, cx + 1, y0, shine)
    for y in range(y0 + 1, y0 + 6):
        c.span(cx - 3, cx + 3, y, fill)
        c.put(cx - 3, y, edge)
        c.put(cx + 3, y, edge)
    c.span(cx - 2, cx + 2, y0 + 6, fill)
    c.put(cx - 2, y0 + 6, edge)
    c.put(cx + 2, y0 + 6, edge)


def side_torso(c: Pix, cx: int, fy: int, fill: Color, lite: Color | None = None) -> None:
    c.fill(cx - 2, fy - 14, 5, 6, fill)
    if lite is not None:
        c.fill(cx - 1, fy - 13, 3, 2, lite)


def slim_legs(
    c: Pix,
    cx: int,
    fy: int,
    pose: Pose,
    d: str,
    fill: Color,
    shoe: Color,
    hole: Color | None = None,
) -> None:
    """3px legs, 2px shoes — same as the Witch fishnets."""
    if d in ("south", "north"):
        pairs = ((-3, pose.lstep), (1, pose.rstep))
    else:
        step = pose.rstep if d == "east" else pose.lstep
        pairs = ((-1, step),)
    for i, step in pairs:
        x0 = cx + i + step
        c.fill(x0, fy - 5, 3, 4, fill)
        if hole is not None:
            c.put(x0 + 1, fy - 4, hole)
            c.put(x0 + 1, fy - 2, hole)
        c.fill(x0, fy - 1, 3, 2, shoe)


def staff(c: Pix, sx: int, y0: int, y1: int, skull_y: int) -> None:
    p = WITCH
    c.fill(sx - 1, skull_y, 3, 3, p["x"])
    c.put(sx - 1, skull_y + 1, p["z"])
    c.put(sx + 1, skull_y + 1, p["z"])
    for y in range(y0, y1):
        c.put(sx, y, p["y"] if y % 3 else p["v"])


def flip_west(draw_east, d: str, pose: Pose) -> Pix:
    if d != "west":
        return draw_east(d, pose)
    flipped = Pose(
        bob=pose.bob,
        lean=-pose.lean,
        lstep=pose.rstep,
        rstep=pose.lstep,
        arm=pose.arm,
        swing=pose.swing,
    )
    return draw_east("east", flipped).mirrored()


# ---------------------------------------------------------------------------
# Witch — south idle is the exact 32x32 reference, padded into 48x48
# ---------------------------------------------------------------------------
def witch_south_native(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    """Exact construction from the approved 32x32 south idle (CX=19, sx=12)."""
    p = WITCH

    def put(x: int, y: int, k: str) -> None:
        c.put(ox + x, oy + y, p[k])

    def span(x0: int, x1: int, y: int, k: str) -> None:
        for x in range(x0, x1 + 1):
            put(x, y, k)

    cx = 19
    sx = 12 + pose.swing

    put(cx, 2, "d")
    span(cx - 1, cx + 1, 3, "h")
    span(cx - 2, cx + 2, 4, "h")
    put(cx - 2, 4, "l")
    put(cx + 2, 4, "l")
    span(cx - 3, cx + 3, 5, "h")
    span(cx - 4, cx + 4, 6, "b")
    put(cx - 4, 6, "d")
    put(cx + 4, 6, "d")
    put(cx - 3, 6, "n")
    put(cx + 3, 6, "n")
    span(cx - 6, cx + 6, 7, "h")
    put(cx - 6, 7, "d")
    put(cx + 6, 7, "d")
    put(cx + 6, 8, "g")

    span(cx - 3, cx + 3, 8, "a")
    put(cx - 4, 8, "k")
    put(cx + 4, 8, "k")
    span(cx - 4, cx + 4, 9, "a")
    put(cx - 4, 9, "k")
    put(cx + 4, 9, "k")
    for y in range(10, 14):
        span(cx - 5, cx + 5, y, "a")
        put(cx - 5, y, "k")
        put(cx + 5, y, "k")
    span(cx - 4, cx + 4, 14, "a")
    put(cx - 4, 14, "k")
    put(cx + 4, 14, "k")
    span(cx - 2, cx + 2, 9, "i")
    for y in range(14, 16):
        put(cx - 5, y, "k")
        put(cx - 4, y, "a")
        put(cx + 4, y, "a")
        put(cx + 5, y, "k")

    span(cx - 2, cx + 2, 10, "a")
    put(cx, 10, "s")
    for y in range(11, 14):
        span(cx - 2, cx + 2, y, "s")
    put(cx, 14, "q")
    put(cx - 2, 11, "w")
    put(cx - 1, 11, "e")
    put(cx + 1, 11, "w")
    put(cx + 2, 11, "e")
    put(cx, 13, "q")
    put(cx - 2, 13, "u")
    put(cx + 2, 13, "u")

    for y in range(15, 18):
        span(cx - 3, cx + 3, y, "c")
        put(cx - 3, y, "t")
        put(cx + 3, y, "t")
    put(cx, 16, "p")
    put(cx, 17, "t")

    span(cx - 2, cx + 2, 18, "s")
    put(cx - 2, 18, "q")
    put(cx + 2, 18, "q")

    span(cx - 3, cx + 3, 19, "r")
    span(cx - 3, cx + 3, 20, "m")
    put(cx - 3, 19, "m")
    put(cx + 3, 19, "m")

    for dx, step in ((-3, pose.lstep), (1, pose.rstep)):
        x0 = cx + dx + step
        span(x0, x0 + 2, 21, "f")
        put(x0, 22, "f")
        put(x0 + 1, 22, "j")
        put(x0 + 2, 22, "f")
        span(x0, x0 + 2, 23, "f")
        span(x0, x0 + 2, 24, "o")
        span(x0, x0 + 2, 25, "o")

    span(sx - 3, sx - 1, 6, "x")
    put(sx - 3, 7, "z")
    put(sx - 2, 7, "x")
    put(sx - 1, 7, "z")
    span(sx - 3, sx - 1, 8, "x")
    put(sx - 1, 9, "x")
    put(sx, 9, "y")
    for y in range(10, 25):
        put(sx, y, "y" if y % 3 else "v")
    put(sx, 24, "v")

    put(sx, 17, "s")
    put(sx + 1, 16 + pose.arm, "s")
    put(sx + 2, 16 + pose.arm, "s")
    put(sx + 3, 16 + pose.arm, "s")
    put(cx + 4, 16 + pose.arm, "s")
    put(cx + 4, 17 + pose.arm, "q")


def witch_hat(c: Pix, cx: int, hy: int, brim: int, charm_right: bool) -> None:
    p = WITCH
    c.put(cx, hy, p["d"])
    c.span(cx - 1, cx + 1, hy + 1, p["h"])
    c.span(cx - 2, cx + 2, hy + 2, p["h"])
    c.put(cx - 2, hy + 2, p["l"])
    c.put(cx + 2, hy + 2, p["l"])
    c.span(cx - 3, cx + 3, hy + 3, p["h"])
    c.span(cx - 4, cx + 4, hy + 4, p["b"])
    c.put(cx - 4, hy + 4, p["d"])
    c.put(cx + 4, hy + 4, p["d"])
    c.put(cx - 3, hy + 4, p["n"])
    c.put(cx + 3, hy + 4, p["n"])
    c.span(cx - brim, cx + brim, hy + 5, p["h"])
    c.put(cx - brim, hy + 5, p["d"])
    c.put(cx + brim, hy + 5, p["d"])
    if charm_right:
        c.put(cx + brim, hy + 6, p["g"])
    else:
        c.put(cx - brim, hy + 6, p["g"])


def witch_north(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = WITCH
    cx = 19
    sx = 26 + pose.swing

    def put(x: int, y: int, k: str) -> None:
        c.put(ox + x, oy + y, p[k])

    def span(x0: int, x1: int, y: int, k: str) -> None:
        for x in range(x0, x1 + 1):
            put(x, y, k)

    witch_hat(c, ox + cx, oy + 2, 6, charm_right=False)
    # Same round helmet as south — short locks, body stays visible.
    span(cx - 3, cx + 3, 8, "a")
    put(cx - 4, 8, "k")
    put(cx + 4, 8, "k")
    span(cx - 4, cx + 4, 9, "a")
    put(cx - 4, 9, "k")
    put(cx + 4, 9, "k")
    span(cx - 2, cx + 2, 9, "i")
    for y in range(10, 14):
        span(cx - 5, cx + 5, y, "a")
        put(cx - 5, y, "k")
        put(cx + 5, y, "k")
    span(cx - 4, cx + 4, 14, "a")
    put(cx - 4, 14, "k")
    put(cx + 4, 14, "k")
    for y in range(14, 16):
        put(cx - 5, y, "k")
        put(cx - 4, y, "a")
        put(cx + 4, y, "a")
        put(cx + 5, y, "k")
    for y in range(15, 18):
        span(cx - 3, cx + 3, y, "r")
        put(cx - 3, y, "m")
        put(cx + 3, y, "m")
    span(cx - 3, cx + 3, 19, "r")
    span(cx - 3, cx + 3, 20, "m")
    for dx, step in ((-3, pose.lstep), (1, pose.rstep)):
        x0 = cx + dx + step
        span(x0, x0 + 2, 21, "f")
        put(x0 + 1, 22, "j")
        span(x0, x0 + 2, 23, "f")
        span(x0, x0 + 2, 24, "o")
        span(x0, x0 + 2, 25, "o")
    staff(c, ox + sx, oy + 10, oy + 25, oy + 6)
    put(sx - 1, 16 + pose.arm, "s")
    put(sx, 17 + pose.arm, "s")


def witch_east(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = WITCH
    cx = 16
    sx = 22 + pose.swing

    def put(x: int, y: int, k: str) -> None:
        c.put(ox + x, oy + y, p[k])

    def span(x0: int, x1: int, y: int, k: str) -> None:
        for x in range(x0, x1 + 1):
            put(x, y, k)

    witch_hat(c, ox + cx, oy + 2, 5, charm_right=True)
    # round hair, face on the right, lock trailing left
    span(cx - 2, cx + 2, 8, "a")
    put(cx - 3, 8, "k")
    put(cx + 3, 8, "k")
    for y in range(9, 14):
        span(cx - 3, cx + 3, y, "a")
        put(cx - 3, y, "k")
        put(cx + 3, y, "k")
    span(cx - 2, cx + 2, 14, "a")
    for y in range(12, 16):
        put(cx - 4, y, "k")
        put(cx - 3, y, "a")
    span(cx, cx + 2, 10, "s")
    span(cx, cx + 2, 11, "s")
    span(cx, cx + 2, 12, "s")
    span(cx, cx + 1, 13, "s")
    put(cx + 1, 11, "w")
    put(cx + 2, 11, "e")
    put(cx + 1, 13, "u")
    for y in range(15, 18):
        span(cx - 2, cx + 2, y, "c")
        put(cx - 2, y, "t")
        put(cx + 2, y, "t")
    put(cx, 16, "p")
    span(cx - 1, cx + 1, 18, "s")
    span(cx - 2, cx + 2, 19, "r")
    span(cx - 2, cx + 2, 20, "m")
    x0 = cx - 1 + pose.rstep
    span(x0, x0 + 2, 21, "f")
    put(x0 + 1, 22, "j")
    span(x0, x0 + 2, 23, "f")
    span(x0, x0 + 2, 24, "o")
    span(x0, x0 + 2, 25, "o")
    staff(c, ox + sx, oy + 10, oy + 25, oy + 6)
    put(sx - 1, 16 + pose.arm, "s")
    put(sx, 17, "s")
    put(cx + 3, 16, "s")


def witch(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = WITCH
    ox, oy = OX + pose.lean, OY + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(18, 34, 14, 6, p["a"])
        c.fill(20, 39, 10, 4, p["r"])
        c.fill(14, 28, 7, 6, p["h"])
        staff(c, 34, 32, 42, 26)
        return c
    if d == "south":
        witch_south_native(c, ox, oy, pose)
        return c
    if d == "north":
        witch_north(c, ox, oy, pose)
        return c
    if d == "west":
        return flip_west(lambda dd, pp: witch(dd, pp), d, pose)
    witch_east(c, ox, oy, pose)
    return c


# ---------------------------------------------------------------------------
# Shared slim body for the rest of the roster
# ---------------------------------------------------------------------------
def boy_torso(c: Pix, cx: int, fy: int, fill: Color, lite: Color | None = None) -> None:
    """7px chest, narrower than the 11px head."""
    c.fill(cx - 3, fy - 14, 7, 6, fill)
    if lite is not None:
        c.fill(cx - 2, fy - 13, 5, 2, lite)


def girl_hourglass(
    c: Pix,
    cx: int,
    fy: int,
    top: Color,
    rail: Color | None,
    skin: Color,
    skirt: Color,
    skirt_d: Color,
) -> None:
    """7px top, 5px waist, 7px skirt — Witch corset proportions."""
    c.fill(cx - 3, fy - 14, 7, 3, top)
    if rail is not None:
        c.put(cx - 3, fy - 13, rail)
        c.put(cx + 3, fy - 13, rail)
        c.put(cx, fy - 12, rail)
    c.span(cx - 2, cx + 2, fy - 11, skin)
    c.span(cx - 3, cx + 3, fy - 10, skirt)
    c.span(cx - 3, cx + 3, fy - 9, skirt_d)
    c.put(cx - 3, fy - 10, skirt_d)
    c.put(cx + 3, fy - 10, skirt_d)


def round_bun(c: Pix, cx: int, cy: int, fill: Color) -> None:
    """Tiny round bun sitting on the helmet, not a wide bar."""
    c.put(cx, cy - 1, fill)
    c.span(cx - 1, cx + 1, cy, fill)
    c.put(cx, cy + 1, fill)


def shadow_claw(c: Pix, hx: int, hy: int) -> None:
    p = SHADOW
    c.fill(hx, hy, 3, 3, p["claw"])
    c.put(hx + 3, hy - 1, p["clawL"])
    c.put(hx + 4, hy, p["clawL"])
    c.put(hx + 3, hy + 1, p["clawL"])
    c.put(hx + 2, hy - 2, p["clawL"])


# ---------------------------------------------------------------------------
# Ninja
# ---------------------------------------------------------------------------
def ninja_east(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = NINJA
    cx, fy = 24 + pose.lean, 41 + pose.bob
    slim_legs(c, cx, fy, pose, "east", p["suit"], p["d"])
    side_torso(c, cx, fy, p["suit"], p["lite"])
    hy = fy - 23
    side_helmet(c, cx, hy, p["suit"], p["lite"], p["lite"])
    c.span(cx - 3, cx + 3, hy + 2, TEAM)
    c.fill(cx - 7, hy + 1, 3, 2, TEAM)
    c.put(cx + 2, hy + 5, C(255, 252, 255))
    c.put(cx + 3, hy + 5, p["eye"])
    c.put(cx + 1, hy + 7, p["skin"])
    c.put(cx + 4, fy - 12 + pose.arm, p["skin"])
    hx = cx + 5 + pose.swing
    c.fill(hx, fy - 13, 8, 1, p["blade"])
    c.fill(hx, fy - 12, 2, 2, p["hilt"])
    return c


def ninja(d: str, pose: Pose) -> Pix:
    if d == "west":
        return flip_west(ninja_east, d, pose)
    c = Pix()
    p = NINJA
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(16, 34, 16, 6, p["suit"])
        c.fill(18, 32, 8, 3, TEAM)
        c.fill(30, 30, 10, 1, p["blade"])
        return c
    slim_legs(c, cx, fy, pose, d, p["suit"], p["d"])
    boy_torso(c, cx, fy, p["suit"], p["lite"])
    hy = fy - 23
    helmet(c, cx, hy, p["suit"], p["lite"], p["lite"])
    c.span(cx - 4, cx + 4, hy + 2, TEAM)
    if d == "south":
        c.fill(cx + 5, hy + 1, 3, 2, TEAM)
        c.fill(cx + 8, hy, 2, 2, TEAM)
        c.put(cx - 2, hy + 5, C(255, 252, 255))
        c.put(cx - 1, hy + 5, p["eye"])
        c.put(cx + 1, hy + 5, C(255, 252, 255))
        c.put(cx + 2, hy + 5, p["eye"])
        c.span(cx - 1, cx + 1, hy + 7, p["skin"])
        c.put(cx - 5, fy - 12 + pose.arm, p["skin"])
        c.put(cx + 5, fy - 12, p["skin"])
        hx = cx + 6
        c.fill(hx, fy - 20 - pose.swing, 1, 9 + abs(pose.swing), p["blade"])
        c.fill(hx - 1, fy - 12 + pose.arm, 3, 2, p["hilt"])
    elif d == "north":
        c.fill(cx - 8, hy + 1, 3, 2, TEAM)
        c.fill(cx - 7, fy - 20, 1, 10, p["blade"])
        c.put(cx - 5, fy - 12 + pose.arm, p["skin"])
        c.put(cx + 5, fy - 12, p["skin"])
    elif d == "east":
        return ninja_east(d, pose)
    return c


# ---------------------------------------------------------------------------
# Cole
# ---------------------------------------------------------------------------
def cole_east(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = COLE
    cx, fy = 24 + pose.lean, 41 + pose.bob
    slim_legs(c, cx, fy, pose, "east", p["pants"], p["stripe"])
    c.fill(cx - 2, fy - 14, 5, 6, p["hood"])
    c.put(cx - 2, fy - 12, p["stripe"])
    c.put(cx + 2, fy - 12, p["stripe"])
    c.fill(cx - 1, fy - 13, 3, 4, p["shirt"])
    hy = fy - 23
    side_helmet(c, cx, hy, p["hair"], p["hair"])
    c.fill(cx, hy + 3, 4, 4, p["skin"])
    c.put(cx + 2, hy + 5, p["eye"])
    c.put(cx + 4, fy - 12, p["skin"])
    c.put(cx + 5, fy - 14 + pose.swing // 2, p["bolt"])
    return c


def cole(d: str, pose: Pose) -> Pix:
    if d == "west":
        return flip_west(cole_east, d, pose)
    c = Pix()
    p = COLE
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(16, 34, 16, 6, p["hood"])
        c.fill(20, 30, 8, 5, p["skin"])
        return c
    slim_legs(c, cx, fy, pose, d, p["pants"], p["stripe"])
    # fitted hoodie: 7px, white shirt sliver
    c.fill(cx - 3, fy - 14, 7, 6, p["hood"])
    c.put(cx - 3, fy - 12, p["stripe"])
    c.put(cx + 3, fy - 12, p["stripe"])
    c.put(cx - 3, fy - 10, p["stripe"])
    c.put(cx + 3, fy - 10, p["stripe"])
    c.fill(cx - 1, fy - 13, 3, 4, p["shirt"])
    hy = fy - 23
    helmet(c, cx, hy, p["skin"], p["hair"])
    # buzz hair cap on the round head
    c.span(cx - 4, cx + 4, hy, p["hair"])
    c.span(cx - 5, cx + 5, hy + 1, p["hair"])
    c.span(cx - 5, cx + 5, hy + 2, p["hair"])
    if d == "south":
        c.put(cx - 2, hy + 5, C(255, 252, 255))
        c.put(cx - 1, hy + 5, p["eye"])
        c.put(cx + 1, hy + 5, C(255, 252, 255))
        c.put(cx + 2, hy + 5, p["eye"])
        c.put(cx, hy + 7, p["skin"])
        c.put(cx - 5, fy - 12 + pose.arm, p["skin"])
        c.put(cx + 5, fy - 12, p["skin"])
        c.put(cx - 6, fy - 14 + pose.arm, p["bolt"])
        c.put(cx + 6, fy - 14, p["bolt2"] if pose.bob else p["bolt"])
    elif d == "north":
        helmet(c, cx, hy, p["hood"], p["hoodD"])
        c.span(cx - 4, cx + 4, hy, p["hair"])
        c.put(cx - 5, fy - 14, p["bolt"])
        c.put(cx + 5, fy - 14, p["bolt"])
    elif d == "east":
        return cole_east(d, pose)
    return c


# ---------------------------------------------------------------------------
# Death
# ---------------------------------------------------------------------------
def death_east(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = DEATH
    cx, fy = 24 + pose.lean, 41 + pose.bob
    slim_legs(c, cx, fy, pose, "east", p["cloth"], p["wrap"])
    side_torso(c, cx, fy, p["cloth"], p["clothL"])
    hy = fy - 23
    side_helmet(c, cx, hy, p["wrap"], p["clothL"], p["cloth"])
    c.put(cx + 2, hy + 5, C(255, 252, 255))
    c.put(cx + 3, hy + 5, p["eye"])
    hx = cx + 5 + pose.swing
    hy2 = fy - 13 + pose.arm
    for i in range(8):
        c.put(hx + i // 2, hy2 - i, p["wood"] if i % 2 == 0 else p["woodD"])
    c.put(hx + 3, hy2 - 8, p["spike"])
    c.fill(cx - 3, fy - 11, 4, 2, p["gun"])
    return c


def death(d: str, pose: Pose) -> Pix:
    if d == "west":
        return flip_west(death_east, d, pose)
    c = Pix()
    p = DEATH
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(14, 34, 18, 7, p["cloth"])
        c.fill(30, 30, 8, 2, p["wood"])
        c.put(20, 36, p["eye"])
        return c
    slim_legs(c, cx, fy, pose, d, p["cloth"], p["wrap"])
    boy_torso(c, cx, fy, p["cloth"], p["clothL"])
    hy = fy - 23
    helmet(c, cx, hy, p["wrap"], p["clothL"], p["cloth"])
    if d == "south":
        c.put(cx - 2, hy + 5, C(255, 252, 255))
        c.put(cx - 1, hy + 5, p["eye"])
        c.put(cx + 1, hy + 5, C(255, 252, 255))
        c.put(cx + 2, hy + 5, p["eye"])
        hx = cx + 5 + pose.swing
        hy2 = fy - 13 + pose.arm
        for i in range(8):
            c.put(hx + i // 2, hy2 - i, p["wood"] if i % 2 == 0 else p["woodD"])
        c.put(hx + 3, hy2 - 8, p["spike"])
        c.fill(cx - 4, fy - 11, 4, 2, p["gun"])
        c.put(cx - 5, fy - 12 + pose.arm, C(198, 134, 74))
        c.put(cx + 5, fy - 12, C(198, 134, 74))
    elif d == "north":
        helmet(c, cx, hy, p["wrap"], p["clothL"], p["cloth"])
        c.fill(cx - 7, fy - 20, 1, 10, p["wood"])
        c.fill(cx + 2, fy - 11, 4, 2, p["gun"])
    elif d == "east":
        return death_east(d, pose)
    return c


# ---------------------------------------------------------------------------
# Shadow — same feminine hourglass as Witch
# ---------------------------------------------------------------------------
def shadow_east(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = SHADOW
    cx, fy = 24 + pose.lean, 41 + pose.bob
    slim_legs(c, cx, fy, pose, "east", p["skin"], p["hair"])
    girl_hourglass(c, cx, fy, p["shirt"], p["hair"], p["skinD"], p["skirt"], p["hair"])
    hy = fy - 23
    side_helmet(c, cx, hy, p["hair"], p["hair"], p["hairL"])
    round_bun(c, cx + 3, hy + 1, p["hair"])
    c.fill(cx, hy + 3, 3, 4, p["skin"])
    c.put(cx + 2, hy + 5, C(255, 252, 255))
    c.put(cx + 3, hy + 5, p["eye"])
    c.put(cx + 2, hy + 7, p["blush"])
    c.put(cx - 5, hy + 6, p["hair"])
    c.put(cx - 5, hy + 7, p["hair"])
    shadow_claw(c, cx + 6 + pose.swing, fy - 12 + pose.arm)
    return c


def shadow(d: str, pose: Pose) -> Pix:
    if d == "west":
        return flip_west(shadow_east, d, pose)
    c = Pix()
    p = SHADOW
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(16, 34, 14, 6, p["hair"])
        c.fill(18, 38, 10, 4, p["skirt"])
        return c
    slim_legs(c, cx, fy, pose, d, p["skin"], p["hair"])
    girl_hourglass(c, cx, fy, p["shirt"], p["hair"], p["skinD"], p["skirt"], p["hair"])
    hy = fy - 23
    helmet(c, cx, hy, p["hair"], p["hair"], p["hairL"])
    round_bun(c, cx - 5, hy + 1, p["hair"])
    round_bun(c, cx + 5, hy + 1, p["hair"])
    if d == "south":
        # oval face inside the helmet, same language as Witch
        c.fill(cx - 2, hy + 3, 5, 4, p["skin"])
        c.put(cx, hy + 2, p["skin"])
        c.span(cx - 3, cx + 1, hy + 2, p["hair"])
        c.put(cx - 2, hy + 5, C(255, 252, 255))
        c.put(cx - 1, hy + 5, p["eye"])
        c.put(cx + 1, hy + 5, C(255, 252, 255))
        c.put(cx + 2, hy + 5, p["eye"])
        c.put(cx - 2, hy + 6, p["blush"])
        c.put(cx + 2, hy + 6, p["blush"])
        c.put(cx - 5, hy + 7, p["hair"])
        c.put(cx + 5, hy + 7, p["hair"])
        c.put(cx + 5, fy - 12, p["skin"])
        shadow_claw(c, cx - 8, fy - 12 + pose.arm)
    elif d == "north":
        helmet(c, cx, hy, p["hair"], p["hair"], p["hairL"])
        round_bun(c, cx - 5, hy + 1, p["hair"])
        round_bun(c, cx + 5, hy + 1, p["hair"])
        c.put(cx - 5, hy + 7, p["hair"])
        c.put(cx + 5, hy + 7, p["hair"])
        shadow_claw(c, cx + 6, fy - 12)
    elif d == "east":
        return shadow_east(d, pose)
    return c


# ---------------------------------------------------------------------------
# Rope
# ---------------------------------------------------------------------------
def rope_east(d: str, pose: Pose) -> Pix:
    c = Pix()
    cx, fy = 24 + pose.lean, 41 + pose.bob
    slim_wrap_legs(c, cx, fy, pose, "east")
    wrap_fill(c, cx - 2, fy - 14, 5, 6)
    hy = fy - 23
    wrap_side_helmet(c, cx, hy)
    c.put(cx + 2, hy + 4, ROPE["eye"])
    c.put(cx + 2, hy + 5, ROPE["eye"])
    c.put(cx + 3, hy + 4, ROPE["ink"])
    wrap_fill(c, cx + 4, fy - 13 + pose.arm, 2, 4)
    return c


def slim_wrap_legs(c: Pix, cx: int, fy: int, pose: Pose, d: str) -> None:
    if d in ("south", "north"):
        pairs = ((-3, pose.lstep), (1, pose.rstep))
    else:
        step = pose.rstep if d == "east" else pose.lstep
        pairs = ((-1, step),)
    for i, step in pairs:
        x0 = cx + i + step
        wrap_fill(c, x0, fy - 5, 3, 6)


def wrap_helmet(c: Pix, cx: int, y0: int) -> None:
    def row(x0: int, x1: int, y: int) -> None:
        for x in range(x0, x1 + 1):
            wrap_put(c, x, y)

    row(cx - 3, cx + 3, y0)
    wrap_put(c, cx - 4, y0)
    wrap_put(c, cx + 4, y0)
    row(cx - 4, cx + 4, y0 + 1)
    for y in range(y0 + 2, y0 + 6):
        row(cx - 5, cx + 5, y)
    row(cx - 4, cx + 4, y0 + 6)


def wrap_side_helmet(c: Pix, cx: int, y0: int) -> None:
    def row(x0: int, x1: int, y: int) -> None:
        for x in range(x0, x1 + 1):
            wrap_put(c, x, y)

    row(cx - 2, cx + 2, y0)
    wrap_put(c, cx - 3, y0)
    wrap_put(c, cx + 3, y0)
    for y in range(y0 + 1, y0 + 6):
        row(cx - 3, cx + 3, y)
    row(cx - 2, cx + 2, y0 + 6)


def rope(d: str, pose: Pose) -> Pix:
    if d == "west":
        return flip_west(rope_east, d, pose)
    c = Pix()
    p = ROPE
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down" or pose.bob >= 6:
        wrap_fill(c, 16, 34, 16, 6)
        c.fill(22, 32, 3, 3, p["eye"])
        return c
    slim_wrap_legs(c, cx, fy, pose, d)
    wrap_fill(c, cx - 3, fy - 14, 7, 6)
    hy = fy - 23
    wrap_helmet(c, cx, hy)
    if d != "north":
        c.put(cx - 3, hy + 4, p["eye"])
        c.put(cx - 2, hy + 4, p["eye"])
        c.put(cx - 2, hy + 5, p["eye"])
        c.put(cx + 1, hy + 4, p["eye"])
        c.put(cx + 2, hy + 4, p["eye"])
        c.put(cx + 1, hy + 5, p["eye"])
        c.put(cx - 2, hy + 4, p["ink"])
        c.put(cx + 2, hy + 4, p["ink"])
    wrap_fill(c, cx - 6, fy - 13 + pose.arm, 2, 4)
    wrap_fill(c, cx + 5, fy - 13, 2, 4)
    if d == "east":
        return rope_east(d, pose)
    return c


DRAW = {
    "witch": witch,
    "ninja": ninja,
    "cole": cole,
    "death": death,
    "shadow": shadow,
    "rope": rope,
}


def sheet_for(hero: str) -> Image.Image:
    img = Image.new("RGBA", (FRAME * len(COLS), FRAME * len(ROWS)), TRANSP)
    draw = DRAW[hero]
    for ry, d in enumerate(ROWS):
        for cx, name in enumerate(COLS):
            facing = "down" if name == "down" else d
            fr = draw(facing, pose_for(name)).image()
            img.paste(fr, (cx * FRAME, ry * FRAME), fr)
    return img


def portrait_from_south(hero: str) -> Image.Image:
    idle = DRAW[hero]("south", Pose()).image()
    bbox = idle.getbbox()
    if not bbox:
        return Image.new("RGBA", (PORTRAIT, PORTRAIT), (20, 16, 24, 255))
    x0, y0, x1, y1 = bbox
    head = idle.crop((max(0, x0 - 2), max(0, y0 - 2), min(FRAME, x1 + 2), min(FRAME, y0 + 20)))
    bg = {
        "witch": (42, 22, 58, 255),
        "ninja": (16, 14, 22, 255),
        "cole": (36, 28, 16, 255),
        "death": (12, 10, 14, 255),
        "shadow": (22, 16, 28, 255),
        "rope": (32, 22, 14, 255),
    }[hero]
    canvas = Image.new("RGBA", (PORTRAIT, PORTRAIT), bg)
    scale = min(PORTRAIT / max(1, head.width), PORTRAIT / max(1, head.height)) * 0.92
    nw, nh = max(8, int(head.width * scale)), max(8, int(head.height * scale))
    big = head.resize((nw, nh), Image.Resampling.NEAREST)
    canvas.alpha_composite(big, ((PORTRAIT - nw) // 2, (PORTRAIT - nh) // 2 + 8))
    return canvas


def zoom_on_pink(im: Image.Image, factor: int) -> Image.Image:
    pink = (255, 228, 236, 255)
    bg = Image.new("RGBA", im.size, pink)
    bg.alpha_composite(im)
    return bg.resize((im.width * factor, im.height * factor), Image.Resampling.NEAREST)


def roster_preview(sheets: dict[str, Image.Image]) -> Image.Image:
    order = ("ninja", "cole", "death", "rope", "witch", "shadow")
    cell = FRAME * 4
    img = Image.new("RGBA", (cell * 4, cell * 6), (18, 14, 24, 255))
    for i, hero in enumerate(order):
        sheet = sheets[hero]
        for d, _col in enumerate(ROWS):
            frame = sheet.crop((0, d * FRAME, FRAME, d * FRAME + FRAME))
            img.paste(zoom_on_pink(frame, 4), (d * cell, i * cell))
    return img


def south_idle_strip(sheets: dict[str, Image.Image]) -> Image.Image:
    order = ("witch", "shadow", "ninja", "cole", "death", "rope")
    cell = FRAME * 12
    img = Image.new("RGBA", (cell * 6, cell), (255, 228, 236, 255))
    for i, hero in enumerate(order):
        frame = sheets[hero].crop((0, 0, FRAME, FRAME))
        img.paste(zoom_on_pink(frame, 12), (i * cell, 0))
    return img


def assert_witch_matches_reference() -> None:
    """South idle0 must match the approved 32x32 pixels (padded at OX, OY)."""
    git_ref = Path("/tmp/ref-witch-32.png")
    if not git_ref.exists():
        return
    ref = Image.open(git_ref).convert("RGBA")
    got = witch("south", Pose()).image().crop((OX, OY, OX + 32, OY + 32))
    rp, gp = ref.load(), got.load()
    mismatch = 0
    for y in range(32):
        for x in range(32):
            if rp[x, y] != gp[x, y]:
                mismatch += 1
    if mismatch:
        raise SystemExit(f"Witch south idle differs from 32x32 reference by {mismatch} pixels")
    print("witch south idle matches 32x32 reference")


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    PORT_DIR.mkdir(parents=True, exist_ok=True)
    assert_witch_matches_reference()
    sheets: dict[str, Image.Image] = {}
    for hero in DRAW:
        sheet = sheet_for(hero)
        sheets[hero] = sheet
        out = CHAR_DIR / hero / "sheet.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(out)
        if hero != "witch":
            portrait_from_south(hero).save(PORT_DIR / f"{hero}.png")
        print(f"wrote {hero} {sheet.size}")

    south = DRAW["witch"]("south", Pose()).image()
    (CHAR_DIR / "witch").mkdir(parents=True, exist_ok=True)
    south.save(CHAR_DIR / "witch" / "south-idle.png")

    roster_preview(sheets).save(PREVIEW / "roster_dirs_x4.png")
    south_idle_strip(sheets).save(PREVIEW / "roster_south_x12.png")
    pink = (255, 228, 236, 255)
    strip = Image.new("RGBA", (FRAME * 8 * 4, FRAME * 8), pink)
    for i, d in enumerate(ROWS):
        fr = DRAW["witch"](d, Pose()).image()
        strip.paste(zoom_on_pink(fr, 8), (i * FRAME * 8, 0))
    strip.save(PREVIEW / "witch_dirs_x8.png")
    zoom_on_pink(south, 12).save(PREVIEW / "witch_south_x12.png")


if __name__ == "__main__":
    main()
