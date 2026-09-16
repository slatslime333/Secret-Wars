#!/usr/bin/env python3
"""Rope Man sheet: keep crouched idle, redraw upright run + alternating shots.

Idle (col 0) is copied from the original wrap-coil art. Walk (1-4) is an upright
run with a slight forward lean and a big opposite-arm pump. Shot (5-6) stands
upright with one arm held out. Punch/grab stay distinct upright poses.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

FRAME = 80
COLS = 10
ROWS = 4
SRC = Path("assets/heroes/rope.png")

OUT = (17, 4, 28, 255)
ROPE = (122, 75, 53, 255)
LIGHT = (132, 77, 50, 255)
HI = (142, 83, 53, 255)
MID = (102, 64, 52, 255)
DARK = (78, 47, 42, 255)
DEEP = (45, 28, 41, 255)
SHADE = (63, 39, 43, 255)
EYE = (252, 102, 28, 255)


def new_buf():
    return [[None] * FRAME for _ in range(FRAME)]


def plot(buf, x, y, c):
    ix, iy = int(round(x)), int(round(y))
    if 0 <= ix < FRAME and 0 <= iy < FRAME:
        buf[iy][ix] = c


def dist2(ax, ay, bx, by):
    dx, dy = ax - bx, ay - by
    return dx * dx + dy * dy


def hypot(dx, dy):
    return (dx * dx + dy * dy) ** 0.5


def wrap_color(along, nx, ny, radius):
    """Mummy tape: dark grooves wrapping around the limb, lit from top-left."""
    r = max(0.8, radius)
    phase = (along * 0.38 + nx * 1.15) % 4.6
    if phase < 0.95:
        base = DEEP if phase < 0.4 else DARK
    elif phase < 2.15:
        base = HI
    elif phase < 3.35:
        base = LIGHT
    elif phase < 4.35:
        base = ROPE
    else:
        base = MID
    light = (-ny * 0.7 - nx * 0.28) / r
    if light > 0.42 and base not in (DEEP, DARK):
        return HI
    if light < -0.55:
        if base in (HI, LIGHT):
            return MID
        if base == ROPE:
            return DARK
        return DEEP
    return base


def capsule(buf, x0, y0, x1, y1, r0, r1):
    dx, dy = x1 - x0, y1 - y0
    length = max(0.001, hypot(dx, dy))
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    pad = max(r0, r1) + 2
    x_min = int(min(x0, x1) - pad)
    x_max = int(max(x0, x1) + pad + 1)
    y_min = int(min(y0, y1) - pad)
    y_max = int(max(y0, y1) + pad + 1)
    for y in range(y_min, y_max + 1):
        for x in range(x_min, x_max + 1):
            wx, wy = x + 0.5, y + 0.5
            t = ((wx - x0) * ux + (wy - y0) * uy) / length
            t_clamped = min(1.0, max(0.0, t))
            cx = x0 + dx * t_clamped
            cy = y0 + dy * t_clamped
            r = r0 + (r1 - r0) * t_clamped
            d2 = dist2(wx, wy, cx, cy)
            if d2 > r * r:
                continue
            nx = (wx - cx) * px + (wy - cy) * py
            ny = (wx - cx) * ux + (wy - cy) * uy
            along = t_clamped * length
            plot(buf, x, y, wrap_color(along, nx, ny, r))


def disc(buf, cx, cy, r, along0=0.0):
    x0, x1 = int(cx - r - 1), int(cx + r + 2)
    y0, y1 = int(cy - r - 1), int(cy + r + 2)
    r2 = r * r
    for y in range(y0, y1):
        for x in range(x0, x1):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if dx * dx + dy * dy > r2:
                continue
            plot(buf, x, y, wrap_color(along0 + dy * 0.9, dx, dy, r))


def claw(buf, hx, hy, dx, dy, fingers=3, length=5.2):
    mag = max(0.001, hypot(dx, dy))
    ux, uy = dx / mag, dy / mag
    px, py = -uy, ux
    disc(buf, hx, hy, 2.7, along0=hx)
    span = 0.72 if fingers == 3 else 0.9
    for i in range(fingers):
        t = 0 if fingers == 1 else (i / (fingers - 1) - 0.5)
        ang = t * span
        fx = ux * (length - abs(t) * 0.8) + px * ang * 4.2
        fy = uy * (length - abs(t) * 0.8) + py * ang * 4.2
        capsule(buf, hx + ux, hy + uy, hx + fx, hy + fy, 1.35, 0.85)
        plot(buf, hx + fx * 1.08, hy + fy * 1.08, DEEP)


def foot(buf, fx, fy, facing, side):
    disc(buf, fx, fy, 3.2, along0=fy)
    if facing == "east":
        toe_dir = (1, 0.15)
    elif facing == "west":
        toe_dir = (-1, 0.15)
    else:
        toe_dir = (side * 0.35, 1)
    claw(buf, fx + toe_dir[0] * 1.2, fy + toe_dir[1] * 1.2, toe_dir[0], toe_dir[1], fingers=3, length=4.4)


def outline(buf):
    filled = [(x, y) for y in range(FRAME) for x in range(FRAME) if buf[y][x] not in (None, OUT, EYE)]
    for x, y in filled:
        for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            nx, ny = x + ox, y + oy
            if 0 <= nx < FRAME and 0 <= ny < FRAME and buf[ny][nx] is None:
                buf[ny][nx] = OUT


def triangle_eye(buf, cx, cy, facing):
    if facing == "north":
        return
    if facing == "east":
        for p in (
            (0, 0),
            (1, -1), (1, 0), (1, 1),
            (2, -1), (2, 0), (2, 1),
            (3, 0),
        ):
            plot(buf, cx + p[0], cy + p[1], EYE)
        return
    if facing == "west":
        for p in (
            (0, 0),
            (-1, -1), (-1, 0), (-1, 1),
            (-2, -1), (-2, 0), (-2, 1),
            (-3, 0),
        ):
            plot(buf, cx + p[0], cy + p[1], EYE)
        return
    for dx in (-5, 5):
        ox = cx + dx
        plot(buf, ox, cy - 2, EYE)
        for x in range(-1, 2):
            plot(buf, ox + x, cy - 1, EYE)
        for x in range(-2, 3):
            plot(buf, ox + x, cy, EYE)
        for x in range(-2, 3):
            plot(buf, ox + x, cy + 1, EYE)


def to_image(buf) -> Image.Image:
    img = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    px = img.load()
    for y in range(FRAME):
        for x in range(FRAME):
            if buf[y][x] is not None:
                px[x, y] = buf[y][x]
    return img


def add_shot_strand(buf, hx, hy, facing, side):
    if facing == "east":
        dx, dy = 1, 0
    elif facing == "west":
        dx, dy = -1, 0
    elif facing == "south":
        dx, dy = (-1 if side == "l" else 1), 0.2
    else:
        dx, dy = (-1 if side == "l" else 1), -0.35
    for i in range(1, 10):
        ix, iy = int(round(hx + dx * i)), int(round(hy + dy * i))
        if not (0 <= ix < FRAME and 0 <= iy < FRAME):
            break
        if buf[iy][ix] is not None:
            continue
        buf[iy][ix] = LIGHT if i % 2 == 0 else DARK
        if 0 <= iy + 1 < FRAME and buf[iy + 1][ix] is None:
            buf[iy + 1][ix] = OUT


def draw_figure(facing, joints, shoot=None) -> Image.Image:
    """joints keys: head, sh, hip, l_elb, l_hand, r_elb, r_hand, l_knee, l_foot, r_knee, r_foot."""
    buf = new_buf()
    head, sh, hip = joints["head"], joints["sh"], joints["hip"]
    far_arm = "l" if facing == "east" else "r"
    near_arm = "r" if facing == "east" else "l"
    far_leg = far_arm
    near_leg = near_arm

    def draw_arm(side):
        elb = joints[f"{side}_elb"]
        hand = joints[f"{side}_hand"]
        sx = sh[0] + (-5 if side == "l" else 5)
        if facing == "east":
            sx = sh[0] + (-3 if side == "l" else 4)
        elif facing == "west":
            sx = sh[0] + (-4 if side == "l" else 3)
        capsule(buf, sx, sh[1] + 1, elb[0], elb[1], 4.2, 3.6)
        capsule(buf, elb[0], elb[1], hand[0], hand[1], 3.6, 2.8)
        hx, hy = hand
        if facing == "east":
            dx, dy = (1.0, -0.1) if hx >= sh[0] else (-1.0, 0.2)
        elif facing == "west":
            dx, dy = (-1.0, -0.1) if hx <= sh[0] else (1.0, 0.2)
        elif facing == "south":
            dx, dy = (hx - sh[0], hy - sh[1] + 4)
        else:
            dx, dy = (hx - sh[0], sh[1] - hy - 2)
        claw(buf, hx, hy, dx, dy, fingers=3, length=5.0)

    def draw_leg(side):
        knee = joints[f"{side}_knee"]
        ft = joints[f"{side}_foot"]
        hx = hip[0] + (-3 if side == "l" else 3)
        if facing in ("east", "west"):
            hx = hip[0] + (2 if facing == "east" else -2)
        capsule(buf, hx, hip[1] + 2, knee[0], knee[1], 5.0, 4.2)
        capsule(buf, knee[0], knee[1], ft[0], ft[1], 4.2, 3.4)
        foot(buf, ft[0], ft[1], facing, -1 if side == "l" else 1)

    if facing in ("east", "west"):
        draw_arm(far_arm)
        draw_leg(far_leg)
        # torso + head
        capsule(buf, head[0], head[1] + 6, sh[0], sh[1], 8.2, 7.4)
        capsule(buf, sh[0], sh[1], hip[0], hip[1], 7.6, 6.4)
        disc(buf, sh[0], sh[1] + 2, 7.2, along0=sh[1])
        disc(buf, hip[0], hip[1], 6.4, along0=hip[1])
        disc(buf, head[0], head[1], 9.0, along0=0)
        draw_leg(near_leg)
        draw_arm(near_arm)
    else:
        draw_leg("l")
        draw_leg("r")
        capsule(buf, head[0], head[1] + 6, sh[0], sh[1], 8.6, 7.6)
        capsule(buf, sh[0], sh[1], hip[0], hip[1], 8.0, 6.4)
        disc(buf, sh[0], sh[1] + 3, 7.8, along0=sh[1])
        disc(buf, hip[0], hip[1], 6.8, along0=hip[1])
        disc(buf, head[0], head[1], 9.2, along0=0)
        draw_arm("l")
        draw_arm("r")

    if shoot:
        add_shot_strand(buf, joints[f"{shoot}_hand"][0], joints[f"{shoot}_hand"][1], facing, shoot)
    outline(buf)
    triangle_eye(buf, head[0], head[1] - 1, facing)
    return to_image(buf)


def J(**kwargs):
    return kwargs


# Upright run: slight forward lean, opposite arm/leg, huge pump.
EAST_RUN = [
    J(  # right arm forward, left leg forward
        head=(48, 16), sh=(44, 28), hip=(39, 47),
        r_elb=(58, 24), r_hand=(72, 20),
        l_elb=(30, 34), l_hand=(16, 40),
        l_knee=(52, 58), l_foot=(58, 72),
        r_knee=(30, 62), r_foot=(24, 76),
    ),
    J(  # pass: arms closer to the body, slight bounce
        head=(47, 14), sh=(43, 26), hip=(39, 45),
        r_elb=(52, 26), r_hand=(60, 22),
        l_elb=(34, 32), l_hand=(24, 38),
        l_knee=(46, 56), l_foot=(48, 70),
        r_knee=(34, 58), r_foot=(32, 72),
    ),
    J(  # left arm forward (far), right leg forward
        head=(48, 16), sh=(44, 28), hip=(39, 47),
        l_elb=(56, 20), l_hand=(70, 14),
        r_elb=(32, 36), r_hand=(18, 42),
        r_knee=(52, 58), r_foot=(58, 72),
        l_knee=(30, 62), l_foot=(24, 76),
    ),
    J(
        head=(47, 14), sh=(43, 26), hip=(39, 45),
        l_elb=(50, 24), l_hand=(58, 18),
        r_elb=(34, 32), r_hand=(24, 38),
        r_knee=(46, 56), r_foot=(48, 70),
        l_knee=(34, 58), l_foot=(32, 72),
    ),
]

EAST_SHOT_L = J(
    head=(44, 16), sh=(41, 28), hip=(40, 48),
    l_elb=(52, 22), l_hand=(70, 20),
    r_elb=(34, 40), r_hand=(28, 52),
    l_knee=(34, 62), l_foot=(32, 76),
    r_knee=(48, 62), r_foot=(50, 76),
)
EAST_SHOT_R = J(
    head=(44, 16), sh=(41, 28), hip=(40, 48),
    r_elb=(60, 28), r_hand=(74, 28),
    l_elb=(32, 38), l_hand=(26, 48),
    l_knee=(34, 62), l_foot=(32, 76),
    r_knee=(48, 62), r_foot=(50, 76),
)
EAST_PUNCH = J(
    head=(46, 16), sh=(43, 28), hip=(40, 48),
    r_elb=(60, 24), r_hand=(74, 22),
    l_elb=(32, 34), l_hand=(24, 44),
    l_knee=(36, 62), l_foot=(32, 76),
    r_knee=(50, 60), r_foot=(54, 76),
)
EAST_GRAB1 = J(
    head=(44, 16), sh=(41, 28), hip=(40, 48),
    r_elb=(56, 16), r_hand=(70, 10),
    l_elb=(36, 20), l_hand=(48, 8),
    l_knee=(34, 62), l_foot=(32, 76),
    r_knee=(48, 62), r_foot=(50, 76),
)
EAST_GRAB2 = J(
    head=(44, 15), sh=(41, 27), hip=(40, 48),
    r_elb=(54, 12), r_hand=(66, 4),
    l_elb=(38, 12), l_hand=(50, 2),
    l_knee=(34, 62), l_foot=(32, 76),
    r_knee=(48, 62), r_foot=(50, 76),
)

# South: forward arm is IN FRONT of the torso (low/center); back arm is raised out.
SOUTH_RUN = [
    J(  # left arm forward (low, outboard), right arm back (high)
        head=(40, 16), sh=(40, 29), hip=(40, 47),
        l_elb=(24, 42), l_hand=(18, 56),
        r_elb=(56, 18), r_hand=(64, 8),
        r_knee=(50, 58), r_foot=(50, 70),
        l_knee=(28, 62), l_foot=(26, 76),
    ),
    J(
        head=(40, 14), sh=(40, 27), hip=(40, 45),
        l_elb=(26, 34), l_hand=(22, 44),
        r_elb=(54, 24), r_hand=(60, 16),
        l_knee=(34, 56), l_foot=(32, 70),
        r_knee=(46, 56), r_foot=(48, 70),
    ),
    J(  # right arm forward, left arm back
        head=(40, 16), sh=(40, 29), hip=(40, 47),
        r_elb=(56, 42), r_hand=(62, 56),
        l_elb=(24, 18), l_hand=(16, 8),
        l_knee=(30, 58), l_foot=(30, 70),
        r_knee=(52, 62), r_foot=(54, 76),
    ),
    J(
        head=(40, 14), sh=(40, 27), hip=(40, 45),
        r_elb=(54, 34), r_hand=(58, 44),
        l_elb=(26, 24), l_hand=(20, 16),
        r_knee=(46, 56), r_foot=(48, 70),
        l_knee=(34, 56), l_foot=(32, 70),
    ),
]

SOUTH_SHOT_L = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    l_elb=(22, 26), l_hand=(8, 22),
    r_elb=(54, 40), r_hand=(58, 54),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)
SOUTH_SHOT_R = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    r_elb=(58, 26), r_hand=(72, 22),
    l_elb=(26, 40), l_hand=(22, 54),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)
SOUTH_PUNCH = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    r_elb=(54, 22), r_hand=(62, 12),
    l_elb=(28, 38), l_hand=(24, 50),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 60), r_foot=(54, 76),
)
SOUTH_GRAB1 = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    l_elb=(26, 16), l_hand=(18, 6),
    r_elb=(54, 16), r_hand=(62, 6),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)
SOUTH_GRAB2 = J(
    head=(40, 14), sh=(40, 27), hip=(40, 48),
    l_elb=(24, 12), l_hand=(16, 2),
    r_elb=(56, 12), r_hand=(64, 2),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)

NORTH_RUN = [
    J(
        head=(40, 16), sh=(40, 29), hip=(40, 47),
        l_elb=(24, 18), l_hand=(16, 8),
        r_elb=(48, 40), r_hand=(44, 52),
        r_knee=(50, 58), r_foot=(50, 70),
        l_knee=(28, 62), l_foot=(26, 76),
    ),
    J(
        head=(40, 14), sh=(40, 27), hip=(40, 45),
        l_elb=(28, 30), l_hand=(24, 20),
        r_elb=(52, 30), r_hand=(56, 20),
        l_knee=(34, 56), l_foot=(32, 68),
        r_knee=(46, 56), r_foot=(48, 68),
    ),
    J(
        head=(40, 16), sh=(40, 29), hip=(40, 47),
        r_elb=(56, 18), r_hand=(64, 8),
        l_elb=(32, 40), l_hand=(36, 52),
        l_knee=(30, 58), l_foot=(30, 70),
        r_knee=(52, 62), r_foot=(54, 76),
    ),
    J(
        head=(40, 14), sh=(40, 27), hip=(40, 45),
        r_elb=(52, 30), r_hand=(56, 20),
        l_elb=(28, 30), l_hand=(24, 20),
        r_knee=(46, 56), r_foot=(48, 68),
        l_knee=(34, 56), l_foot=(32, 68),
    ),
]
NORTH_SHOT_L = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    l_elb=(22, 24), l_hand=(8, 18),
    r_elb=(50, 38), r_hand=(54, 50),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)
NORTH_SHOT_R = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    r_elb=(58, 24), r_hand=(72, 18),
    l_elb=(30, 38), l_hand=(26, 50),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)
NORTH_PUNCH = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    r_elb=(54, 20), r_hand=(62, 10),
    l_elb=(28, 36), l_hand=(24, 48),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 60), r_foot=(54, 76),
)
NORTH_GRAB1 = J(
    head=(40, 15), sh=(40, 28), hip=(40, 48),
    l_elb=(26, 14), l_hand=(18, 4),
    r_elb=(54, 14), r_hand=(62, 4),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)
NORTH_GRAB2 = J(
    head=(40, 14), sh=(40, 27), hip=(40, 48),
    l_elb=(24, 10), l_hand=(16, 1),
    r_elb=(56, 10), r_hand=(64, 1),
    l_knee=(32, 62), l_foot=(30, 76),
    r_knee=(50, 62), r_foot=(52, 76),
)


def mirror_joints(j):
    out = {}
    swap = {
        "head": "head", "sh": "sh", "hip": "hip",
        "l_elb": "r_elb", "r_elb": "l_elb",
        "l_hand": "r_hand", "r_hand": "l_hand",
        "l_knee": "r_knee", "r_knee": "l_knee",
        "l_foot": "r_foot", "r_foot": "l_foot",
    }
    for src, dst in swap.items():
        x, y = j[src]
        out[dst] = (80 - x, y)
    return out


def frames_for(facing: str):
    if facing == "east":
        return [
            EAST_RUN[0], EAST_RUN[1], EAST_RUN[2], EAST_RUN[3],
            EAST_SHOT_L, EAST_SHOT_R, EAST_PUNCH, EAST_GRAB1, EAST_GRAB2,
        ]
    if facing == "west":
        east = frames_for("east")
        # Mirror poses, but swap shot columns so col 5 stays the left arm.
        run = [mirror_joints(j) for j in east[:4]]
        shot_l = mirror_joints(east[5])  # east right -> west left
        shot_r = mirror_joints(east[4])  # east left -> west right
        rest = [mirror_joints(j) for j in east[6:]]
        return run + [shot_l, shot_r] + rest
    if facing == "south":
        return [
            SOUTH_RUN[0], SOUTH_RUN[1], SOUTH_RUN[2], SOUTH_RUN[3],
            SOUTH_SHOT_L, SOUTH_SHOT_R, SOUTH_PUNCH, SOUTH_GRAB1, SOUTH_GRAB2,
        ]
    return [
        NORTH_RUN[0], NORTH_RUN[1], NORTH_RUN[2], NORTH_RUN[3],
        NORTH_SHOT_L, NORTH_SHOT_R, NORTH_PUNCH, NORTH_GRAB1, NORTH_GRAB2,
    ]


def shoot_side(facing: str, col: int):
    if col == 5:
        return "l"
    if col == 6:
        return "r"
    return None


def main():
    src = Image.open(SRC).convert("RGBA")
    sheet = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    for row, facing in enumerate(("south", "west", "east", "north")):
        posed = frames_for(facing)
        frames = [src.crop((0, row * FRAME, FRAME, row * FRAME + FRAME))]
        for i, joints in enumerate(posed):
            col = i + 1
            frames.append(draw_figure(facing, joints, shoot=shoot_side(facing, col)))
        for col, fr in enumerate(frames):
            sheet.paste(fr, (col * FRAME, row * FRAME))
    sheet.save(SRC)
    print("wrote", SRC, sheet.size)


if __name__ == "__main__":
    main()
