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

const GAP = 12;
const HUD_TOP = 88;
const EDGE = 10;

type Circle = Point & { r: number };

/**
 * Fighting-game pad: MOVE / AIM stay in the corners. Abilities never share a
 * circle with those sticks or with SHIELD / DASH. Short ultra-wide screens
 * use the space between the sticks; tall screens stack above the right stick.
 */
export function getTouchControlLayout(width: number, height: number): TouchControlLayout {
  const isPortrait = width < height;
  const short = Math.min(width, height);
  const tight = height < 400;
  const buttonRadius = tight ? 26 : 30;
  const abilityRadius = tight ? 28 : 32;
  const ultimateRadius = tight ? 32 : 38;
  const radius = stickRadius(short, height, buttonRadius);

  const sideInset = Math.round(Math.max(radius + 28, Math.min(short * 0.18, width * 0.16)));
  const bottomInset = Math.round(radius + (tight ? 18 : isPortrait ? 36 : 28));
  const leftStick = { x: sideInset, y: height - bottomInset };
  const rightStick = { x: width - sideInset, y: height - bottomInset };

  const rightCluster = placeRightCluster({
    width,
    height,
    tight,
    radius,
    buttonRadius,
    abilityRadius,
    rightStick,
  });

  const ultimate = placeUltimate({
    width,
    height,
    leftStick,
    rightStick,
    radius,
    ultimateRadius,
    solids: rightCluster.solids,
  });

  return {
    isPortrait,
    radius,
    buttonRadius,
    abilityRadius,
    ultimateRadius,
    leftStick,
    rightStick,
    block: rightCluster.block,
    dash: rightCluster.dash,
    ability1: rightCluster.ability1,
    ability2: rightCluster.ability2,
    ultimate,
  };
}

const stickRadius = (short: number, height: number, buttonRadius: number): number => {
  const preferred = clamp(short * 0.125, 52, 76);
  const room = height - HUD_TOP - 20 - GAP - buttonRadius * 2;
  const maxByHeight = Math.floor(room / 2);
  if (maxByHeight >= preferred) {
    return Math.round(preferred);
  }
  return Math.round(clamp(maxByHeight, 40, preferred));
};

const placeRightCluster = (options: {
  width: number;
  height: number;
  tight: boolean;
  radius: number;
  buttonRadius: number;
  abilityRadius: number;
  rightStick: Point;
}): { block: Point; dash: Point; ability1: Point; ability2: Point; solids: Circle[] } => {
  const { width, height, tight, radius, buttonRadius, abilityRadius, rightStick } = options;
  const aim: Circle = { ...rightStick, r: radius };

  const dash = clampCircle(
    {
      x: rightStick.x,
      y: rightStick.y - radius - buttonRadius - GAP,
      r: buttonRadius,
    },
    width,
    height,
  );
  pushOut(dash, aim);
  const block = clampCircle(
    {
      x: dash.x - buttonRadius * 2 - GAP,
      y: dash.y,
      r: buttonRadius,
    },
    width,
    height,
  );
  pushOut(block, aim);
  pushOut(block, dash);

  let ability1: Circle;
  let ability2: Circle;

  if (tight) {
    ability2 = clampCircle(
      {
        x: block.x - buttonRadius - abilityRadius - GAP,
        y: block.y,
        r: abilityRadius,
      },
      width,
      height,
    );
    ability1 = clampCircle(
      {
        x: ability2.x - abilityRadius * 2 - GAP,
        y: block.y,
        r: abilityRadius,
      },
      width,
      height,
    );
  } else {
    ability1 = clampCircle(
      {
        x: block.x - buttonRadius - abilityRadius - GAP,
        y: block.y,
        r: abilityRadius,
      },
      width,
      height,
    );
    ability2 = clampCircle(
      orbit(aim, abilityRadius, (-125 * Math.PI) / 180),
      width,
      height,
    );
  }

  const solids: Circle[] = [aim, dash, block];
  pushFromAll(ability1, solids);
  solids.push(ability1);
  pushFromAll(ability2, solids);
  ability2 = clampCircle(ability2, width, height);
  pushFromAll(ability2, solids);
  solids.push(ability2);

  return {
    block: point(block),
    dash: point(dash),
    ability1: point(ability1),
    ability2: point(ability2),
    solids,
  };
};

const placeUltimate = (options: {
  width: number;
  height: number;
  leftStick: Point;
  rightStick: Point;
  radius: number;
  ultimateRadius: number;
  solids: Circle[];
}): Point => {
  const { width, height, leftStick, rightStick, radius, ultimateRadius, solids } = options;
  const move: Circle = { ...leftStick, r: radius };
  const aim: Circle = { ...rightStick, r: radius };
  const midX = (leftStick.x + rightStick.x) / 2;
  const ult: Circle = { x: midX, y: leftStick.y, r: ultimateRadius };
  if (circlesOverlap(ult, move) || circlesOverlap(ult, aim)) {
    ult.y = leftStick.y - radius - ultimateRadius - GAP;
  }

  const blockers = [move, aim, ...solids.filter((circle) => circle !== aim)];
  pushFromAll(ult, blockers);
  const clamped = clampCircle(ult, width, height);
  pushFromAll(clamped, blockers);
  return point(clamped);
};

const orbit = (center: Circle, radius: number, angle: number): Circle => {
  const dist = center.r + radius + GAP;
  return {
    x: center.x + Math.cos(angle) * dist,
    y: center.y + Math.sin(angle) * dist,
    r: radius,
  };
};

const pushFromAll = (movable: Circle, solids: Circle[]): void => {
  for (let i = 0; i < 4; i += 1) {
    for (const solid of solids) {
      if (solid === movable) {
        continue;
      }
      pushOut(movable, solid);
    }
  }
};

const pushOut = (movable: Circle, solid: Circle): void => {
  const dx = movable.x - solid.x;
  const dy = movable.y - solid.y;
  const dist = Math.hypot(dx, dy);
  const need = movable.r + solid.r + GAP;
  if (dist >= need) {
    return;
  }
  if (dist < 0.001) {
    movable.x = solid.x - need;
    return;
  }
  const scale = need / dist;
  movable.x = solid.x + dx * scale;
  movable.y = solid.y + dy * scale;
};

const clampCircle = (circle: Circle, width: number, height: number): Circle => ({
  x: clamp(circle.x, circle.r + EDGE, width - circle.r - EDGE),
  y: clamp(circle.y, HUD_TOP + circle.r, height - circle.r - EDGE),
  r: circle.r,
});

const point = (circle: Circle): Point => ({ x: Math.round(circle.x), y: Math.round(circle.y) });

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Used by layout checks: true when two control circles collide. */
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
