import type { HouseDoor, HouseDoorSide } from '../../map/types';
import type { HouseFact } from '../../map/EnvironmentWorld';
import type { CombatantView, ScoredAction, Situation, TacticalAction } from './types';
import type { MoveHint } from './move';

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

const insideHouse = (x: number, y: number, house: HouseFact): boolean => {
  const r = house.interior;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
};

const doorOf = (house: HouseFact, side: HouseDoorSide): HouseDoor =>
  house.doors.find((door) => door.side === side) ?? house.doors[0];

const nearestDoor = (x: number, y: number, house: HouseFact): HouseDoor => {
  let best = house.doors[0];
  let bestD = Infinity;
  for (const door of house.doors) {
    const d = dist(x, y, door.x, door.y);
    if (d < bestD) {
      best = door;
      bestD = d;
    }
  }
  return best;
};

const oppositeDoor = (house: HouseFact, side: HouseDoorSide): HouseDoor =>
  doorOf(house, side === 'front' ? 'back' : 'front');

const saferDoor = (house: HouseFact, threatX?: number, threatY?: number): HouseDoor => {
  if (threatX === undefined || threatY === undefined) {
    return house.doors[0];
  }
  let best = house.doors[0];
  let bestD = -1;
  for (const door of house.doors) {
    const d = dist(door.x, door.y, threatX, threatY);
    if (d > bestD) {
      best = door;
      bestD = d;
    }
  }
  return best;
};

const nearestHeroOf = (situation: Situation): CombatantView | undefined =>
  situation.enemies.find((enemy) => enemy.kind === 'hero' && enemy.visible);

const nearestHouseOf = (x: number, y: number, houses: HouseFact[]): HouseFact | undefined =>
  houses.reduce((best: HouseFact | undefined, next) => {
    const d = dist(x, y, next.x, next.y);
    return !best || d < dist(x, y, best.x, best.y) ? next : best;
  }, undefined);

const interiorStand = (house: HouseFact): { x: number; y: number } => ({
  x: house.interior.x + house.interior.w * 0.5,
  y: house.interior.y + house.interior.h * 0.48,
});

const throughDoor = (
  selfX: number,
  selfY: number,
  door: HouseDoor,
  nextX: number,
  nextY: number,
): NonNullable<MoveHint['poi']> => {
  if (dist(selfX, selfY, door.x, door.y) > 28) {
    return { x: door.x, y: door.y };
  }
  return { x: nextX, y: nextY, halt: dist(selfX, selfY, nextX, nextY) < 22 };
};

type Write = (
  rows: ScoredAction[],
  used: number,
  action: TacticalAction,
  score: number,
  reason: string,
  targetId?: number,
  allyId?: number,
) => number;

/**
 * Houses are two-door tactical rooms on the existing utility scorer.
 * No second pathfinder: doors are walk POIs for reposition / recover / flank / escape.
 */
export const applyHouseBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  write: Write,
): number => {
  const env = situation.environment;
  const houses = env?.houses ?? [];
  if (houses.length === 0) {
    return count;
  }
  const self = situation.self;
  const kit = situation.kit;
  const foe = nearestHeroOf(situation);
  const fightDist = foe ? dist(self.x, self.y, foe.x, foe.y) : 9999;
  const inMelee = Boolean(foe) && fightDist < self.attackRange * 1.25;
  const jitter = 0.78 + (situation.personality.caution - 0.5) * 0.3 + (situation.personality.opportunism - 0.5) * 0.2;
  const inside = env?.inside;
  const stay = situation.houseStay;
  const now = situation.now ?? 0;

  if (inside) {
    const doorNearFoe = foe ? nearestDoor(foe.x, foe.y, inside) : undefined;
    const threatAtDoor = foe
      ? insideHouse(foe.x, foe.y, inside) || (doorNearFoe ? dist(foe.x, foe.y, doorNearFoe.x, doorNearFoe.y) < 90 : false)
      : false;
    const stayedMs = stay && stay.id === inside.id ? now - stay.enteredAt : 0;
    const healed = self.hpRatio > 0.52 && !self.recentlyHit;
    const camping = stayedMs > 2200 || (healed && !threatAtDoor);
    const flanked = foe ? !insideHouse(foe.x, foe.y, inside) && fightDist < 260 : false;
    if (self.hpRatio < 0.42 && !inMelee && !camping && !flanked) {
      count = write(out, count, 'recover', (16 + (1 - self.hpRatio) * 14) * jitter, 'house cover', -1);
    }
    if (camping || inMelee || flanked || threatAtDoor || self.hpRatio > 0.62) {
      count = write(out, count, 'reposition', (18 + (camping ? 8 : 0) + (flanked ? 6 : 0)) * jitter, 'leave house');
      if (inMelee || threatAtDoor) {
        count = write(out, count, 'escape', 14 * jitter, 'house exit');
      }
    }
    return count;
  }

  const house = nearestHouseOf(self.x, self.y, houses);
  if (!house || house.doors.length < 2) {
    return count;
  }
  const houseGap = dist(self.x, self.y, house.x, house.y);
  const foeInside = foe && insideHouse(foe.x, foe.y, house);

  if (foeInside && houseGap < 420) {
    const other = oppositeDoor(house, nearestDoor(foe.x, foe.y, house).side);
    const allyOnOpposite = situation.allies.some((ally) => dist(ally.x, ally.y, other.x, other.y) < 70);
    const preferOpposite = self.id % 2 === 1 || allyOnOpposite;
    if (kit?.wantsFlank || kit?.heroId === 'ninja' || kit?.heroId === 'shadow' || kit?.heroId === 'rope' || preferOpposite) {
      count = write(out, count, 'flank', (17 + situation.personality.flankTendency * 10) * jitter, 'flank house', foe.id);
    } else {
      count = write(out, count, 'reposition', 12 * jitter, 'cut house exit', foe.id);
    }
    for (let i = 0; i < count; i += 1) {
      if (out[i].action === 'chase' || out[i].action === 'advance') {
        out[i].score -= 8;
      }
    }
    return count;
  }

  if (inMelee || houseGap > 210) {
    return count;
  }
  const wantsCover =
    self.hpRatio < 0.4 ||
    self.recentlyHit ||
    Boolean(situation.projectile?.willHit) ||
    (self.hpRatio < 0.52 && (kit?.heroId === 'mender' || kit?.heroId === 'witch' || kit?.heroId === 'ninja'));
  if (!wantsCover || situation.personality.caution < 0.22) {
    return count;
  }
  if (foe && foe.hpRatio < 0.28 && fightDist < self.attackRange * 1.6) {
    return count;
  }
  return write(out, count, 'reposition', (12 + (1 - self.hpRatio) * 10) * jitter, 'enter house');
};

export const poiForIntent = (
  intent: { action: TacticalAction; reason: string; targetId?: number },
  situation: Situation,
  selfId: number,
): NonNullable<MoveHint['poi']> | undefined => {
  const env = situation.environment;
  if (!env) {
    return undefined;
  }
  const self = situation.self;
  const reason = intent.reason;
  if ((reason.includes('crate') || (intent.action === 'farm_minions' && intent.targetId === undefined)) && env.crate) {
    const gap = dist(self.x, self.y, env.crate.x, env.crate.y);
    return { x: env.crate.x, y: env.crate.y, halt: gap < 26 };
  }

  if (
    (reason.includes('cover to transform') || reason.includes('use cover') || reason.includes('space to transform')) &&
    env.cover
  ) {
    const gap = dist(self.x, self.y, env.cover.x, env.cover.y);
    return { x: env.cover.x, y: env.cover.y, halt: gap < 28 };
  }

  const houses = env.houses ?? [];
  const houseRelated =
    reason.includes('house') || reason.includes('building') || Boolean(env.inside);
  if (!houseRelated) {
    return undefined;
  }
  const house = env.inside ?? nearestHouseOf(self.x, self.y, houses);
  if (!house || house.doors.length < 2) {
    return undefined;
  }

  const foe = intent.targetId !== undefined
    ? situation.enemies.find((enemy) => enemy.id === intent.targetId) ?? nearestHeroOf(situation)
    : nearestHeroOf(situation);
  const stay = situation.houseStay;
  const entered = stay?.door ?? nearestDoor(self.x, self.y, house).side;
  const stand = interiorStand(house);

  if (reason.includes('flank house') || reason.includes('cut house')) {
    const foeDoor = foe ? nearestDoor(foe.x, foe.y, house) : house.doors[0];
    const takeOpposite = selfId % 2 === 1 || reason.includes('flank');
    const door = takeOpposite ? oppositeDoor(house, foeDoor.side) : foeDoor;
    if (reason.includes('cut house')) {
      return { x: door.x, y: door.y, halt: dist(self.x, self.y, door.x, door.y) < 22 };
    }
    const next = foe && insideHouse(foe.x, foe.y, house) ? { x: foe.x, y: foe.y } : stand;
    return throughDoor(self.x, self.y, door, next.x, next.y);
  }

  if (
    reason.includes('leave house') ||
    reason.includes('house exit') ||
    (env.inside && (intent.action === 'escape' || intent.action === 'reposition'))
  ) {
    const exit = foe ? saferDoor(house, foe.x, foe.y) : oppositeDoor(house, entered);
    if (insideHouse(self.x, self.y, house)) {
      return throughDoor(self.x, self.y, exit, exit.x, exit.y);
    }
    return { x: exit.x, y: exit.y, halt: dist(self.x, self.y, exit.x, exit.y) < 18 };
  }

  if (reason.includes('enter house') || reason.includes('house cover') || reason.includes('use building')) {
    if (insideHouse(self.x, self.y, house)) {
      return { x: stand.x, y: stand.y, halt: dist(self.x, self.y, stand.x, stand.y) < 22 };
    }
    const approach = foe ? saferDoor(house, foe.x, foe.y) : nearestDoor(self.x, self.y, house);
    return throughDoor(self.x, self.y, approach, stand.x, stand.y);
  }

  if (env.inside && (intent.action === 'recover' || intent.action === 'hold_position')) {
    const stayed = stay && stay.id === house.id ? (situation.now ?? 0) - stay.enteredAt : 0;
    if (stayed > 2000 || self.hpRatio > 0.58) {
      const exit = foe ? saferDoor(house, foe.x, foe.y) : oppositeDoor(house, entered);
      return throughDoor(self.x, self.y, exit, exit.x, exit.y);
    }
    return { x: stand.x, y: stand.y, halt: dist(self.x, self.y, stand.x, stand.y) < 24 };
  }

  return undefined;
};

export const syncHouseStay = (
  previous: Situation['houseStay'],
  situation: Situation,
  now: number,
): Situation['houseStay'] => {
  const inside = situation.environment?.inside;
  if (!inside || inside.doors.length < 2) {
    return undefined;
  }
  if (previous && previous.id === inside.id) {
    return previous;
  }
  const door = nearestDoor(situation.self.x, situation.self.y, inside);
  return { id: inside.id, door: door.side, enteredAt: now };
};
