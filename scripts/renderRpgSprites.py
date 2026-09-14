#!/usr/bin/env python3
"""Compact RPG battle sprites in the Witch's native 32px construction.

Witch south idle is pixel-identical to the approved 32x32 reference.
Every other hero uses that same skeleton: round helmet, shoulder locks
(neck), 7px chest, 5px waist, 7px hips, 3px legs, and 1px-tall arms.
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
    "hilt": C(72, 50, 30), "belt": C(96, 96, 112),
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
    # Solid forward button eyes.
    put(cx - 1, 11, "e")
    put(cx + 1, 11, "e")
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
# Native-32 skeleton shared with Witch (neck, arms, waist, hips, legs)
# ---------------------------------------------------------------------------
BODY_CX = 19


def nput(c: Pix, ox: int, oy: int, x: int, y: int, col: Color) -> None:
    c.put(ox + x, oy + y, col)


def nspan(c: Pix, ox: int, oy: int, x0: int, x1: int, y: int, col: Color) -> None:
    for x in range(x0, x1 + 1):
        nput(c, ox, oy, x, y, col)


def buttons(c: Pix, ox: int, oy: int, cx: int, y: int, col: Color, side: bool = False) -> None:
    """One solid pixel per eye, facing the camera. No white shine."""
    if side:
        nput(c, ox, oy, cx + 2, y, col)
        return
    nput(c, ox, oy, cx - 1, y, col)
    nput(c, ox, oy, cx + 1, y, col)


def head_helmet(c: Pix, ox: int, oy: int, cx: int, fill: Color, edge: Color, shine: Color | None = None) -> None:
    nspan(c, ox, oy, cx - 3, cx + 3, 8, fill)
    nput(c, ox, oy, cx - 4, 8, edge)
    nput(c, ox, oy, cx + 4, 8, edge)
    nspan(c, ox, oy, cx - 4, cx + 4, 9, fill)
    nput(c, ox, oy, cx - 4, 9, edge)
    nput(c, ox, oy, cx + 4, 9, edge)
    if shine is not None:
        nspan(c, ox, oy, cx - 2, cx + 2, 9, shine)
    for y in range(10, 14):
        nspan(c, ox, oy, cx - 5, cx + 5, y, fill)
        nput(c, ox, oy, cx - 5, y, edge)
        nput(c, ox, oy, cx + 5, y, edge)
    nspan(c, ox, oy, cx - 4, cx + 4, 14, fill)
    nput(c, ox, oy, cx - 4, 14, edge)
    nput(c, ox, oy, cx + 4, 14, edge)


def shoulder_locks(c: Pix, ox: int, oy: int, cx: int, fill: Color, edge: Color) -> None:
    for y in range(14, 16):
        nput(c, ox, oy, cx - 5, y, edge)
        nput(c, ox, oy, cx - 4, y, fill)
        nput(c, ox, oy, cx + 4, y, fill)
        nput(c, ox, oy, cx + 5, y, edge)


def oval_face(c: Pix, ox: int, oy: int, cx: int, skin: Color, shade: Color) -> None:
    nspan(c, ox, oy, cx - 2, cx + 2, 10, skin)
    for y in range(11, 14):
        nspan(c, ox, oy, cx - 2, cx + 2, y, skin)
    nput(c, ox, oy, cx, 14, shade)
    nput(c, ox, oy, cx, 13, shade)


def chest_waist_hips(
    c: Pix,
    ox: int,
    oy: int,
    cx: int,
    chest: Color,
    rail: Color | None,
    waist: Color,
    hip: Color,
    hip_d: Color,
    lace: Color | None = None,
) -> None:
    for y in range(15, 18):
        nspan(c, ox, oy, cx - 3, cx + 3, y, chest)
        if rail is not None:
            nput(c, ox, oy, cx - 3, y, rail)
            nput(c, ox, oy, cx + 3, y, rail)
    if lace is not None:
        nput(c, ox, oy, cx, 16, lace)
        nput(c, ox, oy, cx, 17, rail if rail is not None else lace)
    nspan(c, ox, oy, cx - 2, cx + 2, 18, waist)
    nspan(c, ox, oy, cx - 3, cx + 3, 19, hip)
    nspan(c, ox, oy, cx - 3, cx + 3, 20, hip_d)
    nput(c, ox, oy, cx - 3, 19, hip_d)
    nput(c, ox, oy, cx + 3, 19, hip_d)


def fishnet_legs(c: Pix, ox: int, oy: int, cx: int, pose: Pose, fill: Color, hole: Color, shoe: Color) -> None:
    for dx, step in ((-3, pose.lstep), (1, pose.rstep)):
        x0 = cx + dx + step
        nspan(c, ox, oy, x0, x0 + 2, 21, fill)
        nput(c, ox, oy, x0, 22, fill)
        nput(c, ox, oy, x0 + 1, 22, hole)
        nput(c, ox, oy, x0 + 2, 22, fill)
        nspan(c, ox, oy, x0, x0 + 2, 23, fill)
        nspan(c, ox, oy, x0, x0 + 2, 24, shoe)
        nspan(c, ox, oy, x0, x0 + 2, 25, shoe)


def stick_arms(c: Pix, ox: int, oy: int, cx: int, pose: Pose, sleeve: Color, hand: Color) -> None:
    ay = 16 + pose.arm
    nput(c, ox, oy, cx - 6, ay, hand)
    nput(c, ox, oy, cx - 5, ay, sleeve)
    nput(c, ox, oy, cx - 4, ay, sleeve)
    nput(c, ox, oy, cx + 4, ay, sleeve)
    nput(c, ox, oy, cx + 4, ay + 1, hand)


def east_helmet(c: Pix, ox: int, oy: int, cx: int, fill: Color, edge: Color) -> None:
    nspan(c, ox, oy, cx - 2, cx + 2, 8, fill)
    nput(c, ox, oy, cx - 3, 8, edge)
    nput(c, ox, oy, cx + 3, 8, edge)
    for y in range(9, 14):
        nspan(c, ox, oy, cx - 3, cx + 3, y, fill)
        nput(c, ox, oy, cx - 3, y, edge)
        nput(c, ox, oy, cx + 3, y, edge)
    nspan(c, ox, oy, cx - 2, cx + 2, 14, fill)
    for y in range(12, 16):
        nput(c, ox, oy, cx - 4, y, edge)
        nput(c, ox, oy, cx - 3, y, fill)


def east_body(
    c: Pix,
    ox: int,
    oy: int,
    cx: int,
    pose: Pose,
    chest: Color,
    rail: Color | None,
    waist: Color,
    hip: Color,
    hip_d: Color,
    leg: Color,
    hole: Color,
    shoe: Color,
) -> None:
    for y in range(15, 18):
        nspan(c, ox, oy, cx - 2, cx + 2, y, chest)
        if rail is not None:
            nput(c, ox, oy, cx - 2, y, rail)
            nput(c, ox, oy, cx + 2, y, rail)
    nspan(c, ox, oy, cx - 1, cx + 1, 18, waist)
    nspan(c, ox, oy, cx - 2, cx + 2, 19, hip)
    nspan(c, ox, oy, cx - 2, cx + 2, 20, hip_d)
    x0 = cx - 1 + pose.rstep
    nspan(c, ox, oy, x0, x0 + 2, 21, leg)
    nput(c, ox, oy, x0 + 1, 22, hole)
    nspan(c, ox, oy, x0, x0 + 2, 23, leg)
    nspan(c, ox, oy, x0, x0 + 2, 24, shoe)
    nspan(c, ox, oy, x0, x0 + 2, 25, shoe)


def wrap_n(c: Pix, ox: int, oy: int, x: int, y: int) -> None:
    wrap_put(c, ox + x, oy + y)


def wrap_span(c: Pix, ox: int, oy: int, x0: int, x1: int, y: int) -> None:
    for x in range(x0, x1 + 1):
        wrap_n(c, ox, oy, x, y)


# ---------------------------------------------------------------------------
# Ninja
# ---------------------------------------------------------------------------
def ninja_south(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = NINJA
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["suit"], p["lite"], p["lite"])
    nspan(c, ox, oy, cx - 4, cx + 4, 9, TEAM)
    nspan(c, ox, oy, cx + 5, cx + 8, 8, TEAM)
    nspan(c, ox, oy, cx + 6, cx + 9, 9, TEAM)
    oval_face(c, ox, oy, cx, p["skin"], p["skin"])
    nput(c, ox, oy, cx - 2, 10, p["suit"])
    nput(c, ox, oy, cx + 2, 10, p["suit"])
    buttons(c, ox, oy, cx, 11, p["eye"])
    nspan(c, ox, oy, cx - 1, cx + 1, 13, p["skin"])
    shoulder_locks(c, ox, oy, cx, p["suit"], p["d"])
    chest_waist_hips(c, ox, oy, cx, p["suit"], p["d"], p["belt"], p["suit"], p["d"])
    fishnet_legs(c, ox, oy, cx, pose, p["suit"], p["lite"], p["d"])
    stick_arms(c, ox, oy, cx, pose, p["suit"], p["skin"])
    sx = 12 + pose.swing
    for y in range(8, 18 + abs(pose.swing)):
        nput(c, ox, oy, sx, y, p["blade"])
    nspan(c, ox, oy, sx - 1, sx + 1, 17, p["hilt"])
    nput(c, ox, oy, sx, 17, p["skin"])


def ninja_north(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = NINJA
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["suit"], p["lite"], p["lite"])
    nspan(c, ox, oy, cx - 4, cx + 4, 9, TEAM)
    nspan(c, ox, oy, cx - 9, cx - 6, 9, TEAM)
    shoulder_locks(c, ox, oy, cx, p["suit"], p["d"])
    chest_waist_hips(c, ox, oy, cx, p["suit"], p["d"], p["belt"], p["suit"], p["d"])
    fishnet_legs(c, ox, oy, cx, pose, p["suit"], p["lite"], p["d"])
    stick_arms(c, ox, oy, cx, pose, p["suit"], p["skin"])
    sx = 26 + pose.swing
    for y in range(8, 25):
        nput(c, ox, oy, sx, y, p["blade"])
    nspan(c, ox, oy, sx - 1, sx + 1, 17, p["hilt"])


def ninja_east(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = NINJA
    cx = 16
    east_helmet(c, ox, oy, cx, p["suit"], p["lite"])
    nspan(c, ox, oy, cx - 3, cx + 3, 9, TEAM)
    nspan(c, ox, oy, cx - 7, cx - 4, 9, TEAM)
    nspan(c, ox, oy, cx, cx + 2, 11, p["skin"])
    nspan(c, ox, oy, cx, cx + 2, 12, p["skin"])
    buttons(c, ox, oy, cx, 11, p["eye"], side=True)
    nput(c, ox, oy, cx + 1, 13, p["skin"])
    east_body(c, ox, oy, cx, pose, p["suit"], p["d"], p["belt"], p["suit"], p["d"], p["suit"], p["lite"], p["d"])
    ay = 16 + pose.arm
    nput(c, ox, oy, cx + 3, ay, p["suit"])
    nput(c, ox, oy, cx + 4, ay, p["skin"])
    sx = 22 + pose.swing
    nspan(c, ox, oy, sx, sx + 7, 16, p["blade"])
    nspan(c, ox, oy, sx, sx + 1, 17, p["hilt"])


def ninja(d: str, pose: Pose) -> Pix:
    c = Pix()
    ox, oy = OX + pose.lean, OY + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(16, 34, 16, 6, NINJA["suit"])
        c.fill(18, 32, 8, 3, TEAM)
        c.fill(30, 30, 10, 1, NINJA["blade"])
        return c
    if d == "west":
        return flip_west(ninja, d, pose)
    if d == "south":
        ninja_south(c, ox, oy, pose)
    elif d == "north":
        ninja_north(c, ox, oy, pose)
    else:
        ninja_east(c, ox, oy, pose)
    return c


# ---------------------------------------------------------------------------
# Cole
# ---------------------------------------------------------------------------
def cole_south(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = COLE
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["hair"], p["hair"], p["hood"])
    oval_face(c, ox, oy, cx, p["skin"], p["skin"])
    nput(c, ox, oy, cx - 2, 10, p["hair"])
    nput(c, ox, oy, cx, 10, p["skin"])
    nput(c, ox, oy, cx + 2, 10, p["hair"])
    buttons(c, ox, oy, cx, 11, p["eye"])
    shoulder_locks(c, ox, oy, cx, p["hood"], p["hoodD"])
    chest_waist_hips(c, ox, oy, cx, p["hood"], p["stripe"], p["shirt"], p["pants"], p["stripe"], p["shirt"])
    nspan(c, ox, oy, cx - 1, cx + 1, 16, p["shirt"])
    nspan(c, ox, oy, cx - 1, cx + 1, 17, p["shirt"])
    fishnet_legs(c, ox, oy, cx, pose, p["pants"], p["stripe"], p["stripe"])
    stick_arms(c, ox, oy, cx, pose, p["hood"], p["skin"])
    ay = 16 + pose.arm
    nput(c, ox, oy, cx - 7, ay - 2, p["bolt"])
    nput(c, ox, oy, cx + 5, ay - 2, p["bolt2"] if pose.bob else p["bolt"])


def cole_north(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = COLE
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["hood"], p["hoodD"], p["hair"])
    nspan(c, ox, oy, cx - 4, cx + 4, 8, p["hair"])
    nspan(c, ox, oy, cx - 5, cx + 5, 9, p["hair"])
    shoulder_locks(c, ox, oy, cx, p["hood"], p["hoodD"])
    chest_waist_hips(c, ox, oy, cx, p["hood"], p["stripe"], p["hoodD"], p["pants"], p["stripe"])
    fishnet_legs(c, ox, oy, cx, pose, p["pants"], p["stripe"], p["stripe"])
    stick_arms(c, ox, oy, cx, pose, p["hood"], p["skin"])


def cole_east(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = COLE
    cx = 16
    east_helmet(c, ox, oy, cx, p["hair"], p["hair"])
    nspan(c, ox, oy, cx, cx + 2, 10, p["skin"])
    nspan(c, ox, oy, cx, cx + 2, 11, p["skin"])
    nspan(c, ox, oy, cx, cx + 2, 12, p["skin"])
    nspan(c, ox, oy, cx, cx + 1, 13, p["skin"])
    buttons(c, ox, oy, cx, 11, p["eye"], side=True)
    east_body(c, ox, oy, cx, pose, p["hood"], p["stripe"], p["shirt"], p["pants"], p["stripe"], p["pants"], p["stripe"], p["stripe"])
    ay = 16 + pose.arm
    nput(c, ox, oy, cx + 3, ay, p["hood"])
    nput(c, ox, oy, cx + 4, ay, p["skin"])
    nput(c, ox, oy, cx + 5, ay - 2, p["bolt"])


def cole(d: str, pose: Pose) -> Pix:
    c = Pix()
    ox, oy = OX + pose.lean, OY + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(16, 34, 16, 6, COLE["hood"])
        c.fill(20, 30, 8, 5, COLE["skin"])
        return c
    if d == "west":
        return flip_west(cole, d, pose)
    if d == "south":
        cole_south(c, ox, oy, pose)
    elif d == "north":
        cole_north(c, ox, oy, pose)
    else:
        cole_east(c, ox, oy, pose)
    return c


# ---------------------------------------------------------------------------
# Death
# ---------------------------------------------------------------------------
def death_south(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = DEATH
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["wrap"], p["clothL"], p["cloth"])
    oval_face(c, ox, oy, cx, p["wrap"], p["cloth"])
    nspan(c, ox, oy, cx - 2, cx + 2, 10, p["cloth"])
    buttons(c, ox, oy, cx, 11, p["eye"])
    shoulder_locks(c, ox, oy, cx, p["cloth"], p["wrap"])
    chest_waist_hips(c, ox, oy, cx, p["cloth"], p["wrap"], p["clothL"], p["cloth"], p["wrap"])
    fishnet_legs(c, ox, oy, cx, pose, p["cloth"], p["clothL"], p["wrap"])
    stick_arms(c, ox, oy, cx, pose, p["cloth"], C(198, 134, 74))
    sx = 12 + pose.swing
    for i in range(10):
        nput(c, ox, oy, sx + i // 5, 16 - i, p["wood"] if i % 2 == 0 else p["woodD"])
    nput(c, ox, oy, sx, 7, p["spike"])
    nput(c, ox, oy, sx + 1, 8, p["spike"])
    nspan(c, ox, oy, cx - 5, cx - 2, 19, p["gun"])
    nput(c, ox, oy, cx - 6, 19, p["gun"])


def death_north(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = DEATH
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["wrap"], p["clothL"], p["cloth"])
    shoulder_locks(c, ox, oy, cx, p["cloth"], p["wrap"])
    chest_waist_hips(c, ox, oy, cx, p["cloth"], p["wrap"], p["clothL"], p["cloth"], p["wrap"])
    fishnet_legs(c, ox, oy, cx, pose, p["cloth"], p["clothL"], p["wrap"])
    stick_arms(c, ox, oy, cx, pose, p["cloth"], C(198, 134, 74))
    sx = 26 + pose.swing
    for y in range(8, 25):
        nput(c, ox, oy, sx, y, p["wood"] if y % 2 == 0 else p["woodD"])


def death_east(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = DEATH
    cx = 16
    east_helmet(c, ox, oy, cx, p["wrap"], p["clothL"])
    nspan(c, ox, oy, cx, cx + 2, 11, p["wrap"])
    nspan(c, ox, oy, cx, cx + 2, 12, p["wrap"])
    buttons(c, ox, oy, cx, 11, p["eye"], side=True)
    east_body(c, ox, oy, cx, pose, p["cloth"], p["wrap"], p["clothL"], p["cloth"], p["wrap"], p["cloth"], p["clothL"], p["wrap"])
    ay = 16 + pose.arm
    nput(c, ox, oy, cx + 3, ay, p["cloth"])
    sx = 22 + pose.swing
    for i in range(8):
        nput(c, ox, oy, sx + i // 2, 16 - i, p["wood"] if i % 2 == 0 else p["woodD"])
    nput(c, ox, oy, sx + 3, 8, p["spike"])
    nspan(c, ox, oy, cx - 3, cx, 19, p["gun"])


def death(d: str, pose: Pose) -> Pix:
    c = Pix()
    ox, oy = OX + pose.lean, OY + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(14, 34, 18, 7, DEATH["cloth"])
        c.fill(30, 30, 8, 2, DEATH["wood"])
        c.put(20, 36, DEATH["eye"])
        return c
    if d == "west":
        return flip_west(death, d, pose)
    if d == "south":
        death_south(c, ox, oy, pose)
    elif d == "north":
        death_north(c, ox, oy, pose)
    else:
        death_east(c, ox, oy, pose)
    return c


# ---------------------------------------------------------------------------
# Shadow — Witch anatomy, feminine
# ---------------------------------------------------------------------------
def shadow_south(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = SHADOW
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["hair"], p["hair"], p["hairL"])
    # round buns on the helmet, not a wide bar
    nput(c, ox, oy, cx - 6, 8, p["hair"])
    nspan(c, ox, oy, cx - 7, cx - 5, 9, p["hair"])
    nput(c, ox, oy, cx - 6, 10, p["hair"])
    nput(c, ox, oy, cx + 6, 8, p["hair"])
    nspan(c, ox, oy, cx + 5, cx + 7, 9, p["hair"])
    nput(c, ox, oy, cx + 6, 10, p["hair"])
    oval_face(c, ox, oy, cx, p["skin"], p["skinD"])
    nspan(c, ox, oy, cx - 2, cx + 1, 10, p["hair"])  # bangs
    buttons(c, ox, oy, cx, 11, p["eye"])
    nput(c, ox, oy, cx - 2, 13, p["blush"])
    nput(c, ox, oy, cx + 2, 13, p["blush"])
    shoulder_locks(c, ox, oy, cx, p["hair"], p["hair"])
    chest_waist_hips(c, ox, oy, cx, p["shirt"], p["hair"], p["skinD"], p["skirt"], p["hair"], p["hair"])
    fishnet_legs(c, ox, oy, cx, pose, p["skin"], p["skinD"], p["hair"])
    ay = 16 + pose.arm
    nput(c, ox, oy, cx - 6, ay, p["skin"])
    nput(c, ox, oy, cx - 5, ay, p["skin"])
    nput(c, ox, oy, cx - 4, ay, p["shirt"])
    nput(c, ox, oy, cx + 4, ay, p["shirt"])
    nput(c, ox, oy, cx + 4, ay + 1, p["skin"])
    hx, hy = 9 + pose.swing, 15 + pose.arm
    for dy in range(3):
        for dx in range(3):
            nput(c, ox, oy, hx + dx, hy + dy, p["claw"])
    nput(c, ox, oy, hx + 3, hy - 1, p["clawL"])
    nput(c, ox, oy, hx + 4, hy, p["clawL"])
    nput(c, ox, oy, hx + 3, hy + 1, p["clawL"])
    nput(c, ox, oy, hx + 2, hy - 2, p["clawL"])


def shadow_north(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = SHADOW
    cx = BODY_CX
    head_helmet(c, ox, oy, cx, p["hair"], p["hair"], p["hairL"])
    nput(c, ox, oy, cx - 6, 8, p["hair"])
    nspan(c, ox, oy, cx - 7, cx - 5, 9, p["hair"])
    nput(c, ox, oy, cx + 6, 8, p["hair"])
    nspan(c, ox, oy, cx + 5, cx + 7, 9, p["hair"])
    shoulder_locks(c, ox, oy, cx, p["hair"], p["hair"])
    chest_waist_hips(c, ox, oy, cx, p["shirt"], None, p["skirt"], p["skirt"], p["hair"])
    fishnet_legs(c, ox, oy, cx, pose, p["skin"], p["skinD"], p["hair"])
    stick_arms(c, ox, oy, cx, pose, p["shirt"], p["skin"])
    hx = 24
    for dy in range(3):
        for dx in range(3):
            nput(c, ox, oy, hx + dx, 16 + dy, p["claw"])


def shadow_east(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = SHADOW
    cx = 16
    east_helmet(c, ox, oy, cx, p["hair"], p["hair"])
    nput(c, ox, oy, cx + 4, 8, p["hair"])
    nspan(c, ox, oy, cx + 3, cx + 5, 9, p["hair"])
    nspan(c, ox, oy, cx, cx + 2, 10, p["skin"])
    nspan(c, ox, oy, cx, cx + 2, 11, p["skin"])
    nspan(c, ox, oy, cx, cx + 2, 12, p["skin"])
    nspan(c, ox, oy, cx, cx + 1, 13, p["skin"])
    buttons(c, ox, oy, cx, 11, p["eye"], side=True)
    nput(c, ox, oy, cx + 1, 13, p["blush"])
    east_body(c, ox, oy, cx, pose, p["shirt"], p["hair"], p["skinD"], p["skirt"], p["hair"], p["skin"], p["skinD"], p["hair"])
    ay = 16 + pose.arm
    nput(c, ox, oy, cx + 3, ay, p["shirt"])
    nput(c, ox, oy, cx + 4, ay, p["skin"])
    hx = 22 + pose.swing
    for dy in range(3):
        for dx in range(3):
            nput(c, ox, oy, hx + dx, 15 + dy, p["claw"])
    nput(c, ox, oy, hx + 3, 15, p["clawL"])
    nput(c, ox, oy, hx + 4, 16, p["clawL"])


def shadow(d: str, pose: Pose) -> Pix:
    c = Pix()
    ox, oy = OX + pose.lean, OY + pose.bob
    if d == "down" or pose.bob >= 6:
        c.fill(16, 34, 14, 6, SHADOW["hair"])
        c.fill(18, 38, 10, 4, SHADOW["skirt"])
        return c
    if d == "west":
        return flip_west(shadow, d, pose)
    if d == "south":
        shadow_south(c, ox, oy, pose)
    elif d == "north":
        shadow_north(c, ox, oy, pose)
    else:
        shadow_east(c, ox, oy, pose)
    return c


# ---------------------------------------------------------------------------
# Rope
# ---------------------------------------------------------------------------
def rope_helmet(c: Pix, ox: int, oy: int, cx: int) -> None:
    wrap_span(c, ox, oy, cx - 3, cx + 3, 8)
    wrap_n(c, ox, oy, cx - 4, 8)
    wrap_n(c, ox, oy, cx + 4, 8)
    wrap_span(c, ox, oy, cx - 4, cx + 4, 9)
    for y in range(10, 14):
        wrap_span(c, ox, oy, cx - 5, cx + 5, y)
    wrap_span(c, ox, oy, cx - 4, cx + 4, 14)


def rope_locks(c: Pix, ox: int, oy: int, cx: int) -> None:
    for y in range(14, 16):
        wrap_n(c, ox, oy, cx - 5, y)
        wrap_n(c, ox, oy, cx - 4, y)
        wrap_n(c, ox, oy, cx + 4, y)
        wrap_n(c, ox, oy, cx + 5, y)


def rope_torso(c: Pix, ox: int, oy: int, cx: int) -> None:
    for y in range(15, 18):
        wrap_span(c, ox, oy, cx - 3, cx + 3, y)
    wrap_span(c, ox, oy, cx - 2, cx + 2, 18)
    wrap_span(c, ox, oy, cx - 3, cx + 3, 19)
    wrap_span(c, ox, oy, cx - 3, cx + 3, 20)


def rope_legs(c: Pix, ox: int, oy: int, cx: int, pose: Pose) -> None:
    for dx, step in ((-3, pose.lstep), (1, pose.rstep)):
        x0 = cx + dx + step
        for y in range(21, 26):
            wrap_span(c, ox, oy, x0, x0 + 2, y)


def rope_arms(c: Pix, ox: int, oy: int, cx: int, pose: Pose) -> None:
    ay = 16 + pose.arm
    wrap_n(c, ox, oy, cx - 6, ay)
    wrap_n(c, ox, oy, cx - 5, ay)
    wrap_n(c, ox, oy, cx - 4, ay)
    wrap_n(c, ox, oy, cx + 4, ay)
    wrap_n(c, ox, oy, cx + 4, ay + 1)
    wrap_n(c, ox, oy, cx + 5, ay)


def rope_south(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = ROPE
    cx = BODY_CX
    rope_helmet(c, ox, oy, cx)
    nspan(c, ox, oy, cx - 2, cx + 2, 10, p["rd"])
    for y in range(11, 14):
        nspan(c, ox, oy, cx - 2, cx + 2, y, p["rd"])
    buttons(c, ox, oy, cx, 11, p["eye"])
    rope_locks(c, ox, oy, cx)
    rope_torso(c, ox, oy, cx)
    nspan(c, ox, oy, cx - 2, cx + 2, 18, p["rl"])
    rope_legs(c, ox, oy, cx, pose)
    rope_arms(c, ox, oy, cx, pose)


def rope_north(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    cx = BODY_CX
    rope_helmet(c, ox, oy, cx)
    rope_locks(c, ox, oy, cx)
    rope_torso(c, ox, oy, cx)
    rope_legs(c, ox, oy, cx, pose)
    rope_arms(c, ox, oy, cx, pose)


def rope_east(c: Pix, ox: int, oy: int, pose: Pose) -> None:
    p = ROPE
    cx = 16
    wrap_span(c, ox, oy, cx - 2, cx + 2, 8)
    wrap_n(c, ox, oy, cx - 3, 8)
    wrap_n(c, ox, oy, cx + 3, 8)
    for y in range(9, 14):
        wrap_span(c, ox, oy, cx - 3, cx + 3, y)
    wrap_span(c, ox, oy, cx - 2, cx + 2, 14)
    for y in range(12, 16):
        wrap_n(c, ox, oy, cx - 4, y)
        wrap_n(c, ox, oy, cx - 3, y)
    nspan(c, ox, oy, cx, cx + 2, 11, p["rd"])
    nspan(c, ox, oy, cx, cx + 2, 12, p["rd"])
    buttons(c, ox, oy, cx, 11, p["eye"], side=True)
    for y in range(15, 18):
        wrap_span(c, ox, oy, cx - 2, cx + 2, y)
    wrap_span(c, ox, oy, cx - 1, cx + 1, 18)
    wrap_span(c, ox, oy, cx - 2, cx + 2, 19)
    wrap_span(c, ox, oy, cx - 2, cx + 2, 20)
    x0 = cx - 1 + pose.rstep
    for y in range(21, 26):
        wrap_span(c, ox, oy, x0, x0 + 2, y)
    ay = 16 + pose.arm
    wrap_n(c, ox, oy, cx + 3, ay)
    wrap_n(c, ox, oy, cx + 4, ay)


def rope(d: str, pose: Pose) -> Pix:
    c = Pix()
    ox, oy = OX + pose.lean, OY + pose.bob
    if d == "down" or pose.bob >= 6:
        wrap_fill(c, 16, 34, 16, 6)
        c.fill(22, 32, 3, 2, ROPE["eye"])
        return c
    if d == "west":
        return flip_west(rope, d, pose)
    if d == "south":
        rope_south(c, ox, oy, pose)
    elif d == "north":
        rope_north(c, ox, oy, pose)
    else:
        rope_east(c, ox, oy, pose)
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
        for col, name in enumerate(COLS):
            facing = "down" if name == "down" else d
            fr = draw(facing, pose_for(name)).image()
            img.paste(fr, (col * FRAME, ry * FRAME), fr)
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


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    PORT_DIR.mkdir(parents=True, exist_ok=True)
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



