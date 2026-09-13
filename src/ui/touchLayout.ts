import { clamp, measureViewport } from './layout/viewport';

export type Point = { x: number; y: number };

export type TouchControlLayout = {
  isPortrait: boolean;
  radius: number;
  buttonRadius: number;
  abilityRadius: number;
  ultimateRadius: number;
  leftStick: Point;
  rightStick: Point;
  block: Point;
  dash: Point;
  ability1: Point;
  ability2: Point;
  ultimate: Point;
};

type Circle = Point & { r: number };

const GAP = 8;
const RIGHT_BAND = 0.58;

/**
 * Fighting-game pad: MOVE on the left, AIM + actions on the right.
 * Nothing is allowed to sit in the middle of the battlefield.
 */
export function getTouchControlLayout(width: number, height: number): TouchControlLayout {
  const frame = measureViewport(width, height, true);
  const isPortrait = frame.isPortrait;
  const inset = frame.controlInset;
  const short = Math.min(width, height);
  const gap = Math.max(GAP, Math.round(short * 0.014));
  const rightMin = width * RIGHT_BAND;
  const rightEdge = width - inset.right;
  const bottom = height - inset.bottom;
  const top = inset.top;

  const tablet = frame.isTablet;
  let radius = Math.round(
    tablet
      ? clamp(short * (isPortrait ? 0.092 : 0.1), 56, 78)
      : isPortrait
        ? clamp(short * 0.128, 50, 68)
        : clamp(short * 0.122, 44, 58),
  );
  let buttonRadius = Math.round(
    clamp(radius * 0.56, tablet ? 28 : isPortrait ? 28 : 24, tablet ? 38 : isPortrait ? 34 : 32),
  );
  let abilityRadius = Math.round(
    clamp(radius * 0.58, tablet ? 30 : isPortrait ? 30 : 26, tablet ? 40 : isPortrait ? 36 : 34),
  );
  let ultimateRadius = Math.round(
    clamp(radius * 0.62, tablet ? 32 : isPortrait ? 32 : 28, tablet ? 42 : isPortrait ? 38 : 36),
  );

  const fits = (stickR: number, btnR: number, abilR: number, ultR: number): boolean => {
    const packed = pack(stickR, btnR, abilR, ultR, {
      isPortrait,
      gap,
      rightMin,
      rightEdge,
      bottom,
      top,
      left: inset.left,
    });
    return !packOverlaps(packed) && packInBand(packed, rightMin, width, inset.left, top, rightEdge, bottom);
  };

  while (radius > 36 && !fits(radius, buttonRadius, abilityRadius, ultimateRadius)) {
    radius -= 1;
    buttonRadius = Math.round(clamp(radius * 0.56, 22, 32));
    abilityRadius = Math.round(clamp(radius * 0.58, 24, 34));
    ultimateRadius = Math.round(clamp(radius * 0.62, 26, 36));
  }

  const packed = pack(radius, buttonRadius, abilityRadius, ultimateRadius, {
    isPortrait,
    gap,
    rightMin,
    rightEdge,
    bottom,
    top,
    left: inset.left,
  });

  return {
    isPortrait,
    radius,
    buttonRadius,
    abilityRadius,
    ultimateRadius,
    leftStick: point(packed.move),
    rightStick: point(packed.aim),
    block: point(packed.block),
    dash: point(packed.dash),
    ability1: point(packed.ability1),
    ability2: point(packed.ability2),
    ultimate: point(packed.ultimate),
  };
}

type PackOpts = {
  isPortrait: boolean;
  gap: number;
  rightMin: number;
  rightEdge: number;
  bottom: number;
  top: number;
  left: number;
};

type Packed = {
  move: Circle;
  aim: Circle;
  dash: Circle;
  block: Circle;
  ability1: Circle;
  ability2: Circle;
  ultimate: Circle;
};

const pack = (
  stickR: number,
  btnR: number,
  abilR: number,
  ultR: number,
  opts: PackOpts,
): Packed => {
  const { isPortrait, gap, rightMin, rightEdge, bottom, top, left } = opts;
  const move: Circle = {
    x: left + stickR,
    y: bottom - stickR,
    r: stickR,
  };
  const aim: Circle = {
    x: rightEdge - stickR,
    y: bottom - stickR,
    r: stickR,
  };
  const colSpan = Math.max(btnR, abilR) * 2 + gap;
  const dash: Circle = {
    x: aim.x,
    y: aim.y - stickR - btnR - gap,
    r: btnR,
  };
  const block: Circle = {
    x: dash.x - colSpan,
    y: dash.y,
    r: btnR,
  };
  if (block.x < rightMin + btnR) {
    block.x = rightMin + btnR;
  }
  const ability2: Circle = {
    x: dash.x,
    y: dash.y - btnR - abilR - gap,
    r: abilR,
  };
  const ability1: Circle = {
    x: Math.min(block.x, dash.x - colSpan),
    y: ability2.y,
    r: abilR,
  };
  const aboveY = Math.min(ability1.y, ability2.y) - abilR - ultR - gap;
  let ultimate: Circle;
  if (isPortrait && aboveY >= top + ultR) {
    ultimate = {
      x: (ability1.x + ability2.x) / 2,
      y: aboveY,
      r: ultR,
    };
  } else {
    ultimate = {
      x: ability1.x - abilR - ultR - gap,
      y: ability1.y,
      r: ultR,
    };
    if (ultimate.x < rightMin + ultR) {
      ultimate = {
        x: block.x - btnR - ultR - gap,
        y: block.y,
        r: ultR,
      };
    }
    if (ultimate.x < rightMin + ultR) {
      ultimate = {
        x: Math.max(rightMin + ultR, (ability1.x + ability2.x) / 2),
        y: Math.max(top + ultR, aboveY),
        r: ultR,
      };
    }
  }
  return { move, aim, dash, block, ability1, ability2, ultimate };
};

const packList = (packed: Packed): Circle[] => [
  packed.move,
  packed.aim,
  packed.dash,
  packed.block,
  packed.ability1,
  packed.ability2,
  packed.ultimate,
];

const packOverlaps = (packed: Packed): boolean => {
  const items = packList(packed);
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (circlesOverlap(items[i], items[j])) {
        return true;
      }
    }
  }
  return false;
};

const packInBand = (
  packed: Packed,
  rightMin: number,
  width: number,
  left: number,
  top: number,
  rightEdge: number,
  bottom: number,
): boolean => {
  const right = [packed.aim, packed.dash, packed.block, packed.ability1, packed.ability2, packed.ultimate];
  for (const circle of right) {
    if (circle.x < rightMin) {
      return false;
    }
    if (circle.x + circle.r > rightEdge + 0.5) {
      return false;
    }
    if (circle.y - circle.r < top - 0.5 || circle.y + circle.r > bottom + 0.5) {
      return false;
    }
  }
  if (packed.move.x - packed.move.r < left - 0.5) {
    return false;
  }
  if (packed.move.x > width * 0.32) {
    return false;
  }
  if (Math.abs(packed.ultimate.x - width / 2) < width * 0.16) {
    return false;
  }
  return packed.move.y + packed.move.r <= bottom + 0.5 && packed.move.y - packed.move.r >= top - 0.5;
};

const point = (circle: Circle): Point => ({ x: Math.round(circle.x), y: Math.round(circle.y) });

export const circlesOverlap = (a: Circle, b: Circle, extra = GAP): boolean =>
  Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + extra - 0.5;

export const findLayoutOverlaps = (width: number, height: number): string[] => {
  const layout = getTouchControlLayout(width, height);
  const named: [string, Circle][] = [
    ['MOVE', { ...layout.leftStick, r: layout.radius }],
    ['AIM', { ...layout.rightStick, r: layout.radius }],
    ['SHIELD', { ...layout.block, r: layout.buttonRadius }],
    ['DASH', { ...layout.dash, r: layout.buttonRadius }],
    ['A1', { ...layout.ability1, r: layout.abilityRadius }],
    ['A2', { ...layout.ability2, r: layout.abilityRadius }],
    ['ULT', { ...layout.ultimate, r: layout.ultimateRadius }],
  ];
  const hits: string[] = [];
  for (let i = 0; i < named.length; i += 1) {
    for (let j = i + 1; j < named.length; j += 1) {
      if (circlesOverlap(named[i][1], named[j][1])) {
        hits.push(`${named[i][0]} x ${named[j][0]}`);
      }
    }
  }
  return hits;
};
