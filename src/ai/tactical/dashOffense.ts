import { COMBAT } from '../../config/combat';
import {
  canStrikeOutsidePocket,
  matesInPocket,
  opportunityOf,
  pocketRadius,
  reserveGap,
  setupPending,
} from './fightRead';
import type { CombatantView, KitProfile, Personality, Situation, TacticalAction } from './types';

export type OffensiveDashPlan = {
  x: number;
  y: number;
  kind: 'engage' | 'chase' | 'reposition' | 'space';
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const dashLen = (): number => COMBAT.dashDistance;

const ENGAGE_ACTIONS: ReadonlySet<TacticalAction> = new Set([
  'attack',
  'chase',
  'flank',
  'finish_target',
  'intercept',
  'assist_ally',
  'switch_target',
]);

const enemiesNear = (point: { x: number; y: number }, enemies: CombatantView[], radius: number): number => {
  let n = 0;
  for (const enemy of enemies) {
    if (!enemy.visible || enemy.kind !== 'hero') {
      continue;
    }
    if (dist(point, enemy) < radius) {
      n += 1;
    }
  }
  return n;
};

/** Last charge is usually an escape, unless the kill is clearly worth it. */
export const shouldKeepEscapeDash = (
  charges: number,
  hp: number,
  finishable: boolean,
  personality: Personality,
  rng: () => number,
): boolean => {
  if (charges >= 2) {
    return false;
  }
  if (finishable && hp > 0.12 && rng() < 0.52 + personality.opportunism * 0.28) {
    return false;
  }
  if (hp > 0.68 && personality.aggression > 0.74 && rng() < 0.22) {
    return false;
  }
  return charges <= 1;
};

const stanceBias = (kit: KitProfile | undefined, role: string): number => {
  const stance = kit?.stance;
  if (stance === 'melee') {
    return 1;
  }
  if (stance === 'skirmish') {
    return 0.72;
  }
  if (role === 'tank' || role === 'frontliner') {
    return 0.82;
  }
  if (stance === 'support') {
    return 0.28;
  }
  if (stance === 'ranged') {
    return 0.22;
  }
  return 0.5;
};

/**
 * Dash as a combat tool: close, chase, cut an angle, or make firing space.
 * Imperfect on purpose — personality and rng still miss good dashes.
 */
export const evaluateOffensiveDash = (
  situation: Situation,
  action: TacticalAction,
  charges: number,
  rng: () => number,
): OffensiveDashPlan | undefined => {
  if (charges <= 0) {
    return undefined;
  }
  const { self, enemies, allies, personality, kit } = situation;
  const hp = self.hpRatio;
  const stam = self.staminaRatio;
  const target = enemies.find((enemy) => enemy.id === situation.currentTargetId && enemy.visible);
  if (!target || target.kind === 'minion') {
    return undefined;
  }

  const finishable = target.hpRatio < 0.16 || target.stunned || target.recentlyHit;
  if (shouldKeepEscapeDash(charges, hp, finishable && ENGAGE_ACTIONS.has(action), personality, rng)) {
    return undefined;
  }

  const d = dist(self, target);
  const myRange = self.attackRange;
  const theirRange = target.attackRange;
  const len = dashLen();
  const landing = (dx: number, dy: number): { x: number; y: number } => {
    const n = Math.hypot(dx, dy) || 1;
    return { x: self.x + (dx / n) * len, y: self.y + (dy / n) * len };
  };

  const isolated = enemiesNear(target, enemies, 170) <= 1;
  const packAtSelf = enemiesNear(self, enemies, 150);
  const packAtThem = enemiesNear(target, enemies, 190);
  const allyNear = allies.some((ally) => ally.kind === 'hero' && ally.visible && dist(ally, target) < 220);
  const theirPocket = pocketRadius(target);
  const pokeOut = canStrikeOutsidePocket(self, target);
  const pocketAllies = matesInPocket(target, allies);
  const opening = opportunityOf({
    self,
    enemy: target,
    allies,
    enemies,
    kit,
    isolation: isolated ? 1 : 0.35,
    pile: Math.max(0, pocketAllies * 0.4),
    zone: pokeOut && d < theirPocket ? 0.5 : 0.15,
    distance: d,
    escapeOpen: situation.escapeOpen,
  });
  const pending = setupPending({ self, enemy: target, allies, kit, distance: d });
  const vulnerable =
    target.stunned ||
    target.recentlyHit ||
    !target.canAttack ||
    target.hpRatio < 0.28 ||
    opening.locked > 0.32;
  const bias = stanceBias(kit, String(self.role));
  const melee = kit?.stance === 'melee' || kit?.stance === 'skirmish';
  const ranged = kit?.stance === 'ranged' || kit?.stance === 'support';
  const initiate = Boolean(kit?.wantsInitiate);
  const pressure = kit?.pressureBias ?? personality.aggression;
  const spent = reserveGap(self);
  const mobile = (kit?.escapeIds.length ?? 0) > 0 || self.heroId === 'shadow' || self.heroId === 'ninja';

  const spaceOut =
    d < theirPocket * 1.12 &&
    (ranged || (mobile && (spent > 0.28 || packAtSelf >= 2 || (pocketAllies >= 1 && !finishable)))) &&
    !finishable &&
    hp > 0.12;
  if (spaceOut && (ranged || !ENGAGE_ACTIONS.has(action) || spent > 0.34 || packAtSelf >= 2)) {
    const awayX = self.x - target.x;
    const awayY = self.y - target.y;
    const side = rng() < 0.45 ? 1 : -1;
    const px = -awayY * side;
    const py = awayX * side;
    const dest = landing(awayX * 0.7 + px * 0.45, awayY * 0.7 + py * 0.45);
    const chance =
      0.16 +
      personality.caution * 0.26 +
      (hp < 0.4 ? 0.16 : 0) +
      spent * 0.18 +
      (mobile ? 0.12 : 0) -
      personality.aggression * 0.05;
    if (rng() < Math.min(0.7, chance)) {
      return { x: dest.x - self.x, y: dest.y - self.y, kind: 'space' };
    }
    if (ranged) {
      return undefined;
    }
  }

  if (ranged && d < myRange * 0.55 && d < theirRange * 1.15 && !spaceOut) {
    const awayX = self.x - target.x;
    const awayY = self.y - target.y;
    const side = rng() < 0.45 ? 1 : -1;
    const px = -awayY * side;
    const py = awayX * side;
    const dest = landing(awayX * 0.7 + px * 0.45, awayY * 0.7 + py * 0.45);
    const chance =
      0.18 + personality.caution * 0.28 + (hp < 0.4 ? 0.16 : 0) - personality.aggression * 0.06;
    if (rng() < Math.min(0.72, chance)) {
      return { x: dest.x - self.x, y: dest.y - self.y, kind: 'space' };
    }
    return undefined;
  }

  if (!ENGAGE_ACTIONS.has(action) || ranged) {
    return undefined;
  }
  if (!melee && !initiate) {
    return undefined;
  }
  if (stam < 0.12 && !finishable) {
    return undefined;
  }
  if (hp < 0.18 && !finishable) {
    return undefined;
  }
  if (pokeOut && d < theirPocket * 1.08 && !finishable) {
    return undefined;
  }
  if (pocketAllies >= 2 && !finishable && hp < 0.62) {
    return undefined;
  }
  if (spent > 0.55 && !finishable && !vulnerable) {
    return undefined;
  }
  if (d <= myRange * 1.02) {
    if (action === 'flank' || action === 'chase') {
      const side = rng() < 0.5 ? 1 : -1;
      const tx = target.x - self.x;
      const ty = target.y - self.y;
      const dest = landing(tx * 0.2 + -ty * side, ty * 0.2 + tx * side);
      const after = dist(dest, target);
      if (after < myRange * 1.15 && packAtThem < 3 && rng() < 0.18 + personality.flankTendency * 0.22) {
        return { x: dest.x - self.x, y: dest.y - self.y, kind: 'reposition' };
      }
    }
    return undefined;
  }

  const closes = d - len;
  const wouldEnter = closes <= myRange * 1.08;
  const stillShort = closes > myRange * 1.35;
  if (stillShort && action !== 'chase' && action !== 'finish_target') {
    return undefined;
  }

  const intoPack = enemiesNear(landing(target.x - self.x, target.y - self.y), enemies, 160);
  if (intoPack >= 3 && hp < 0.55 && !allyNear && String(self.role) !== 'tank') {
    return undefined;
  }
  if (intoPack >= 2 && ranged) {
    return undefined;
  }
  if (pokeOut && wouldEnter && d < theirPocket && !finishable) {
    return undefined;
  }

  let chance =
    0.12 +
    bias * 0.28 +
    pressure * 0.18 +
    personality.aggression * 0.16 +
    personality.opportunism * 0.1 -
    personality.caution * 0.14;
  if (wouldEnter) {
    chance += 0.22;
  }
  if (d > myRange * 1.15 && d < myRange + len * 1.15) {
    chance += 0.16;
  }
  if (isolated) {
    chance += 0.12;
  }
  if (vulnerable) {
    chance += 0.14;
  }
  if (opening.payoff > 0.22 && melee) {
    chance += opening.payoff * 0.2;
  }
  if (pending > 0.4 && opening.payoff < 0.28) {
    chance -= 0.16;
  }
  if (finishable) {
    chance += 0.18;
  }
  if (allyNear || String(self.role) === 'tank' || String(self.role) === 'frontliner') {
    chance += 0.08;
  }
  if (packAtSelf >= 2 && hp < 0.4) {
    chance -= 0.16;
  }
  if (pocketAllies >= 1 && !finishable) {
    chance -= 0.12 + pocketAllies * 0.06;
  }
  if (spent > 0.35) {
    chance -= spent * 0.2;
  }
  if (self.heroId === 'shadow') {
    chance += 0.14;
  }
  if (self.heroId === 'mender' || kit?.stance === 'support') {
    chance -= 0.22;
  }
  if (action === 'chase' || action === 'finish_target') {
    chance += 0.1;
  }
  if (charges >= 3) {
    chance += 0.06;
  }
  chance = Math.max(0.04, Math.min(0.86, chance));
  if (rng() > chance) {
    return undefined;
  }

  const tx = target.x - self.x;
  const ty = target.y - self.y;
  const side = rng() < 0.5 ? 1 : -1;
  const cutAngle = rng() < 0.34 + personality.flankTendency * 0.2;
  const through = d < len * 1.08 && rng() < 0.28 + personality.aggression * 0.16;
  let dx = tx;
  let dy = ty;
  if (through) {
    dx = tx;
    dy = ty;
  } else if (cutAngle) {
    dx = tx + -ty * side * 0.55;
    dy = ty + tx * side * 0.55;
  }
  const dest = landing(dx, dy);
  const kind: OffensiveDashPlan['kind'] =
    action === 'chase' || action === 'finish_target' ? 'chase' : cutAngle ? 'reposition' : 'engage';
  return { x: dest.x - self.x, y: dest.y - self.y, kind };
};
