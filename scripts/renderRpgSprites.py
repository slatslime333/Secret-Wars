#!/usr/bin/env python3
"""Compact RPG battle sprites for all six playable heroes.

Style reference: the approved-construction Witch south idle (32x32 compact
RPG sprite — round-ish hair helmet, stubby clothes, few face pixels, limited
shading). Not the illustrated portrait and not the oversized balloon-head pass.

48x48 frames, 10 poses x 4 directions. Ninja bandana is magenta chroma.
Witch portrait is left untouched (detailed card art).
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
COLS = ("idle0", "idle1", "walk0", "walk1", "walk2", "atk0", "atk1", "atk2", "hurt", "down")
ROWS = ("south", "north", "east", "west")
TEAM = (255, 0, 255, 255)  # ninja bandana chroma
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

    def disc(self, cx: int, cy: int, r: int, c: Color) -> None:
        r2 = r * r
        for yy in range(cy - r, cy + r + 1):
            for xx in range(cx - r, cx + r + 1):
                if (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r2:
                    self.put(xx, yy, c)

    def image(self) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h), TRANSP)
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                px[x, y] = self.p[y][x]
        return im


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
        "walk0": Pose(lstep=2, rstep=-2, arm=-1, bob=-1),
        "walk1": Pose(),
        "walk2": Pose(lstep=-2, rstep=2, arm=1, bob=-1),
        "atk0": Pose(lean=-1, arm=-2, swing=-3, bob=-1),
        "atk1": Pose(lean=1, arm=2, swing=4, bob=1),
        "atk2": Pose(lean=1, arm=1, swing=2),
        "hurt": Pose(lean=-2, arm=-2, bob=1),
        "down": Pose(bob=6, lean=3),
    }[name]


# --- palettes (local darks, not a global black outline) ---
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
    "eye": C(36, 24, 32), "claw": C(52, 24, 80), "clawL": C(110, 70, 150),
}
ROPE = {
    "r": C(148, 102, 52), "rd": C(98, 64, 28), "rl": C(196, 154, 88),
    "eye": C(255, 220, 70), "ink": C(16, 12, 16),
}


def wrap_fill(c: Pix, x: int, y: int, w: int, h: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            c.put(xx, yy, ROPE["rd"] if (xx + yy) % 2 == 0 else ROPE["r"])


def staff(c: Pix, sx: int, y0: int, y1: int, skull_y: int, p: dict[str, Color] = WITCH) -> None:
    c.fill(sx - 1, skull_y, 3, 3, p["x"])
    c.put(sx - 1, skull_y + 1, p["z"])
    c.put(sx + 1, skull_y + 1, p["z"])
    for y in range(y0, y1):
        c.put(sx, y, p["y"] if y % 3 else p["v"])


# ---------------------------------------------------------------------------
# Witch — compact construction from the preferred south idle
# ---------------------------------------------------------------------------
def witch(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = WITCH
    cx, fy = 28 + pose.lean, 42 + pose.bob
    if d == "down":
        c.fill(18, 32, 16, 8, p["a"])
        c.fill(20, 38, 12, 6, p["r"])
        c.fill(14, 24, 8, 8, p["h"])
        staff(c, 34, 30, 42, 24)
        return c

    hy = fy - 27  # hat tip
    # legs
    if d in ("south", "north"):
        for i, step in ((-3, pose.lstep), (1, pose.rstep)):
            x0 = cx + i + step
            c.fill(x0, fy - 5, 3, 4, p["f"])
            c.put(x0 + 1, fy - 4, p["j"])
            c.put(x0 + 1, fy - 2, p["j"])
            c.fill(x0, fy - 1, 3, 2, p["o"])
    else:
        step = pose.rstep if d == "east" else pose.lstep
        x0 = cx - 1 + step
        c.fill(x0, fy - 5, 3, 4, p["f"])
        c.put(x0 + 1, fy - 4, p["j"])
        c.fill(x0, fy - 1, 3, 2, p["o"])

    # skirt, midriff, gothic corset — all below the head
    c.fill(cx - 4, fy - 8, 9, 2, p["m"])
    c.fill(cx - 4, fy - 9, 9, 1, p["r"])
    if d == "south":
        c.fill(cx - 3, fy - 10, 7, 1, p["s"])
    c.fill(cx - 4, fy - 14, 9, 4, p["c"])
    c.put(cx - 4, fy - 13, p["t"])
    c.put(cx + 4, fy - 13, p["t"])
    c.put(cx, fy - 12, p["p"])
    c.put(cx, fy - 11, p["t"])
    if d == "north":
        c.fill(cx - 4, fy - 14, 9, 5, p["a"])  # hair covers the back of the top
        c.fill(cx - 4, fy - 9, 9, 3, p["r"])

    # hat
    c.put(cx, hy, p["d"])
    c.fill(cx - 1, hy + 1, 3, 2, p["h"])
    c.fill(cx - 2, hy + 3, 5, 1, p["h"])
    c.fill(cx - 3, hy + 4, 7, 1, p["h"])
    c.fill(cx - 4, hy + 5, 9, 1, p["b"])
    c.fill(cx - 4, hy + 6, 9, 1, p["n"])
    brim_w = 13 if d in ("south", "north") else 11
    c.fill(cx - brim_w // 2, hy + 7, brim_w, 1, p["h"])
    c.put(cx - brim_w // 2, hy + 7, p["d"])
    c.put(cx + brim_w // 2 - 1, hy + 7, p["d"])
    if d != "west":
        c.put(cx + brim_w // 2, hy + 8, p["g"])

    # hair + face sit under the brim, above the corset (hy+8 .. fy-14)
    if d == "south":
        c.fill(cx - 5, hy + 8, 11, 7, p["a"])
        c.put(cx - 5, hy + 8, p["k"])
        c.put(cx + 5, hy + 8, p["k"])
        c.fill(cx - 4, hy + 8, 9, 1, p["i"])
        c.fill(cx - 3, hy + 9, 7, 1, p["a"])  # bangs
        c.fill(cx - 4, hy + 10, 9, 4, p["s"])
        c.put(cx - 3, hy + 10, p["w"])
        c.put(cx - 2, hy + 10, p["e"])
        c.put(cx + 1, hy + 10, p["w"])
        c.put(cx + 2, hy + 10, p["e"])
        c.put(cx - 3, hy + 12, p["u"])
        c.put(cx + 2, hy + 12, p["u"])
        c.put(cx, hy + 13, p["q"])
        c.fill(cx - 5, hy + 14, 2, 2, p["k"])
        c.fill(cx + 4, hy + 14, 2, 2, p["k"])
        c.put(cx - 6, hy + 11, p["g"])
        c.put(cx + 5, hy + 11, p["g"])
    elif d == "north":
        c.fill(cx - 5, hy + 8, 11, 8, p["a"])
        c.fill(cx - 4, hy + 8, 9, 2, p["i"])
        c.fill(cx - 5, hy + 14, 2, 3, p["k"])
        c.fill(cx + 4, hy + 14, 2, 3, p["k"])
    elif d == "east":
        c.fill(cx - 2, hy + 8, 7, 7, p["a"])
        c.fill(cx - 1, hy + 10, 4, 4, p["s"])
        c.put(cx + 2, hy + 11, p["w"])
        c.put(cx + 3, hy + 11, p["e"])
        c.put(cx + 2, hy + 13, p["u"])
        c.fill(cx + 3, hy + 12, 3, 5, p["a"])
        c.put(cx + 4, hy + 11, p["g"])
        c.fill(cx - 1, fy - 14, 5, 4, p["c"])  # thinner side corset
        c.fill(cx - 2, fy - 9, 6, 2, p["r"])
    else:
        c.fill(cx - 4, hy + 8, 7, 7, p["a"])
        c.fill(cx - 2, hy + 10, 4, 4, p["s"])
        c.put(cx - 2, hy + 11, p["e"])
        c.put(cx - 1, hy + 11, p["w"])
        c.put(cx - 1, hy + 13, p["u"])
        c.fill(cx - 5, hy + 12, 3, 5, p["a"])
        c.put(cx - 4, hy + 11, p["g"])
        c.fill(cx - 3, fy - 14, 5, 4, p["c"])
        c.fill(cx - 3, fy - 9, 6, 2, p["r"])

    # staff + arms
    swing = pose.swing
    if d == "south":
        sx = cx - 9
        staff(c, sx, hy + 10, fy, hy + 4)
        c.fill(sx, fy - 13 + pose.arm, 4, 2, p["s"])  # hand on pole
        c.put(cx + 5, fy - 12, p["s"])
        c.put(cx + 5, fy - 11, p["q"])
    elif d == "north":
        sx = cx + 8
        staff(c, sx, hy + 10, fy, hy + 4)
        c.fill(sx - 2, fy - 13 + pose.arm, 3, 2, p["s"])
    elif d == "east":
        sx = cx + 7 + swing
        staff(c, sx, hy + 9, fy, hy + 3)
        c.fill(cx + 3, fy - 13 + pose.arm, 4, 2, p["s"])
    else:
        sx = cx - 7 - swing
        staff(c, sx, hy + 9, fy, hy + 3)
        c.fill(cx - 6, fy - 13 + pose.arm, 4, 2, p["s"])
    return c


# ---------------------------------------------------------------------------
# Other heroes — same compact proportions
# ---------------------------------------------------------------------------
def ninja(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = NINJA
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down":
        c.fill(14, 32, 18, 8, p["suit"])
        c.fill(16, 30, 8, 4, TEAM)
        c.fill(28, 28, 12, 2, p["blade"])
        return c
    # legs
    if d in ("south", "north"):
        c.fill(cx - 4 + pose.lstep, fy - 6, 3, 6, p["suit"])
        c.fill(cx + 1 + pose.rstep, fy - 6, 3, 6, p["suit"])
        c.fill(cx - 4 + pose.lstep, fy - 1, 3, 2, p["d"])
        c.fill(cx + 1 + pose.rstep, fy - 1, 3, 2, p["d"])
    else:
        step = pose.rstep if d == "east" else pose.lstep
        c.fill(cx - 1 + step, fy - 6, 3, 6, p["suit"])
        c.fill(cx - 1 + step, fy - 1, 3, 2, p["d"])
    # torso
    c.fill(cx - 5, fy - 14, 11, 8, p["suit"])
    c.fill(cx - 4, fy - 13, 9, 2, p["lite"])
    hy = fy - 24
    c.fill(cx - 5, hy, 11, 10, p["suit"])
    c.fill(cx - 4, hy + 1, 9, 2, p["lite"])
    c.fill(cx - 5, hy + 3, 11, 2, TEAM)
    if d == "south":
        c.fill(cx + 6, hy + 2, 4, 2, TEAM)
        c.fill(cx + 9, hy + 1, 3, 2, TEAM)
        c.fill(cx - 3, hy + 6, 2, 2, p["eye"])
        c.fill(cx + 1, hy + 6, 2, 2, p["eye"])
        c.fill(cx - 2, hy + 8, 5, 1, p["skin"])
        c.put(cx - 6, fy - 12 + pose.arm, p["skin"])
        c.put(cx + 6, fy - 12, p["skin"])
        # katana on right hip / swing
        hx, hy2 = cx + 6, fy - 12 + pose.arm
        c.fill(hx, hy2 - 8 - pose.swing, 1, 10 + abs(pose.swing), p["blade"])
        c.fill(hx - 1, hy2, 3, 2, p["hilt"])
    elif d == "north":
        c.fill(cx - 9, hy + 2, 4, 2, TEAM)
        c.fill(cx - 5, hy, 11, 10, p["suit"])
        c.fill(cx - 5, hy + 3, 11, 2, TEAM)
        c.fill(cx - 7, fy - 18, 1, 12, p["blade"])
    elif d == "east":
        c.fill(cx - 8, hy + 2, 4, 2, TEAM)
        c.put(cx + 2, hy + 6, p["eye"])
        c.put(cx + 2, hy + 7, p["eye"])
        c.fill(cx + 1, hy + 8, 2, 1, p["skin"])
        hx = cx + 6 + pose.swing
        c.fill(hx, fy - 14, 8, 1, p["blade"])
        c.fill(hx, fy - 13, 2, 2, p["hilt"])
        c.put(cx + 5, fy - 12, p["skin"])
    else:
        c.fill(cx + 5, hy + 2, 4, 2, TEAM)
        c.put(cx - 2, hy + 6, p["eye"])
        c.put(cx - 2, hy + 7, p["eye"])
        c.fill(cx - 2, hy + 8, 2, 1, p["skin"])
        hx = cx - 13 - pose.swing
        c.fill(hx, fy - 14, 8, 1, p["blade"])
        c.fill(cx - 6, fy - 13, 2, 2, p["hilt"])
        c.put(cx - 5, fy - 12, p["skin"])
    return c


def cole(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = COLE
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down":
        c.fill(14, 32, 20, 8, p["hood"])
        c.fill(18, 28, 10, 6, p["skin"])
        return c
    if d in ("south", "north"):
        c.fill(cx - 4 + pose.lstep, fy - 6, 3, 6, p["pants"])
        c.fill(cx + 1 + pose.rstep, fy - 6, 3, 6, p["pants"])
        c.fill(cx - 4 + pose.lstep, fy - 1, 3, 2, p["stripe"])
        c.fill(cx + 1 + pose.rstep, fy - 1, 3, 2, p["stripe"])
    else:
        step = pose.rstep if d == "east" else pose.lstep
        c.fill(cx - 1 + step, fy - 6, 3, 6, p["pants"])
        c.fill(cx - 1 + step, fy - 1, 3, 2, p["stripe"])
    c.fill(cx - 6, fy - 15, 13, 9, p["hood"])
    c.fill(cx - 6, fy - 12, 1, 6, p["stripe"])
    c.fill(cx + 6, fy - 12, 1, 6, p["stripe"])
    c.fill(cx - 2, fy - 13, 5, 7, p["shirt"])
    hy = fy - 24
    c.fill(cx - 6, hy, 13, 9, p["hood"])  # hood
    c.fill(cx - 4, hy + 3, 9, 6, p["skin"])
    c.fill(cx - 4, hy, 9, 4, p["hair"])
    if d == "south":
        c.fill(cx - 3, hy + 5, 2, 2, p["eye"])
        c.fill(cx + 1, hy + 5, 2, 2, p["eye"])
        c.put(cx - 7, fy - 12 + pose.arm, p["skin"])
        c.put(cx + 7, fy - 12, p["skin"])
        c.put(cx - 7, fy - 14 + pose.arm, p["bolt"])
        c.put(cx + 8, fy - 14, p["bolt2"] if pose.bob else p["bolt"])
    elif d == "north":
        c.fill(cx - 6, hy, 13, 10, p["hood"])
        c.put(cx - 7, fy - 14, p["bolt"])
        c.put(cx + 7, fy - 14, p["bolt"])
    elif d == "east":
        c.put(cx + 2, hy + 5, p["eye"])
        c.put(cx + 7, fy - 12, p["skin"])
        c.put(cx + 8, fy - 14 + pose.swing // 2, p["bolt"])
    else:
        c.put(cx - 2, hy + 5, p["eye"])
        c.put(cx - 7, fy - 12, p["skin"])
        c.put(cx - 8, fy - 14 + pose.swing // 2, p["bolt"])
    return c


def death(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = DEATH
    cx, fy = 24 + pose.lean, 42 + pose.bob
    if d == "down":
        c.fill(12, 32, 22, 10, p["cloth"])
        c.fill(30, 28, 10, 3, p["wood"])
        c.put(20, 34, p["eye"])
        return c
    if d in ("south", "north"):
        c.fill(cx - 5 + pose.lstep, fy - 7, 4, 7, p["cloth"])
        c.fill(cx + 1 + pose.rstep, fy - 7, 4, 7, p["cloth"])
        c.fill(cx - 5 + pose.lstep, fy - 1, 4, 2, p["wrap"])
        c.fill(cx + 1 + pose.rstep, fy - 1, 4, 2, p["wrap"])
    else:
        step = pose.rstep if d == "east" else pose.lstep
        c.fill(cx - 2 + step, fy - 7, 4, 7, p["cloth"])
        c.fill(cx - 2 + step, fy - 1, 4, 2, p["wrap"])
    c.fill(cx - 6, fy - 16, 13, 9, p["cloth"])
    c.fill(cx - 5, fy - 14, 11, 2, p["clothL"])
    hy = fy - 26
    c.fill(cx - 6, hy, 13, 11, p["wrap"])
    c.fill(cx - 5, hy + 2, 11, 3, p["cloth"])
    if d != "north":
        c.fill(cx - 3, hy + 6, 2, 2, p["eye"])
        c.fill(cx + 1, hy + 6, 2, 2, p["eye"])
    # bat
    east = d in ("south", "east")
    hx = (cx + 7 + pose.swing) if east else (cx - 8 - pose.swing)
    hy2 = fy - 14 + pose.arm
    dirx = 1 if east else -1
    for i in range(10):
        c.put(hx + dirx * (i // 2), hy2 - i, p["wood"] if i % 2 == 0 else p["woodD"])
    c.put(hx + dirx * 2, hy2 - 10, p["spike"])
    c.put(hx + dirx * 3, hy2 - 9, p["spike"])
    # hip uzi
    gx = cx - 4 if east else cx + 2
    c.fill(gx, fy - 11, 5, 3, p["gun"])
    return c


def shadow(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = SHADOW
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down":
        c.fill(16, 32, 16, 8, p["hair"])
        c.fill(18, 36, 12, 6, p["skirt"])
        return c
    if d in ("south", "north"):
        c.fill(cx - 3 + pose.lstep, fy - 5, 3, 4, p["skin"])
        c.fill(cx + 1 + pose.rstep, fy - 5, 3, 4, p["skin"])
        c.fill(cx - 3 + pose.lstep, fy - 1, 3, 2, p["hair"])
        c.fill(cx + 1 + pose.rstep, fy - 1, 3, 2, p["hair"])
    else:
        step = pose.rstep if d == "east" else pose.lstep
        c.fill(cx - 1 + step, fy - 5, 3, 4, p["skin"])
        c.fill(cx - 1 + step, fy - 1, 3, 2, p["hair"])
    c.fill(cx - 4, fy - 9, 9, 4, p["skirt"])
    c.fill(cx - 4, fy - 14, 9, 5, p["shirt"])
    hy = fy - 24
    # buns + helmet hair
    c.disc(cx - 5, hy + 2, 2, p["hair"])
    c.disc(cx + 5, hy + 2, 2, p["hair"])
    c.fill(cx - 5, hy, 11, 8, p["hair"])
    if d == "south":
        c.fill(cx - 3, hy + 4, 7, 5, p["skin"])
        c.fill(cx - 4, hy + 3, 5, 4, p["hair"])  # bangs cover left
        c.put(cx + 1, hy + 6, p["eye"])
        c.fill(cx - 5, hy + 10, 2, 4, p["hair"])
        c.fill(cx + 4, hy + 10, 2, 4, p["hair"])
        c.put(cx - 6, fy - 12, p["skin"])  # left hand
        # claw on her right = viewer's right
        hx, hy2 = cx + 7, fy - 12 + pose.arm
        c.disc(hx, hy2, 3, p["claw"])
        c.put(hx + 2, hy2 - 2, p["clawL"])
        c.put(hx + 3, hy2, p["clawL"])
        c.put(hx + 2, hy2 + 2, p["clawL"])
    elif d == "north":
        c.fill(cx - 5, hy, 11, 12, p["hair"])
        c.disc(cx - 5, hy + 2, 2, p["hair"])
        c.disc(cx + 5, hy + 2, 2, p["hair"])
        c.disc(cx - 7, fy - 12, 3, p["claw"])
    elif d == "east":
        c.fill(cx - 2, hy + 4, 5, 5, p["skin"])
        c.put(cx + 2, hy + 6, p["eye"])
        c.fill(cx + 3, hy + 8, 3, 5, p["hair"])
        c.disc(cx + 6, hy + 2, 2, p["hair"])
        hx = cx + 7 + pose.swing
        c.disc(hx, fy - 12, 3, p["claw"])
        c.put(hx + 3, fy - 13, p["clawL"])
        c.put(hx + 3, fy - 11, p["clawL"])
    else:
        c.fill(cx - 2, hy + 4, 5, 5, p["skin"])
        c.put(cx - 2, hy + 6, p["eye"])
        c.fill(cx - 5, hy + 8, 3, 5, p["hair"])
        c.disc(cx - 6, hy + 2, 2, p["hair"])
        hx = cx - 7 - pose.swing
        c.disc(hx, fy - 12, 3, p["claw"])
        c.put(hx - 3, fy - 13, p["clawL"])
    return c


def rope(d: str, pose: Pose) -> Pix:
    c = Pix()
    p = ROPE
    cx, fy = 24 + pose.lean, 41 + pose.bob
    if d == "down":
        wrap_fill(c, 14, 32, 20, 8)
        c.fill(22, 30, 3, 3, p["eye"])
        return c
    if d in ("south", "north"):
        wrap_fill(c, cx - 4 + pose.lstep, fy - 6, 3, 6)
        wrap_fill(c, cx + 1 + pose.rstep, fy - 6, 3, 6)
    else:
        step = pose.rstep if d == "east" else pose.lstep
        wrap_fill(c, cx - 1 + step, fy - 6, 3, 6)
    wrap_fill(c, cx - 5, fy - 15, 11, 9)
    hy = fy - 24
    wrap_fill(c, cx - 5, hy, 11, 10)
    if d != "north":
        # yellow triangle eyes
        c.put(cx - 3, hy + 5, p["eye"])
        c.put(cx - 2, hy + 5, p["eye"])
        c.put(cx - 2, hy + 6, p["eye"])
        c.put(cx + 1, hy + 5, p["eye"])
        c.put(cx + 2, hy + 5, p["eye"])
        c.put(cx + 1, hy + 6, p["eye"])
        c.put(cx - 2, hy + 5, p["ink"])
        c.put(cx + 2, hy + 5, p["ink"])
    wrap_fill(c, cx - 7, fy - 13 + pose.arm, 2, 4)
    wrap_fill(c, cx + 6, fy - 13, 2, 4)
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
    """128x128 card close-up from the south idle, same pixel language."""
    idle = DRAW[hero]("south", Pose()).image()
    # crop the upper body
    bbox = idle.getbbox()
    if not bbox:
        return Image.new("RGBA", (PORTRAIT, PORTRAIT), (20, 16, 24, 255))
    x0, y0, x1, y1 = bbox
    head = idle.crop((max(0, x0 - 2), max(0, y0 - 2), min(FRAME, x1 + 2), min(FRAME, y0 + 22)))
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


def roster_preview(sheets: dict[str, Image.Image]) -> Image.Image:
    order = ("ninja", "cole", "death", "rope", "witch", "shadow")
    cell = FRAME * 4
    img = Image.new("RGBA", (cell * 4, cell * 6), (18, 14, 24, 255))
    pink = (255, 228, 236, 255)
    for i, hero in enumerate(order):
        sheet = sheets[hero]
        for d, col in enumerate(ROWS):
            frame = sheet.crop((0, d * FRAME, FRAME, d * FRAME + FRAME))
            bg = Image.new("RGBA", (FRAME, FRAME), pink)
            bg.alpha_composite(frame)
            img.paste(bg.resize((cell, cell), Image.Resampling.NEAREST), (d * cell, i * cell))
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

    # keep a standalone south idle for the Witch
    south = DRAW["witch"]("south", Pose()).image()
    (CHAR_DIR / "witch" / "south-idle.png").parent.mkdir(parents=True, exist_ok=True)
    south.save(CHAR_DIR / "witch" / "south-idle.png")

    roster_preview(sheets).save(PREVIEW / "roster_dirs_x4.png")
    # witch four directions at 8x on pink
    pink = (255, 228, 236, 255)
    strip = Image.new("RGBA", (FRAME * 8 * 4, FRAME * 8), pink)
    for i, d in enumerate(ROWS):
        fr = DRAW["witch"](d, Pose()).image()
        bg = Image.new("RGBA", (FRAME, FRAME), pink)
        bg.alpha_composite(fr)
        strip.paste(bg.resize((FRAME * 8, FRAME * 8), Image.Resampling.NEAREST), (i * FRAME * 8, 0))
    strip.save(PREVIEW / "witch_dirs_x8.png")
    # south idle 8x
    bg = Image.new("RGBA", (FRAME, FRAME), pink)
    bg.alpha_composite(south)
    bg.resize((FRAME * 8, FRAME * 8), Image.Resampling.NEAREST).save(PREVIEW / "witch_south_x8.png")


if __name__ == "__main__":
    main()
