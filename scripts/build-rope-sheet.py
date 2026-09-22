#!/usr/bin/env python3
"""Rope Man sheet.

Col 0 is the original crouched idle, copied unchanged.
Cols 1-8 are an 8-frame run (contact, recoil, pass, reach, then the
opposite stride) matching the wrapped-mummy reference: round head, coiled
body, mitten fists, stub feet, orange triangle eyes, black outline.
Cols 9-10 are alternating arm shots with a rope leaving the firing fist.
Cols 11-13 are punch and the two grab reaches, in the same body language.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

FRAME = 80
WALK = 8
# idle + walk*8 + shotL + shotR + punch + grab + grab2
COLS = 1 + WALK + 5
ROWS = 4
SRC = Path("assets/heroes/rope.png")

OUT = (17, 4, 28, 255)
ROPE = (122, 75, 53, 255)
LIGHT = (132, 77, 50, 255)
HI = (148, 90, 56, 255)
MID = (102, 64, 52, 255)
DARK = (78, 47, 42, 255)
DEEP = (45, 28, 41, 255)
EYE = (252, 102, 28, 255)

SHOT_L = 1 + WALK
SHOT_R = SHOT_L + 1
PUNCH = SHOT_R + 1
GRAB = PUNCH + 1
GRAB2 = GRAB + 1


def new_buf():
    return [[None] * FRAME for _ in range(FRAME)]


def plot(buf, x, y, c):
    ix, iy = int(round(x)), int(round(y))
    if 0 <= ix < FRAME and 0 <= iy < FRAME and c is not None:
        buf[iy][ix] = c


def hypot(dx, dy):
    return (dx * dx + dy * dy) ** 0.5


def wrap_color(along, ny, radius):
    """Hard bandage bands across the limb, darker on the underside."""
    phase = along % 4.4
    if phase < 0.9:
        base = DEEP
    elif phase < 1.7:
        base = DARK
    elif phase < 3.15:
        base = ROPE
    else:
        base = LIGHT
    if ny > radius * 0.42:
        if base == LIGHT:
            return ROPE
        if base == ROPE:
            return MID
        if base == DARK:
            return DEEP
    elif ny < -radius * 0.38 and base == ROPE:
        return HI
    return base


def capsule(buf, x0, y0, x1, y1, r0, r1):
    dx, dy = x1 - x0, y1 - y0
    length = max(0.001, hypot(dx, dy))
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    pad = int(max(r0, r1) + 2)
    for y in range(int(min(y0, y1) - pad), int(max(y0, y1) + pad + 1)):
        for x in range(int(min(x0, x1) - pad), int(max(x0, x1) + pad + 1)):
            wx, wy = x + 0.5, y + 0.5
            t = ((wx - x0) * ux + (wy - y0) * uy) / length
            t_clamped = min(1.0, max(0.0, t))
            cx = x0 + dx * t_clamped
            cy = y0 + dy * t_clamped
            r = r0 + (r1 - r0) * t_clamped
            ddx, ddy = wx - cx, wy - cy
            if ddx * ddx + ddy * ddy > r * r:
                continue
            nx = ddx * px + ddy * py
            ny = ddx * ux + ddy * uy
            plot(buf, x, y, wrap_color(t_clamped * length, ny, r))


def disc(buf, cx, cy, r, along0=0.0):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if dx * dx + dy * dy > r * r:
                continue
            plot(buf, x, y, wrap_color(along0 + dy * 0.85, dy, r))


def ellipse(buf, cx, cy, rx, ry, along0=0.0):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if dx * dx + dy * dy > 1:
                continue
            plot(buf, x, y, wrap_color(along0 + (y - cy), (y + 0.5 - cy), ry))


def head(buf, cx, cy, r):
    """Round wrapped skull. Crossing bands, no face."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if dx * dx + dy * dy > r * r:
                continue
            # Stay off the rim so the outline stays a clean ring.
            edge = dx * dx + dy * dy > (r - 1.15) * (r - 1.15)
            lattice = (int(dx + dy) % 4 == 0) or (int(dx - dy) % 5 == 0)
            if lattice and not edge:
                plot(buf, x, y, DEEP if (int(dx + dy) % 8 < 4) else DARK)
            elif dy > r * 0.35:
                plot(buf, x, y, MID)
            elif dy < -r * 0.15:
                plot(buf, x, y, LIGHT if (int(dx) % 3) else HI)
            else:
                plot(buf, x, y, ROPE)


def fist(buf, hx, hy, dx, dy):
    mag = max(0.001, hypot(dx, dy))
    ux, uy = dx / mag, dy / mag
    disc(buf, hx + ux * 0.8, hy + uy * 0.8, 3.55, along0=hx)


def stub_foot(buf, fx, fy, facing):
    if facing == "east":
        ellipse(buf, fx + 1.2, fy + 0.3, 4.6, 2.7, along0=fy)
    elif facing == "west":
        ellipse(buf, fx - 1.2, fy + 0.3, 4.6, 2.7, along0=fy)
    else:
        ellipse(buf, fx, fy + 0.8, 3.7, 2.8, along0=fy)


def outline(buf):
    filled = [
        (x, y)
        for y in range(FRAME)
        for x in range(FRAME)
        if buf[y][x] not in (None, OUT, EYE)
    ]
    marks = []
    for x, y in filled:
        for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            nx, ny = x + ox, y + oy
            if 0 <= nx < FRAME and 0 <= ny < FRAME and buf[ny][nx] is None:
                marks.append((nx, ny))
    for x, y in marks:
        if buf[y][x] is None:
            buf[y][x] = OUT


def eye_at(buf, cx, cy, facing):
    """Small orange triangle. South has two, profiles have one on the face side."""
    if facing == "north":
        return
    if facing == "south":
        for dx in (-5, 5):
            ox = cx + dx
            plot(buf, ox, cy, EYE)
            plot(buf, ox - 1, cy + 1, EYE)
            plot(buf, ox, cy + 1, EYE)
            plot(buf, ox - 1, cy + 2, EYE)
            plot(buf, ox, cy + 2, EYE)
            plot(buf, ox + 1, cy + 2, EYE)
            plot(buf, ox, cy + 3, EYE)
            plot(buf, ox + 1, cy + 3, EYE)
        return
    # Profile triangle points along the facing.
    sign = 1 if facing == "east" else -1
    plot(buf, cx, cy, EYE)
    plot(buf, cx, cy + 1, EYE)
    plot(buf, cx + sign, cy + 1, EYE)
    plot(buf, cx, cy + 2, EYE)
    plot(buf, cx + sign, cy + 2, EYE)
    plot(buf, cx + sign * 2, cy + 2, EYE)


def rope_strand(buf, hx, hy, dx, dy, length=13):
    """Thin coiled rope leaving the fist, drawn after the body outline."""
    mag = max(0.001, hypot(dx, dy))
    ux, uy = dx / mag, dy / mag
    px, py = -uy, ux
    pts = []
    for i in range(length):
        wave = 0.55 if (i // 2) % 2 == 0 else -0.55
        pts.append((hx + ux * (i + 4.2) + px * wave, hy + uy * (i + 4.2) + py * wave))
    for x, y in pts:
        for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            plot(buf, x + ox, y + oy, OUT)
    for i, (x, y) in enumerate(pts):
        plot(buf, x, y, DARK if i % 3 == 0 else LIGHT)


def to_image(buf) -> Image.Image:
    img = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    px = img.load()
    for y in range(FRAME):
        for x in range(FRAME):
            if buf[y][x] is not None:
                px[x, y] = buf[y][x]
    return img


def draw_figure(facing, joints, shoot=None) -> Image.Image:
    buf = new_buf()
    head_p, sh, hip = joints["head"], joints["sh"], joints["hip"]

    def arm_dir(side):
        hand = joints[f"{side}_hand"]
        return (hand[0] - sh[0], hand[1] - sh[1])

    def draw_arm(side):
        elb = joints[f"{side}_elb"]
        hand = joints[f"{side}_hand"]
        sx = sh[0] + (-4.5 if side == "l" else 4.5)
        if facing == "east":
            sx = sh[0] + (-2.2 if side == "l" else 3.2)
        elif facing == "west":
            sx = sh[0] + (-3.2 if side == "l" else 2.2)
        capsule(buf, sx, sh[1] + 2, elb[0], elb[1], 3.25, 2.75)
        capsule(buf, elb[0], elb[1], hand[0], hand[1], 2.75, 2.45)
        dx, dy = arm_dir(side)
        fist(buf, hand[0], hand[1], dx, dy)

    def draw_leg(side):
        knee = joints[f"{side}_knee"]
        ft = joints[f"{side}_foot"]
        hx = hip[0] + (-3.2 if side == "l" else 3.2)
        if facing in ("east", "west"):
            hx = hip[0] + (1.4 if facing == "east" else -1.4)
        capsule(buf, hx, hip[1] + 1, knee[0], knee[1], 4.05, 3.35)
        capsule(buf, knee[0], knee[1], ft[0], ft[1], 3.35, 2.75)
        stub_foot(buf, ft[0], ft[1], facing)

    def depth(side, kind):
        pt = joints[f"{side}_foot" if kind == "leg" else f"{side}_hand"]
        if facing == "east":
            return pt[0]
        if facing == "west":
            return -pt[0]
        # Lower on the screen is closer, except a limb tagged in front.
        return pt[1]

    order = [("arm", "l"), ("arm", "r"), ("leg", "l"), ("leg", "r")]
    forced = joints.get("front")
    if forced:
        front = []
        for tag in forced:
            kind, side = tag.split(":")
            front.append((kind, side))
        front_set = set(front)
        back = [item for item in order if item not in front_set]
    else:
        order.sort(key=lambda item: depth(item[1], item[0]))
        back, front = order[:-2], order[-2:]

    for kind, side in back:
        if kind == "arm":
            draw_arm(side)
        else:
            draw_leg(side)

    capsule(buf, head_p[0], head_p[1] + 7, sh[0], sh[1] + 1, 4.6, 5.6)
    capsule(buf, sh[0], sh[1] + 2, hip[0], hip[1], 6.15, 5.05)
    disc(buf, sh[0], sh[1] + 3, 5.7, along0=sh[1])
    disc(buf, hip[0], hip[1], 5.15, along0=hip[1])

    for kind, side in front:
        if kind == "arm":
            draw_arm(side)
        else:
            draw_leg(side)

    # Skull stays a clean wrapped ball even when a fist crosses the chest.
    head(buf, head_p[0], head_p[1], 8.7)
    outline(buf)
    eye_dx = 4 if facing == "east" else (-4 if facing == "west" else 0)
    eye_at(buf, head_p[0] + eye_dx, head_p[1] - 1, facing)
    if shoot:
        hand = joints[f"{shoot}_hand"]
        dx, dy = joints.get("rope", arm_dir(shoot))
        rope_strand(buf, hand[0], hand[1], dx, dy, joints.get("rope_len", 12))
    return to_image(buf)


def J(**kwargs):
    return kwargs


def lerp_pt(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def lerp_pose(a, b, t):
    out = {}
    for key in a:
        if key in ("rope", "rope_len"):
            continue
        out[key] = lerp_pt(a[key], b[key], t)
    return out


def shift_pose(pose, dy):
    return {k: (v[0], v[1] + dy) if isinstance(v, tuple) else v for k, v in pose.items()}


# East faces right. Eight unique silhouettes — the opposite stride is not a
# relabel, or the outline would repeat and the run would stutter.
EAST_RUN = [
    J(  # contact: near arm forward at the chest, far leg reaching
        head=(48, 16), sh=(41, 30), hip=(35, 46),
        r_elb=(54, 30), r_hand=(66, 28),
        l_elb=(28, 36), l_hand=(16, 42),
        l_knee=(50, 56), l_foot=(62, 70),
        r_knee=(20, 60), r_foot=(8, 72),
        front=("arm:r", "leg:l"), lift=0,
    ),
    J(  # recoil: weight on the front leg, back foot kicked up
        head=(45, 18), sh=(39, 32), hip=(36, 48),
        r_elb=(50, 34), r_hand=(58, 38),
        l_elb=(30, 34), l_hand=(22, 30),
        l_knee=(46, 60), l_foot=(50, 74),
        r_knee=(26, 50), r_foot=(18, 58),
        front=("arm:r", "leg:l"), lift=0,
    ),
    J(  # pass: limbs gathered, body up
        head=(43, 13), sh=(39, 26), hip=(38, 42),
        r_elb=(46, 32), r_hand=(44, 42),
        l_elb=(32, 24), l_hand=(28, 16),
        l_knee=(42, 54), l_foot=(40, 66),
        r_knee=(34, 54), r_foot=(32, 68),
        lift=4,
    ),
    J(  # far arm drives forward above the near arm, near leg reaches
        head=(46, 14), sh=(40, 28), hip=(36, 44),
        l_elb=(54, 22), l_hand=(66, 18),
        r_elb=(30, 36), r_hand=(18, 44),
        r_knee=(52, 54), r_foot=(64, 66),
        l_knee=(24, 56), l_foot=(14, 68),
        front=("arm:l", "leg:r"), lift=2,
    ),
    J(  # opposite contact: far arm extended, near leg forward, longer trail
        head=(49, 16), sh=(42, 30), hip=(34, 46),
        l_elb=(56, 22), l_hand=(70, 20),
        r_elb=(28, 38), r_hand=(14, 46),
        r_knee=(52, 58), r_foot=(64, 72),
        l_knee=(18, 58), l_foot=(6, 70),
        front=("arm:l", "leg:r"), lift=0,
    ),
    J(
        head=(46, 18), sh=(40, 32), hip=(36, 48),
        l_elb=(50, 26), l_hand=(58, 22),
        r_elb=(32, 40), r_hand=(24, 48),
        r_knee=(46, 60), r_foot=(48, 74),
        l_knee=(24, 48), l_foot=(16, 56),
        front=("arm:l", "leg:r"), lift=0,
    ),
    J(
        head=(43, 13), sh=(39, 26), hip=(38, 42),
        l_elb=(46, 30), l_hand=(48, 40),
        r_elb=(32, 28), r_hand=(26, 18),
        r_knee=(42, 54), r_foot=(44, 66),
        l_knee=(32, 54), l_foot=(30, 68),
        lift=4,
    ),
    J(  # near arm coming back through, far leg starting to reach
        head=(46, 14), sh=(40, 28), hip=(36, 44),
        r_elb=(52, 26), r_hand=(62, 24),
        l_elb=(30, 32), l_hand=(20, 38),
        l_knee=(48, 52), l_foot=(58, 64),
        r_knee=(26, 56), r_foot=(18, 68),
        front=("arm:r", "leg:l"), lift=2,
    ),
]

EAST_SHOT_L = J(
    head=(42, 16), sh=(38, 30), hip=(38, 48),
    l_elb=(52, 24), l_hand=(64, 22),
    r_elb=(28, 38), r_hand=(20, 46),
    l_knee=(30, 62), l_foot=(28, 74),
    r_knee=(48, 62), r_foot=(50, 74),
    front=("arm:l", "leg:r"),
    rope=(1.0, -0.05), rope_len=12,
)
EAST_SHOT_R = J(
    head=(42, 16), sh=(38, 30), hip=(38, 48),
    r_elb=(54, 34), r_hand=(68, 36),
    l_elb=(26, 26), l_hand=(16, 18),
    l_knee=(30, 62), l_foot=(28, 74),
    r_knee=(48, 62), r_foot=(50, 74),
    front=("arm:r", "leg:l"),
    rope=(1.0, 0.08), rope_len=12,
)
EAST_PUNCH = J(
    head=(48, 16), sh=(42, 29), hip=(36, 48),
    r_elb=(60, 26), r_hand=(74, 24),
    l_elb=(28, 36), l_hand=(18, 46),
    l_knee=(32, 64), l_foot=(28, 75),
    r_knee=(50, 62), r_foot=(54, 75),
)
EAST_GRAB = J(
    head=(42, 16), sh=(39, 30), hip=(38, 49),
    r_elb=(56, 18), r_hand=(70, 10),
    l_elb=(46, 16), l_hand=(58, 6),
    l_knee=(30, 64), l_foot=(28, 75),
    r_knee=(48, 64), r_foot=(50, 75),
)
EAST_GRAB2 = J(
    head=(42, 15), sh=(39, 29), hip=(38, 49),
    r_elb=(54, 12), r_hand=(66, 3),
    l_elb=(44, 10), l_hand=(56, 1),
    l_knee=(30, 64), l_foot=(28, 75),
    r_knee=(48, 64), r_foot=(50, 75),
)

# South faces the camera. Left leg up, right arm punched forward, left arm cocked back.
SOUTH_CONTACT = J(
    head=(40, 14), sh=(40, 28), hip=(40, 46),
    # Raised leg crosses the chest; the opposite arm punches out the other way.
    l_knee=(30, 46), l_foot=(34, 34),
    r_knee=(52, 60), r_foot=(54, 74),
    r_elb=(54, 38), r_hand=(66, 44),
    l_elb=(24, 24), l_hand=(14, 16),
    front=("leg:l", "arm:r"),
    lift=0,
)
SOUTH_RECOIL = J(
    head=(40, 16), sh=(40, 30), hip=(40, 48),
    l_knee=(32, 56), l_foot=(30, 68),
    r_knee=(50, 62), r_foot=(52, 75),
    r_elb=(52, 36), r_hand=(58, 48),
    l_elb=(28, 24), l_hand=(20, 16),
    front=("leg:l", "arm:r"),
    lift=0,
)
SOUTH_PASS = J(
    head=(40, 11), sh=(40, 25), hip=(40, 43),
    l_knee=(33, 56), l_foot=(31, 70),
    r_knee=(47, 56), r_foot=(49, 70),
    l_elb=(26, 32), l_hand=(18, 42),
    r_elb=(54, 26), r_hand=(62, 18),
)
SOUTH_REACH = J(
    head=(40, 10), sh=(40, 23), hip=(40, 41),
    r_knee=(48, 48), r_foot=(54, 36),
    l_knee=(32, 58), l_foot=(28, 72),
    l_elb=(24, 36), l_hand=(14, 48),
    r_elb=(56, 18), r_hand=(66, 10),
    front=("leg:r", "arm:l"),
    lift=3,
)

SOUTH_SHOT_L = J(
    head=(40, 15), sh=(40, 29), hip=(40, 48),
    l_elb=(24, 34), l_hand=(12, 36),
    r_elb=(52, 26), r_hand=(58, 18),
    l_knee=(32, 62), l_foot=(30, 74),
    r_knee=(50, 62), r_foot=(52, 74),
    front=("arm:l",),
    rope=(-1.0, 0.2), rope_len=12,
)
SOUTH_SHOT_R = J(
    head=(40, 15), sh=(40, 29), hip=(40, 48),
    r_elb=(56, 34), r_hand=(68, 36),
    l_elb=(28, 26), l_hand=(22, 18),
    l_knee=(32, 62), l_foot=(30, 74),
    r_knee=(50, 62), r_foot=(52, 74),
    front=("arm:r",),
    rope=(1.0, 0.2), rope_len=12,
)
SOUTH_PUNCH = J(
    head=(40, 15), sh=(40, 29), hip=(40, 49),
    r_elb=(52, 22), r_hand=(60, 8),
    l_elb=(26, 40), l_hand=(18, 52),
    l_knee=(32, 64), l_foot=(30, 75),
    r_knee=(50, 60), r_foot=(56, 75),
)
SOUTH_GRAB = J(
    head=(40, 15), sh=(40, 29), hip=(40, 49),
    l_elb=(26, 16), l_hand=(16, 5),
    r_elb=(54, 16), r_hand=(64, 5),
    l_knee=(32, 64), l_foot=(30, 75),
    r_knee=(50, 64), r_foot=(52, 75),
)
SOUTH_GRAB2 = J(
    head=(40, 14), sh=(40, 28), hip=(40, 49),
    l_elb=(24, 12), l_hand=(14, 1),
    r_elb=(56, 12), r_hand=(66, 1),
    l_knee=(32, 64), l_foot=(30, 75),
    r_knee=(50, 64), r_foot=(52, 75),
)

# North is the back. No eyes. The lifted leg and the opposite arm reach away (up).
NORTH_CONTACT = J(
    head=(40, 13), sh=(40, 27), hip=(40, 45),
    r_knee=(52, 42), r_foot=(58, 30),
    l_knee=(28, 60), l_foot=(24, 74),
    l_elb=(24, 20), l_hand=(14, 10),
    r_elb=(52, 38), r_hand=(58, 52),
    # Trailing leg and the arm hanging toward the camera sit in front of the back.
    front=("leg:l", "arm:r"),
    lift=0,
)
NORTH_RECOIL = J(
    head=(40, 16), sh=(40, 30), hip=(40, 48),
    r_knee=(48, 54), r_foot=(50, 66),
    l_knee=(30, 62), l_foot=(28, 75),
    l_elb=(28, 26), l_hand=(20, 16),
    r_elb=(52, 36), r_hand=(58, 46),
)
NORTH_PASS = J(
    head=(40, 11), sh=(40, 25), hip=(40, 43),
    l_knee=(33, 56), l_foot=(31, 70),
    r_knee=(47, 56), r_foot=(49, 70),
    r_elb=(54, 24), r_hand=(62, 14),
    l_elb=(26, 32), l_hand=(18, 42),
)
NORTH_REACH = J(
    head=(40, 10), sh=(40, 23), hip=(40, 41),
    l_knee=(28, 46), l_foot=(22, 34),
    r_knee=(50, 58), r_foot=(54, 72),
    r_elb=(56, 18), r_hand=(66, 8),
    l_elb=(26, 36), l_hand=(18, 48),
    front=("leg:r", "arm:l"),
    lift=3,
)
NORTH_SHOT_L = J(
    head=(40, 15), sh=(40, 29), hip=(40, 48),
    l_elb=(24, 26), l_hand=(12, 22),
    r_elb=(52, 36), r_hand=(58, 46),
    l_knee=(32, 62), l_foot=(30, 74),
    r_knee=(50, 62), r_foot=(52, 74),
    front=("arm:l",),
    rope=(-1.0, -0.25), rope_len=12,
)
NORTH_SHOT_R = J(
    head=(40, 15), sh=(40, 29), hip=(40, 48),
    r_elb=(56, 26), r_hand=(68, 22),
    l_elb=(28, 36), l_hand=(22, 46),
    l_knee=(32, 62), l_foot=(30, 74),
    r_knee=(50, 62), r_foot=(52, 74),
    front=("arm:r",),
    rope=(1.0, -0.25), rope_len=12,
)
NORTH_PUNCH = J(
    head=(40, 15), sh=(40, 29), hip=(40, 49),
    r_elb=(54, 20), r_hand=(64, 8),
    l_elb=(28, 36), l_hand=(22, 48),
    l_knee=(32, 64), l_foot=(30, 75),
    r_knee=(50, 60), r_foot=(56, 75),
)
NORTH_GRAB = J(
    head=(40, 15), sh=(40, 29), hip=(40, 49),
    l_elb=(26, 14), l_hand=(16, 3),
    r_elb=(54, 14), r_hand=(64, 3),
    l_knee=(32, 64), l_foot=(30, 75),
    r_knee=(50, 64), r_foot=(52, 75),
)
NORTH_GRAB2 = J(
    head=(40, 14), sh=(40, 28), hip=(40, 49),
    l_elb=(24, 10), l_hand=(14, 1),
    r_elb=(56, 10), r_hand=(66, 1),
    l_knee=(32, 64), l_foot=(30, 75),
    r_knee=(50, 64), r_foot=(52, 75),
)


def _flip_front(tags):
    flipped = []
    for tag in tags:
        kind, side = tag.split(":")
        flipped.append(f"{kind}:{'r' if side == 'l' else 'l'}")
    return tuple(flipped)


def swap_sides(pose):
    """Opposite stride, same facing. Limb coordinates trade sides."""
    out = dict(pose)
    for a, b in (
        ("l_elb", "r_elb"),
        ("l_hand", "r_hand"),
        ("l_knee", "r_knee"),
        ("l_foot", "r_foot"),
    ):
        out[a], out[b] = pose[b], pose[a]
    if "front" in pose:
        out["front"] = _flip_front(pose["front"])
    return out


def mirror_pose(pose):
    """Horizontal mirror plus side swap, so a front view's other stride stays frontal."""
    out = {}
    swap = {
        "head": "head", "sh": "sh", "hip": "hip",
        "l_elb": "r_elb", "r_elb": "l_elb",
        "l_hand": "r_hand", "r_hand": "l_hand",
        "l_knee": "r_knee", "r_knee": "l_knee",
        "l_foot": "r_foot", "r_foot": "l_foot",
    }
    for src, dst in swap.items():
        x, y = pose[src]
        out[dst] = (FRAME - x, y)
    if "rope" in pose:
        dx, dy = pose["rope"]
        out["rope"] = (-dx, dy)
        out["rope_len"] = pose.get("rope_len", 14)
    if "front" in pose:
        out["front"] = _flip_front(pose["front"])
    if "lift" in pose:
        out["lift"] = pose["lift"]
    return out


def cycle(contact, recoil, passing, reach, opposite):
    first = [contact, recoil, passing, reach]
    return first + [opposite(p) for p in first]


def poses_for(facing):
    if facing == "east":
        return EAST_RUN + [EAST_SHOT_L, EAST_SHOT_R, EAST_PUNCH, EAST_GRAB, EAST_GRAB2]
    if facing == "south":
        run = cycle(SOUTH_CONTACT, SOUTH_RECOIL, SOUTH_PASS, SOUTH_REACH, mirror_pose)
        return run + [SOUTH_SHOT_L, SOUTH_SHOT_R, SOUTH_PUNCH, SOUTH_GRAB, SOUTH_GRAB2]
    if facing == "north":
        run = cycle(NORTH_CONTACT, NORTH_RECOIL, NORTH_PASS, NORTH_REACH, mirror_pose)
        return run + [NORTH_SHOT_L, NORTH_SHOT_R, NORTH_PUNCH, NORTH_GRAB, NORTH_GRAB2]
    east = poses_for("east")
    # Mirror the east row, then put the anatomical left shot back in the left column.
    mirrored = []
    for pose in east:
        mirrored.append(mirror_pose(pose))
    run = mirrored[:WALK]
    shot_l = mirrored[SHOT_R - 1]
    shot_r = mirrored[SHOT_L - 1]
    rest = mirrored[PUNCH - 1 :]
    return run + [shot_l, shot_r] + rest


def shoot_side(col):
    if col == SHOT_L:
        return "l"
    if col == SHOT_R:
        return "r"
    return None


def align_frame(img: Image.Image, pose) -> Image.Image:
    """Stack the hip, and keep a lifted stride above the planted frames."""
    bbox = img.getbbox()
    if bbox is None:
        return img
    dx = int(round(40 - pose["hip"][0]))
    lower = max(pose["l_foot"][1], pose["r_foot"][1])
    lift = pose.get("lift", 0)
    dy = int(round((75 - lift) - lower))
    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    out.paste(img, (dx, dy), img)
    return out


def render_pose(facing, pose, shoot) -> Image.Image:
    return align_frame(draw_figure(facing, pose, shoot=shoot), pose)


def main():
    src = Image.open(SRC).convert("RGBA")
    sheet = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    for row, facing in enumerate(("south", "west", "east", "north")):
        idle = src.crop((0, row * FRAME, FRAME, row * FRAME + FRAME))
        sheet.paste(idle, (0, row * FRAME))
        posed = poses_for(facing)
        for i, pose in enumerate(posed):
            col = i + 1
            frame = render_pose(facing, pose, shoot_side(col))
            sheet.paste(frame, (col * FRAME, row * FRAME))
    sheet.save(SRC)
    print("wrote", SRC, sheet.size, "cols", COLS)


if __name__ == "__main__":
    main()
