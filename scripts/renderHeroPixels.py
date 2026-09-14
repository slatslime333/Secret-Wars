#!/usr/bin/env python3
"""Render in-game hero sheets and portraits as real pixel art.

64x64 sheets, 10 poses x 4 directions. Magenta (255,0,255) is the ninja
team-bandana chroma. Portraits are 128x128 close-ups of the same designs.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHAR_DIR = ROOT / "assets" / "characters"
PORT_DIR = ROOT / "assets" / "portraits"

FRAME = 64
PORTRAIT = 128
COLS = ("idle0", "idle1", "walk0", "walk1", "walk2", "atk0", "atk1", "atk2", "hurt", "down")
ROWS = ("south", "north", "east", "west")
TEAM = (255, 0, 255, 255)
INK = (22, 16, 28, 255)
GROUND = (12, 10, 18, 70)

Color = tuple[int, int, int, int]


def rgb(r: int, g: int, b: int, a: int = 255) -> Color:
    return (r, g, b, a)


def mix(a: Color, b: Color, t: float) -> Color:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))  # type: ignore[return-value]


class Pix:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h
        self.p: list[list[Color | None]] = [[None] * w for _ in range(h)]

    def set(self, x: int, y: int, c: Color | None) -> None:
        if c is None or x < 0 or y < 0 or x >= self.w or y >= self.h:
            return
        self.p[y][x] = c

    def get(self, x: int, y: int) -> Color | None:
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return None
        return self.p[y][x]

    def fill(self, x: int, y: int, w: int, h: int, c: Color) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def disc(self, cx: int, cy: int, r: int, c: Color) -> None:
        r2 = r * r
        for yy in range(cy - r, cy + r + 1):
            for xx in range(cx - r, cx + r + 1):
                if (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r2:
                    self.set(xx, yy, c)

    def oval(self, cx: int, cy: int, rx: int, ry: int, c: Color) -> None:
        for yy in range(cy - ry, cy + ry + 1):
            for xx in range(cx - rx, cx + rx + 1):
                if ry == 0 or rx == 0:
                    continue
                if ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1:
                    self.set(xx, yy, c)

    def line(self, x0: int, y0: int, x1: int, y1: int, c: Color, w: int = 1) -> None:
        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        x, y = x0, y0
        while True:
            if w <= 1:
                self.set(x, y, c)
            else:
                self.disc(x, y, w // 2, c)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x += sx
            if e2 < dx:
                err += dx
                y += sy

    def outline(self, ink: Color = INK) -> None:
        marks: list[tuple[int, int]] = []
        for y in range(self.h):
            for x in range(self.w):
                if self.p[y][x] is not None:
                    continue
                hit = False
                for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    n = self.get(x + ox, y + oy)
                    if n is not None and n != ink:
                        hit = True
                        break
                if hit:
                    marks.append((x, y))
        for x, y in marks:
            self.set(x, y, ink)

    def image(self) -> Image.Image:
        im = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                c = self.p[y][x]
                if c:
                    px[x, y] = c
        return im


@dataclass
class Pose:
    bob: int = 0
    lean: int = 0
    lstep: int = 0
    rstep: int = 0
    larm: int = 0
    rarm: int = 0
    swing: int = 0
    pulse: int = 0


def pose_for(name: str, hero: str) -> Pose:
    if name == "idle0":
        return Pose()
    if name == "idle1":
        return Pose(bob=-1, pulse=1, larm=-1, rarm=1)
    extra = 1 if hero in ("witch", "shadow") else 0
    if name == "walk0":
        return Pose(lstep=4 + extra, rstep=-3, larm=-3 - extra, rarm=4, bob=-1)
    if name == "walk1":
        return Pose(lstep=0, rstep=0, larm=0, rarm=0)
    if name == "walk2":
        return Pose(lstep=-3, rstep=4 + extra, larm=4, rarm=-3 - extra, bob=-1)
    if name == "atk0":
        return Pose(lean=-2, rarm=-6, larm=3, swing=-8, bob=-1)
    if name == "atk1":
        return Pose(lean=3, rarm=7, larm=-4, swing=10, bob=1)
    if name == "atk2":
        return Pose(lean=1, rarm=3, larm=-2, swing=4)
    if name == "hurt":
        return Pose(lean=-2, larm=-3, rarm=-3, bob=1)
    if name == "down":
        return Pose(bob=8, lean=4)
    return Pose()


def ground(c: Pix, cx: int, cy: int, wide: int = 10) -> None:
    c.oval(cx, cy, wide, 3, GROUND)


def limb(c: Pix, x0: int, y0: int, x1: int, y1: int, col: Color, thick: int = 2) -> None:
    c.line(x0, y0, x1, y1, col, thick)


# --- palettes ---
NINJA = {
    "suit": rgb(16, 16, 22),
    "lite": rgb(36, 36, 48),
    "mid": rgb(24, 24, 34),
    "skin": rgb(198, 134, 74),
    "skinD": rgb(154, 96, 48),
    "eye": rgb(255, 48, 48),
    "glow": rgb(255, 120, 90),
    "blade": rgb(214, 220, 228),
    "hilt": rgb(70, 48, 28),
}
COLE = {
    "hood": rgb(232, 176, 28),
    "hoodD": rgb(168, 120, 16),
    "stripe": rgb(18, 18, 24),
    "shirt": rgb(244, 240, 224),
    "pants": rgb(20, 20, 28),
    "skin": rgb(198, 134, 84),
    "skinD": rgb(154, 96, 54),
    "hair": rgb(58, 36, 20),
    "eye": rgb(32, 18, 16),
    "bolt": rgb(120, 240, 255),
    "bolt2": rgb(255, 244, 120),
}
DEATH = {
    "cloth": rgb(14, 14, 18),
    "clothL": rgb(36, 36, 44),
    "wrap": rgb(10, 10, 14),
    "eye": rgb(255, 36, 36),
    "glow": rgb(255, 90, 70),
    "wood": rgb(86, 54, 28),
    "woodD": rgb(54, 32, 16),
    "spike": rgb(168, 168, 176),
    "gun": rgb(40, 40, 48),
    "gunL": rgb(72, 72, 82),
}
WITCH = {
    "skin": rgb(200, 160, 232),
    "skinD": rgb(160, 112, 196),
    "hair": rgb(58, 18, 96),
    "hairL": rgb(92, 36, 140),
    "top": rgb(244, 130, 176),
    "topD": rgb(196, 84, 132),
    "skirt": rgb(92, 36, 140),
    "net": rgb(236, 224, 240),
    "wood": rgb(138, 90, 40),
    "skull": rgb(232, 220, 200),
    "eye": rgb(40, 16, 56),
    "lip": rgb(180, 70, 110),
}
SHADOW = {
    "skin": rgb(240, 200, 176),
    "skinD": rgb(196, 150, 128),
    "hair": rgb(16, 16, 22),
    "hairL": rgb(42, 42, 52),
    "shirt": rgb(246, 246, 242),
    "skirt": rgb(18, 18, 24),
    "eye": rgb(36, 28, 40),
    "claw": rgb(48, 20, 72),
    "clawL": rgb(88, 40, 132),
    "aura": rgb(28, 10, 48),
}
ROPE = {
    "r": rgb(138, 98, 48),
    "rd": rgb(96, 64, 28),
    "rl": rgb(196, 154, 88),
    "eye": rgb(255, 225, 74),
    "ink": rgb(12, 10, 14),
}


def ninja_frame(d: str, pose: Pose) -> Pix:
    c = Pix(FRAME, FRAME)
    cx, fy = 32 + pose.lean, 58 + pose.bob
    if d == "down":
        ground(c, 32, 56, 14)
        c.fill(18, 40, 28, 10, NINJA["suit"])
        c.fill(20, 36, 16, 8, NINJA["suit"])
        c.fill(36, 34, 10, 8, NINJA["suit"])
        c.fill(38, 36, 4, 2, NINJA["eye"])
        c.fill(12, 42, 10, 3, TEAM)
        c.line(40, 38, 54, 30, NINJA["blade"], 2)
        c.outline()
        return c
    ground(c, cx, fy + 2, 11)
    # legs
    ly = fy - 14
    if d in ("south", "north"):
        limb(c, cx - 4, ly, cx - 4 + pose.lstep, fy, NINJA["suit"], 3)
        limb(c, cx + 3, ly, cx + 3 + pose.rstep, fy, NINJA["suit"], 3)
        c.fill(cx - 5 + pose.lstep, fy - 2, 4, 3, NINJA["mid"])
        c.fill(cx + 2 + pose.rstep, fy - 2, 4, 3, NINJA["mid"])
    else:
        fwd = pose.rstep if d == "east" else pose.lstep
        back = pose.lstep if d == "east" else pose.rstep
        bx = cx - 2 if d == "east" else cx + 1
        limb(c, bx, ly, bx + (1 if d == "east" else -1) + back // 2, fy, NINJA["mid"], 3)
        limb(c, cx, ly, cx + (2 if d == "east" else -2) + fwd, fy, NINJA["suit"], 3)
        c.fill(cx - 2 + fwd, fy - 2, 5, 3, NINJA["mid"])
    # torso
    ty = fy - 30 + pose.bob
    c.fill(cx - 7, ty, 14, 16, NINJA["suit"])
    c.fill(cx - 6, ty + 2, 12, 3, NINJA["lite"])
    # arms
    sy = ty + 3
    if d == "south":
        limb(c, cx - 8, sy, cx - 10, sy + 11 + pose.larm, NINJA["suit"], 3)
        limb(c, cx + 7, sy, cx + 9, sy + 11 + pose.rarm, NINJA["suit"], 3)
        c.disc(cx - 10, sy + 12 + pose.larm, 2, NINJA["skin"])
        c.disc(cx + 9, sy + 12 + pose.rarm, 2, NINJA["skin"])
    elif d == "north":
        limb(c, cx + 7, sy, cx + 9, sy + 11 + pose.rarm, NINJA["suit"], 3)
        limb(c, cx - 8, sy, cx - 10, sy + 11 + pose.larm, NINJA["suit"], 3)
    elif d == "east":
        limb(c, cx - 3, sy, cx - 5, sy + 10 + pose.larm, NINJA["mid"], 3)
        limb(c, cx + 4, sy, cx + 8 + pose.swing // 2, sy + 8 + pose.rarm, NINJA["suit"], 3)
        c.disc(cx + 8 + pose.swing // 2, sy + 9 + pose.rarm, 2, NINJA["skin"])
    else:
        limb(c, cx + 2, sy, cx + 4, sy + 10 + pose.larm, NINJA["mid"], 3)
        limb(c, cx - 4, sy, cx - 8 - pose.swing // 2, sy + 8 + pose.rarm, NINJA["suit"], 3)
        c.disc(cx - 8 - pose.swing // 2, sy + 9 + pose.rarm, 2, NINJA["skin"])
    # head / mask
    hy = ty - 11
    c.fill(cx - 6, hy, 12, 12, NINJA["suit"])
    c.fill(cx - 5, hy + 1, 10, 3, NINJA["lite"])
    if d != "north":
        c.fill(cx - 4, hy + 5, 8, 3, NINJA["skinD"])
        c.fill(cx - 3, hy + 6, 2, 2, NINJA["eye"])
        c.fill(cx + 1, hy + 6, 2, 2, NINJA["eye"])
        if pose.pulse:
            c.set(cx - 4, hy + 5, NINJA["glow"])
            c.set(cx + 3, hy + 5, NINJA["glow"])
        c.fill(cx - 2, hy + 9, 4, 1, NINJA["skin"])
    # bandana
    c.fill(cx - 6, hy + 3, 12, 2, TEAM)
    if d == "south":
        c.fill(cx + 6, hy + 2, 3, 2, TEAM)
        c.fill(cx + 8, hy + 1 - pose.pulse, 5, 2, TEAM)
        c.fill(cx + 12, hy + 2, 3, 2, TEAM)
    elif d == "north":
        c.fill(cx - 11 - pose.pulse, hy + 2, 6, 2, TEAM)
        c.fill(cx - 14, hy + 3, 4, 2, TEAM)
    elif d == "east":
        c.fill(cx - 10, hy + 2, 5, 2, TEAM)
        c.fill(cx - 13, hy + 1 - pose.pulse, 4, 2, TEAM)
    else:
        c.fill(cx + 6, hy + 2, 5, 2, TEAM)
        c.fill(cx + 10, hy + 1 - pose.pulse, 4, 2, TEAM)
    # katana
    if d == "south":
        if pose.swing:
            hx, hy2 = cx + 9, sy + 12 + pose.rarm
            c.line(hx, hy2, hx + pose.swing, hy2 - 10, NINJA["blade"], 2)
            c.fill(hx - 1, hy2 - 1, 3, 3, NINJA["hilt"])
        else:
            c.line(cx + 6, ty - 2, cx + 10, ty + 16, NINJA["blade"], 2)
            c.fill(cx + 5, ty - 4, 3, 3, NINJA["hilt"])
    elif d == "north":
        c.line(cx - 8, ty - 2, cx - 11, ty + 16, NINJA["blade"], 2)
        c.fill(cx - 9, ty - 4, 3, 3, NINJA["hilt"])
    elif d == "east":
        hx, hy2 = cx + 8 + pose.swing // 2, sy + 9 + pose.rarm
        c.line(hx, hy2, hx + 12 + pose.swing, hy2 - 4, NINJA["blade"], 2)
        c.fill(hx - 1, hy2 - 1, 3, 2, NINJA["hilt"])
    else:
        hx, hy2 = cx - 8 - pose.swing // 2, sy + 9 + pose.rarm
        c.line(hx, hy2, hx - 12 - pose.swing, hy2 - 4, NINJA["blade"], 2)
        c.fill(hx - 1, hy2 - 1, 3, 2, NINJA["hilt"])
    c.outline()
    return c


def cole_frame(d: str, pose: Pose) -> Pix:
    c = Pix(FRAME, FRAME)
    cx, fy = 32 + pose.lean, 58 + pose.bob
    if d == "down":
        ground(c, 32, 56, 13)
        c.fill(16, 42, 30, 10, COLE["hood"])
        c.fill(20, 38, 14, 8, COLE["skin"])
        c.fill(22, 36, 10, 4, COLE["hair"])
        c.outline()
        return c
    ground(c, cx, fy + 2, 11)
    ly = fy - 14
    if d in ("south", "north"):
        limb(c, cx - 4, ly, cx - 4 + pose.lstep, fy, COLE["pants"], 3)
        limb(c, cx + 3, ly, cx + 3 + pose.rstep, fy, COLE["pants"], 3)
        c.fill(cx - 5 + pose.lstep, fy - 2, 4, 3, COLE["stripe"])
        c.fill(cx + 2 + pose.rstep, fy - 2, 4, 3, COLE["stripe"])
    else:
        fwd = pose.rstep if d == "east" else pose.lstep
        limb(c, cx, ly, cx + (2 if d == "east" else -2) + fwd, fy, COLE["pants"], 3)
        c.fill(cx - 2 + fwd, fy - 2, 5, 3, COLE["stripe"])
    ty = fy - 30 + pose.bob
    c.fill(cx - 8, ty, 16, 16, COLE["hood"])
    c.fill(cx - 8, ty + 4, 2, 12, COLE["stripe"])
    c.fill(cx + 6, ty + 4, 2, 12, COLE["stripe"])
    c.fill(cx - 3, ty + 3, 6, 12, COLE["shirt"])
    sy = ty + 3
    def sparks(hx: int, hy: int) -> None:
        c.set(hx, hy - 2, COLE["bolt"])
        c.set(hx + 2, hy, COLE["bolt2"] if pose.pulse else COLE["bolt"])
        c.set(hx - 1, hy + 2, COLE["bolt"])
        if pose.pulse:
            c.set(hx + 1, hy - 3, COLE["bolt2"])
    if d == "south":
        limb(c, cx - 8, sy, cx - 11, sy + 12 + pose.larm, COLE["hood"], 3)
        limb(c, cx + 7, sy, cx + 10, sy + 12 + pose.rarm, COLE["hood"], 3)
        c.fill(cx - 12, sy + 2 + pose.larm, 2, 8, COLE["stripe"])
        c.fill(cx + 10, sy + 2 + pose.rarm, 2, 8, COLE["stripe"])
        c.disc(cx - 11, sy + 13 + pose.larm, 2, COLE["skin"])
        c.disc(cx + 10, sy + 13 + pose.rarm, 2, COLE["skin"])
        sparks(cx - 11, sy + 13 + pose.larm)
        sparks(cx + 10, sy + 13 + pose.rarm)
    elif d == "north":
        limb(c, cx + 7, sy, cx + 10, sy + 12 + pose.rarm, COLE["hood"], 3)
        limb(c, cx - 8, sy, cx - 11, sy + 12 + pose.larm, COLE["hood"], 3)
        sparks(cx - 11, sy + 13 + pose.larm)
        sparks(cx + 10, sy + 13 + pose.rarm)
    elif d == "east":
        limb(c, cx - 2, sy, cx - 4, sy + 11 + pose.larm, COLE["hoodD"], 3)
        limb(c, cx + 5, sy, cx + 9 + pose.swing // 2, sy + 10 + pose.rarm, COLE["hood"], 3)
        c.fill(cx + 7, sy + 3 + pose.rarm, 2, 8, COLE["stripe"])
        c.disc(cx + 9 + pose.swing // 2, sy + 11 + pose.rarm, 2, COLE["skin"])
        sparks(cx + 9 + pose.swing // 2, sy + 11 + pose.rarm)
    else:
        limb(c, cx + 1, sy, cx + 3, sy + 11 + pose.larm, COLE["hoodD"], 3)
        limb(c, cx - 5, sy, cx - 9 - pose.swing // 2, sy + 10 + pose.rarm, COLE["hood"], 3)
        c.fill(cx - 9, sy + 3 + pose.rarm, 2, 8, COLE["stripe"])
        c.disc(cx - 9 - pose.swing // 2, sy + 11 + pose.rarm, 2, COLE["skin"])
        sparks(cx - 9 - pose.swing // 2, sy + 11 + pose.rarm)
    hy = ty - 10
    c.disc(cx, hy + 5, 6, COLE["skin"])
    c.fill(cx - 6, hy, 12, 5, COLE["hair"])
    c.fill(cx - 5, hy + 1, 10, 3, COLE["hair"])
    if d != "north":
        c.fill(cx - 3, hy + 6, 2, 2, COLE["eye"])
        c.fill(cx + 1, hy + 6, 2, 2, COLE["eye"])
        c.fill(cx - 1, hy + 9, 2, 1, COLE["skinD"])
    c.outline()
    return c


def death_frame(d: str, pose: Pose) -> Pix:
    c = Pix(FRAME, FRAME)
    cx, fy = 32 + pose.lean, 59 + pose.bob
    if d == "down":
        ground(c, 32, 56, 15)
        c.fill(14, 40, 34, 12, DEATH["cloth"])
        c.fill(40, 36, 16, 4, DEATH["wood"])
        c.fill(22, 38, 3, 2, DEATH["eye"])
        c.outline()
        return c
    ground(c, cx, fy + 2, 13)
    ly = fy - 16
    if d in ("south", "north"):
        limb(c, cx - 5, ly, cx - 5 + pose.lstep, fy, DEATH["cloth"], 4)
        limb(c, cx + 4, ly, cx + 4 + pose.rstep, fy, DEATH["cloth"], 4)
        c.fill(cx - 6 + pose.lstep, fy - 2, 5, 3, DEATH["wrap"])
        c.fill(cx + 3 + pose.rstep, fy - 2, 5, 3, DEATH["wrap"])
    else:
        fwd = pose.rstep if d == "east" else pose.lstep
        limb(c, cx, ly, cx + (2 if d == "east" else -2) + fwd, fy, DEATH["cloth"], 4)
        c.fill(cx - 2 + fwd, fy - 2, 6, 3, DEATH["wrap"])
    ty = fy - 32 + pose.bob
    c.fill(cx - 9, ty, 18, 18, DEATH["cloth"])
    c.fill(cx - 8, ty + 3, 16, 3, DEATH["clothL"])
    sy = ty + 4
    def bat(hx: int, hy: int, east: bool) -> None:
        dirx = 1 if east else -1
        c.line(hx, hy, hx + dirx * (10 + pose.swing), hy - 12, DEATH["wood"], 3)
        c.line(hx + dirx, hy - 1, hx + dirx * (10 + pose.swing), hy - 13, DEATH["woodD"], 2)
        tipx, tipy = hx + dirx * (10 + pose.swing), hy - 12
        for i in range(-2, 3):
            c.set(tipx + i, tipy - 3, DEATH["spike"])
            c.set(tipx + dirx * 2, tipy - 1 + i, DEATH["spike"])
    def uzi(px: int, py: int, east: bool) -> None:
        dirx = 1 if east else -1
        c.fill(px, py, 7, 4, DEATH["gun"])
        c.fill(px + (4 if east else -2), py + 1, 5, 2, DEATH["gunL"])
        c.fill(px + (1 if east else 3), py + 4, 2, 3, DEATH["gun"])
        c.set(px + dirx * 7, py + 1, DEATH["gunL"])
    if d == "south":
        limb(c, cx - 9, sy, cx - 12, sy + 12 + pose.larm, DEATH["cloth"], 3)
        limb(c, cx + 8, sy, cx + 11, sy + 10 + pose.rarm, DEATH["cloth"], 3)
        bat(cx + 11, sy + 10 + pose.rarm, True)
        uzi(cx - 6, ty + 12, True)
    elif d == "north":
        bat(cx - 10, sy + 8 + pose.rarm, False)
        limb(c, cx + 8, sy, cx + 11, sy + 12 + pose.larm, DEATH["cloth"], 3)
        limb(c, cx - 9, sy, cx - 12, sy + 10 + pose.rarm, DEATH["cloth"], 3)
        uzi(cx + 1, ty + 12, False)
    elif d == "east":
        limb(c, cx - 3, sy, cx - 5, sy + 12 + pose.larm, DEATH["wrap"], 3)
        limb(c, cx + 6, sy, cx + 10 + pose.swing // 2, sy + 9 + pose.rarm, DEATH["cloth"], 3)
        bat(cx + 10 + pose.swing // 2, sy + 8 + pose.rarm, True)
        uzi(cx - 2, ty + 13, True)
    else:
        limb(c, cx + 2, sy, cx + 4, sy + 12 + pose.larm, DEATH["wrap"], 3)
        limb(c, cx - 6, sy, cx - 10 - pose.swing // 2, sy + 9 + pose.rarm, DEATH["cloth"], 3)
        bat(cx - 10 - pose.swing // 2, sy + 8 + pose.rarm, False)
        uzi(cx - 2, ty + 13, False)
    hy = ty - 12
    c.fill(cx - 7, hy, 14, 14, DEATH["wrap"])
    c.fill(cx - 6, hy + 2, 12, 4, DEATH["cloth"])
    if d != "north":
        c.fill(cx - 4, hy + 6, 3, 2, DEATH["eye"])
        c.fill(cx + 1, hy + 6, 3, 2, DEATH["eye"])
        if pose.pulse:
            c.set(cx - 5, hy + 5, DEATH["glow"])
            c.set(cx + 4, hy + 5, DEATH["glow"])
    c.outline()
    return c


def witch_frame(d: str, pose: Pose) -> Pix:
    c = Pix(FRAME, FRAME)
    cx, fy = 32 + pose.lean, 58 + pose.bob
    if d == "down":
        ground(c, 32, 56, 12)
        c.fill(20, 42, 22, 8, WITCH["skirt"])
        c.fill(24, 36, 12, 8, WITCH["skin"])
        c.fill(22, 30, 16, 10, WITCH["hair"])
        c.outline()
        return c
    ground(c, cx, fy + 2, 10)
    ly = fy - 16
    net = WITCH["net"]
    if d in ("south", "north"):
        limb(c, cx - 3, ly, cx - 3 + pose.lstep, fy, net, 2)
        limb(c, cx + 2, ly, cx + 2 + pose.rstep, fy, net, 2)
        for y in range(ly + 2, fy, 2):
            c.set(cx - 3 + pose.lstep, y, WITCH["hair"])
            c.set(cx + 3 + pose.rstep, y, WITCH["hair"])
        c.fill(cx - 4 + pose.lstep, fy - 2, 3, 3, WITCH["skirt"])
        c.fill(cx + 2 + pose.rstep, fy - 2, 3, 3, WITCH["skirt"])
    else:
        fwd = pose.rstep if d == "east" else pose.lstep
        limb(c, cx, ly, cx + (2 if d == "east" else -2) + fwd, fy, net, 2)
        c.fill(cx - 1 + fwd, fy - 2, 4, 3, WITCH["skirt"])
    ty = fy - 28 + pose.bob
    c.fill(cx - 5, ty + 8, 10, 7, WITCH["skirt"])
    c.fill(cx - 4, ty + 2, 8, 8, WITCH["top"])
    c.fill(cx - 4, ty + 7, 8, 2, WITCH["topD"])
    c.fill(cx - 3, ty + 8, 6, 2, WITCH["skin"])
    sy = ty + 4
    def staff(hx: int, hy: int, east: bool) -> None:
        dirx = 1 if east else -1
        c.line(hx, hy, hx + dirx * 2, hy - 18 - pose.swing, WITCH["wood"], 2)
        sx, sy2 = hx + dirx * 2, hy - 18 - pose.swing
        c.disc(sx, sy2, 3, WITCH["skull"])
        c.set(sx - 1, sy2 - 1, WITCH["eye"])
        c.set(sx + 1, sy2 - 1, WITCH["eye"])
    if d == "south":
        limb(c, cx - 5, sy, cx - 8, sy + 10 + pose.larm, WITCH["skin"], 2)
        limb(c, cx + 4, sy, cx + 7, sy + 10 + pose.rarm, WITCH["skin"], 2)
        staff(cx + 7, sy + 10 + pose.rarm, True)
    elif d == "north":
        staff(cx - 7, sy + 8 + pose.rarm, False)
        limb(c, cx + 4, sy, cx + 7, sy + 10 + pose.larm, WITCH["skin"], 2)
        limb(c, cx - 5, sy, cx - 8, sy + 10 + pose.rarm, WITCH["skin"], 2)
    elif d == "east":
        limb(c, cx - 2, sy, cx - 3, sy + 10 + pose.larm, WITCH["skinD"], 2)
        limb(c, cx + 3, sy, cx + 7 + pose.swing // 3, sy + 8 + pose.rarm, WITCH["skin"], 2)
        staff(cx + 7 + pose.swing // 3, sy + 8 + pose.rarm, True)
    else:
        limb(c, cx + 1, sy, cx + 2, sy + 10 + pose.larm, WITCH["skinD"], 2)
        limb(c, cx - 3, sy, cx - 7 - pose.swing // 3, sy + 8 + pose.rarm, WITCH["skin"], 2)
        staff(cx - 7 - pose.swing // 3, sy + 8 + pose.rarm, False)
    hy = ty - 8
    if d != "south":
        c.fill(cx - 7, hy, 14, 14, WITCH["hair"])
    c.disc(cx, hy + 6, 5, WITCH["skin"])
    c.fill(cx - 7, hy - 1, 14, 7, WITCH["hair"])
    if d == "south":
        c.fill(cx - 8, hy + 6, 4, 12, WITCH["hair"])
        c.fill(cx + 5, hy + 6, 4, 12, WITCH["hair"])
        c.fill(cx - 3, hy + 6, 2, 2, WITCH["eye"])
        c.fill(cx + 1, hy + 6, 2, 2, WITCH["eye"])
        c.fill(cx - 1, hy + 9, 2, 1, WITCH["lip"])
    elif d == "north":
        c.fill(cx - 8, hy + 4, 16, 14, WITCH["hair"])
    elif d == "east":
        c.fill(cx + 2, hy + 6, 5, 12, WITCH["hair"])
        c.fill(cx + 1, hy + 6, 2, 2, WITCH["eye"])
        c.fill(cx, hy + 9, 2, 1, WITCH["lip"])
    else:
        c.fill(cx - 7, hy + 6, 5, 12, WITCH["hair"])
        c.fill(cx - 3, hy + 6, 2, 2, WITCH["eye"])
        c.fill(cx - 2, hy + 9, 2, 1, WITCH["lip"])
    c.outline()
    return c


def shadow_frame(d: str, pose: Pose) -> Pix:
    c = Pix(FRAME, FRAME)
    cx, fy = 32 + pose.lean, 56 + pose.bob
    if d == "down":
        ground(c, 32, 54, 12)
        c.fill(20, 40, 20, 8, SHADOW["skirt"])
        c.fill(24, 34, 12, 8, SHADOW["skin"])
        c.fill(22, 28, 16, 10, SHADOW["hair"])
        c.outline()
        return c
    ground(c, cx, fy + 2, 9)
    ly = fy - 14
    if d in ("south", "north"):
        limb(c, cx - 3, ly, cx - 3 + pose.lstep, fy, SHADOW["skin"], 2)
        limb(c, cx + 2, ly, cx + 2 + pose.rstep, fy, SHADOW["skin"], 2)
        c.fill(cx - 4 + pose.lstep, fy - 2, 3, 3, SHADOW["hair"])
        c.fill(cx + 2 + pose.rstep, fy - 2, 3, 3, SHADOW["hair"])
    else:
        fwd = pose.rstep if d == "east" else pose.lstep
        limb(c, cx, ly, cx + (2 if d == "east" else -2) + fwd, fy, SHADOW["skin"], 2)
        c.fill(cx - 1 + fwd, fy - 2, 4, 3, SHADOW["hair"])
    ty = fy - 26 + pose.bob
    c.fill(cx - 5, ty + 8, 10, 6, SHADOW["skirt"])
    c.fill(cx - 5, ty + 1, 10, 9, SHADOW["shirt"])
    sy = ty + 3

    def claw(hx: int, hy: int, east: bool) -> None:
        dirx = 1 if east else -1
        aura = SHADOW["aura"] if pose.pulse else SHADOW["claw"]
        c.disc(hx + dirx * 3, hy, 5 + pose.pulse, aura)
        c.disc(hx + dirx * 4, hy - 1, 4, SHADOW["claw"])
        c.fill(hx + dirx * 2, hy - 5, 3, 10, SHADOW["clawL"])
        for i, off in enumerate((-3, -1, 1)):
            c.line(hx + dirx * 5, hy + off, hx + dirx * (11 + pose.pulse), hy + off - 2 + i, SHADOW["clawL"], 2)
        c.disc(hx, hy, 2, SHADOW["skin"])

    # right arm = claw. south: screen right. north: screen left. east: front right. west: front (character right = west side)
    if d == "south":
        limb(c, cx - 5, sy, cx - 8, sy + 10 + pose.larm, SHADOW["skin"], 2)
        limb(c, cx + 4, sy, cx + 8, sy + 8 + pose.rarm, SHADOW["skin"], 2)
        claw(cx + 8, sy + 8 + pose.rarm, True)
        c.disc(cx - 8, sy + 11 + pose.larm, 2, SHADOW["skin"])
    elif d == "north":
        claw(cx - 8, sy + 8 + pose.rarm, False)
        limb(c, cx + 4, sy, cx + 7, sy + 10 + pose.larm, SHADOW["skin"], 2)
        limb(c, cx - 5, sy, cx - 8, sy + 8 + pose.rarm, SHADOW["skin"], 2)
    elif d == "east":
        limb(c, cx - 2, sy, cx - 3, sy + 10 + pose.larm, SHADOW["skinD"], 2)
        limb(c, cx + 3, sy, cx + 7 + pose.swing // 3, sy + 7 + pose.rarm, SHADOW["skin"], 2)
        claw(cx + 7 + pose.swing // 3, sy + 7 + pose.rarm, True)
    else:
        limb(c, cx + 1, sy, cx + 2, sy + 10 + pose.larm, SHADOW["skinD"], 2)
        limb(c, cx - 3, sy, cx - 7 - pose.swing // 3, sy + 7 + pose.rarm, SHADOW["skin"], 2)
        claw(cx - 7 - pose.swing // 3, sy + 7 + pose.rarm, False)
    hy = ty - 8
    c.disc(cx, hy + 6, 5, SHADOW["skin"])
    # double buns
    c.disc(cx - 6, hy + 1, 3, SHADOW["hair"])
    c.disc(cx + 6, hy + 1, 3, SHADOW["hair"])
    c.fill(cx - 6, hy, 12, 6, SHADOW["hair"])
    if d == "south":
        c.fill(cx - 6, hy + 5, 7, 8, SHADOW["hair"])  # bangs cover left/half face
        c.fill(cx + 1, hy + 6, 2, 2, SHADOW["eye"])
        c.fill(cx - 7, hy + 8, 4, 10, SHADOW["hair"])
        c.fill(cx + 4, hy + 8, 4, 10, SHADOW["hair"])
    elif d == "north":
        c.fill(cx - 7, hy + 4, 14, 14, SHADOW["hair"])
        c.disc(cx - 6, hy + 1, 3, SHADOW["hair"])
        c.disc(cx + 6, hy + 1, 3, SHADOW["hair"])
    elif d == "east":
        c.fill(cx + 1, hy + 5, 6, 10, SHADOW["hair"])
        c.fill(cx, hy + 6, 2, 2, SHADOW["eye"])
        c.disc(cx + 5, hy + 1, 3, SHADOW["hair"])
    else:
        c.fill(cx - 7, hy + 5, 7, 10, SHADOW["hair"])  # bangs still cover right-of-character = screen right when west? character right is screen left when facing west... bangs cover right half of FACE which is character's right. facing west, character right is near camera/bottom... keep bangs on screen-right of face as "half covered"
        c.fill(cx - 2, hy + 6, 2, 2, SHADOW["eye"])
        c.disc(cx - 5, hy + 1, 3, SHADOW["hair"])
    c.outline()
    return c


def rope_frame(d: str, pose: Pose) -> Pix:
    c = Pix(FRAME, FRAME)
    cx, fy = 32 + pose.lean, 58 + pose.bob
    if d == "down":
        ground(c, 32, 56, 13)
        for i in range(8):
            c.fill(16 + i * 3, 42 + (i % 2), 8, 2, ROPE["r"] if i % 2 == 0 else ROPE["rl"])
        c.fill(28, 38, 4, 3, ROPE["eye"])
        c.outline()
        return c
    ground(c, cx, fy + 2, 11)

    def wrap_rect(x: int, y: int, w: int, h: int) -> None:
        c.fill(x, y, w, h, ROPE["r"])
        for i in range(y, y + h, 2):
            c.fill(x, i, w, 1, ROPE["rd"] if ((i + x) // 2) % 2 == 0 else ROPE["rl"])

    ly = fy - 14
    if d in ("south", "north"):
        limb(c, cx - 4, ly, cx - 4 + pose.lstep, fy, ROPE["r"], 3)
        limb(c, cx + 3, ly, cx + 3 + pose.rstep, fy, ROPE["r"], 3)
        wrap_rect(cx - 5 + pose.lstep, fy - 2, 4, 3)
        wrap_rect(cx + 2 + pose.rstep, fy - 2, 4, 3)
    else:
        fwd = pose.rstep if d == "east" else pose.lstep
        limb(c, cx, ly, cx + (2 if d == "east" else -2) + fwd, fy, ROPE["r"], 3)
        wrap_rect(cx - 2 + fwd, fy - 2, 5, 3)
    ty = fy - 30 + pose.bob
    wrap_rect(cx - 7, ty, 14, 16)
    sy = ty + 3
    if d == "south":
        limb(c, cx - 8, sy, cx - 11, sy + 12 + pose.larm, ROPE["r"], 3)
        limb(c, cx + 7, sy, cx + 10, sy + 12 + pose.rarm, ROPE["r"], 3)
    elif d == "north":
        limb(c, cx + 7, sy, cx + 10, sy + 12 + pose.rarm, ROPE["r"], 3)
        limb(c, cx - 8, sy, cx - 11, sy + 12 + pose.larm, ROPE["r"], 3)
    elif d == "east":
        limb(c, cx - 2, sy, cx - 4, sy + 11 + pose.larm, ROPE["rd"], 3)
        limb(c, cx + 5, sy, cx + 9 + pose.swing // 2, sy + 10 + pose.rarm, ROPE["r"], 3)
    else:
        limb(c, cx + 1, sy, cx + 3, sy + 11 + pose.larm, ROPE["rd"], 3)
        limb(c, cx - 5, sy, cx - 9 - pose.swing // 2, sy + 10 + pose.rarm, ROPE["r"], 3)
    hy = ty - 11
    wrap_rect(cx - 6, hy, 12, 12)
    if d != "north":
        # yellow triangular eyes
        for i in range(3):
            c.fill(cx - 4 + i, hy + 5 + i, 3 - i, 1, ROPE["eye"])
            c.fill(cx + 1 + i, hy + 5 + i, 3 - i, 1, ROPE["eye"])
        c.set(cx - 3, hy + 5, ROPE["ink"])
        c.set(cx + 3, hy + 5, ROPE["ink"])
    c.outline()
    return c


DRAW = {
    "ninja": ninja_frame,
    "cole": cole_frame,
    "death": death_frame,
    "witch": witch_frame,
    "shadow": shadow_frame,
    "rope": rope_frame,
}


def sheet_for(hero: str) -> Image.Image:
    img = Image.new("RGBA", (FRAME * len(COLS), FRAME * len(ROWS)), (0, 0, 0, 0))
    draw = DRAW[hero]
    for ry, d in enumerate(ROWS):
        for cx, pose_name in enumerate(COLS):
            pose = pose_for(pose_name, hero)
            if pose_name == "down":
                d_use = "down"
            else:
                d_use = d
            fr = draw(d_use, pose).image()
            img.paste(fr, (cx * FRAME, ry * FRAME), fr)
    return img


def portrait_ninja() -> Image.Image:
    c = Pix(PORTRAIT, PORTRAIT)
    c.fill(0, 0, PORTRAIT, PORTRAIT, rgb(18, 16, 28))
    c.fill(24, 86, 80, 42, NINJA["suit"])
    c.fill(28, 90, 72, 8, NINJA["lite"])
    c.fill(40, 18, 48, 52, NINJA["suit"])
    c.fill(44, 22, 40, 10, NINJA["lite"])
    c.fill(44, 48, 40, 14, NINJA["skinD"])
    c.fill(50, 54, 10, 8, NINJA["eye"])
    c.fill(70, 54, 10, 8, NINJA["eye"])
    c.fill(52, 56, 6, 4, NINJA["glow"])
    c.fill(72, 56, 6, 4, NINJA["glow"])
    c.fill(54, 70, 20, 4, NINJA["skin"])
    c.fill(40, 40, 48, 8, TEAM)
    c.fill(86, 36, 18, 8, TEAM)
    c.fill(100, 40, 14, 6, TEAM)
    c.line(96, 100, 122, 58, NINJA["blade"], 4)
    c.fill(92, 98, 10, 8, NINJA["hilt"])
    c.outline()
    return c.image()


def portrait_cole() -> Image.Image:
    c = Pix(PORTRAIT, PORTRAIT)
    c.fill(0, 0, PORTRAIT, PORTRAIT, rgb(28, 24, 18))
    c.fill(22, 78, 84, 50, COLE["hood"])
    c.fill(22, 86, 8, 36, COLE["stripe"])
    c.fill(98, 86, 8, 36, COLE["stripe"])
    c.fill(54, 86, 20, 36, COLE["shirt"])
    c.disc(64, 52, 28, COLE["skin"])
    c.fill(36, 20, 56, 22, COLE["hair"])
    c.fill(40, 24, 48, 14, COLE["hair"])
    c.fill(48, 54, 8, 8, COLE["eye"])
    c.fill(72, 54, 8, 8, COLE["eye"])
    c.fill(58, 72, 12, 4, COLE["skinD"])
    c.fill(18, 108, 16, 10, COLE["skin"])
    c.fill(94, 108, 16, 10, COLE["skin"])
    for x, y in ((20, 104), (24, 100), (100, 104), (108, 98), (22, 110)):
        c.set(x, y, COLE["bolt"])
        c.set(x + 2, y - 2, COLE["bolt2"])
    c.outline()
    return c.image()


def portrait_death() -> Image.Image:
    c = Pix(PORTRAIT, PORTRAIT)
    c.fill(0, 0, PORTRAIT, PORTRAIT, rgb(10, 10, 14))
    c.fill(18, 78, 92, 50, DEATH["cloth"])
    c.fill(22, 86, 84, 8, DEATH["clothL"])
    c.fill(36, 16, 56, 64, DEATH["wrap"])
    c.fill(40, 28, 48, 16, DEATH["cloth"])
    c.fill(44, 52, 14, 10, DEATH["eye"])
    c.fill(70, 52, 14, 10, DEATH["eye"])
    c.fill(46, 54, 8, 6, DEATH["glow"])
    c.fill(72, 54, 8, 6, DEATH["glow"])
    c.line(96, 92, 124, 36, DEATH["wood"], 6)
    c.fill(118, 28, 8, 16, DEATH["spike"])
    c.fill(24, 100, 22, 10, DEATH["gun"])
    c.outline()
    return c.image()


def portrait_witch() -> Image.Image:
    c = Pix(PORTRAIT, PORTRAIT)
    c.fill(0, 0, PORTRAIT, PORTRAIT, rgb(36, 16, 48))
    c.fill(40, 96, 48, 32, WITCH["skirt"])
    c.fill(44, 80, 40, 22, WITCH["top"])
    c.fill(48, 96, 32, 8, WITCH["skin"])
    c.disc(64, 52, 26, WITCH["skin"])
    c.fill(28, 16, 72, 28, WITCH["hair"])
    c.fill(24, 40, 18, 70, WITCH["hair"])
    c.fill(86, 40, 18, 70, WITCH["hair"])
    c.fill(50, 54, 8, 8, WITCH["eye"])
    c.fill(70, 54, 8, 8, WITCH["eye"])
    c.fill(58, 72, 12, 4, WITCH["lip"])
    c.line(96, 100, 110, 24, WITCH["wood"], 4)
    c.disc(110, 22, 10, WITCH["skull"])
    c.set(106, 20, WITCH["eye"])
    c.set(114, 20, WITCH["eye"])
    c.outline()
    return c.image()


def portrait_shadow() -> Image.Image:
    c = Pix(PORTRAIT, PORTRAIT)
    c.fill(0, 0, PORTRAIT, PORTRAIT, rgb(20, 16, 28))
    c.fill(40, 100, 48, 28, SHADOW["skirt"])
    c.fill(38, 78, 52, 28, SHADOW["shirt"])
    c.disc(64, 54, 26, SHADOW["skin"])
    c.disc(36, 28, 12, SHADOW["hair"])
    c.disc(92, 28, 12, SHADOW["hair"])
    c.fill(36, 20, 56, 24, SHADOW["hair"])
    c.fill(32, 48, 36, 40, SHADOW["hair"])
    c.fill(72, 56, 8, 8, SHADOW["eye"])
    c.disc(108, 96, 18, SHADOW["aura"])
    c.disc(110, 92, 14, SHADOW["claw"])
    c.fill(104, 80, 10, 28, SHADOW["clawL"])
    c.line(118, 84, 126, 70, SHADOW["clawL"], 3)
    c.line(118, 92, 126, 88, SHADOW["clawL"], 3)
    c.line(118, 100, 126, 108, SHADOW["clawL"], 3)
    c.outline()
    return c.image()


def portrait_rope() -> Image.Image:
    c = Pix(PORTRAIT, PORTRAIT)
    c.fill(0, 0, PORTRAIT, PORTRAIT, rgb(28, 20, 14))
    for y in range(16, 120, 2):
        col = ROPE["r"] if (y // 2) % 2 == 0 else ROPE["rl"]
        c.fill(36, y, 56, 2, col)
        c.fill(32, y + 1, 64, 1, ROPE["rd"])
    for i in range(4):
        c.fill(48 + i, 52 + i, 12 - i * 2, 2, ROPE["eye"])
        c.fill(68 + i, 52 + i, 12 - i * 2, 2, ROPE["eye"])
    c.fill(52, 52, 3, 3, ROPE["ink"])
    c.fill(76, 52, 3, 3, ROPE["ink"])
    c.outline()
    return c.image()


PORTRAITS = {
    "ninja": portrait_ninja,
    "cole": portrait_cole,
    "death": portrait_death,
    "witch": portrait_witch,
    "shadow": portrait_shadow,
    "rope": portrait_rope,
}


def main() -> None:
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    PORT_DIR.mkdir(parents=True, exist_ok=True)
    for hero in DRAW:
        sheet = sheet_for(hero)
        out = CHAR_DIR / hero / "sheet.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(out)
        PORTRAITS[hero]().save(PORT_DIR / f"{hero}.png")
        print(f"wrote {hero} {sheet.size}")


if __name__ == "__main__":
    main()
