import { kitProfileOf } from './kitProfile';
import type { CombatantView, KitProfile, Personality, TacticalAction } from './types';

/**
 * Local fight interpretation for existing scores.
 * Not a mode machine and not a second AI — a read of whether the next few
 * seconds still favor committing.
 */
export type FightShape = 'advantage' | 'favorable' | 'even' | 'unfavorable' | 'collapse';

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export const distOf = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const leftMs = (ms: number | undefined): number => Math.max(0, ms ?? 0);

/** 0..1 remaining life of a timed window. Short leftover time still counts as now. */
export const windowLife = (left: number, typicalMs = 2000): number => {
  if (left <= 0) {
    return 0;
  }
  if (left >= 280) {
    return clamp(left / typicalMs, 0.42, 1);
  }
  return clamp(left / 280, 0, 0.42);
};

/** Visible mobility / CC lock. Hidden meters do not create this on their own. */
export const mobilityLockOf = (unit: CombatantView): number => {
  const slow = windowLife(leftMs(unit.slowLeftMs), 2400);
  const cripple = windowLife(leftMs(unit.crippleLeftMs), 2800);
  const stun = windowLife(leftMs(unit.stunLeftMs) || (unit.stunned ? 360 : 0), 1400);
  const knock = windowLife(leftMs(unit.controlLockLeftMs), 720);
  const blockStun = windowLife(leftMs(unit.blockStunLeftMs), 800);
  return clamp(slow * 0.72 + cripple * 0.5 + stun + knock * 0.82 + blockStun * 0.58, 0, 1);
};

/** Where this fighter wants others to stand. Visible kit, not hidden meters. */
export const pocketRadius = (unit: CombatantView): number => {
  if (unit.kind === 'minion') {
    return unit.attackRange * 1.08 + 12;
  }
  const kit = kitProfileOf(unit.heroId, String(unit.role), unit.attackRange);
  return kit.comfortMax + 8;
};

export const canStrikeOutsidePocket = (self: CombatantView, enemy: CombatantView): boolean =>
  self.attackRange * 0.9 > pocketRadius(enemy) + 10;

const powerOf = (unit: CombatantView): number => {
  const hp = 0.32 + 0.68 * unit.hpRatio;
  return unit.power * hp * (unit.stunned ? 0.38 : 1) * (unit.hpRatio < 0.16 ? 0.45 : 1);
};

export const matesInPocket = (
  enemy: CombatantView,
  allies: CombatantView[],
  self?: CombatantView,
): number => {
  const reach = pocketRadius(enemy);
  let n = 0;
  for (const ally of allies) {
    if (self && ally === self) {
      continue;
    }
    if (ally.kind === 'minion') {
      continue;
    }
    if (distOf(ally, enemy) <= reach) {
      if (canStrikeOutsidePocket(ally, enemy) && distOf(ally, enemy) > enemy.attackRange * 0.85) {
        continue;
      }
      n += 1;
    }
  }
  return n;
};

/**
 * Cost of occupying the range this enemy is strongest at.
 * High when we could fight from outside, or when allies already fill the pocket.
 */
export const threatZoneCost = (
  self: CombatantView,
  enemy: CombatantView,
  allies: CombatantView[],
  kit: KitProfile | undefined,
  distance: number,
): number => {
  if (enemy.kind === 'minion') {
    return 0;
  }
  const pocket = pocketRadius(enemy);
  const pokeOut = canStrikeOutsidePocket(self, enemy);
  const theirMelee =
    kitProfileOf(enemy.heroId, String(enemy.role), enemy.attackRange).stance === 'melee' ||
    enemy.attackRange < 150;
  const myMelee = kit?.stance === 'melee' || kit?.stance === 'skirmish';
  const bruiser = myMelee && (self.role === 'tank' || self.role === 'frontliner') && (kit?.pressureBias ?? 0) > 0.7;
  const mates = matesInPocket(enemy, allies);
  let cost = 0;
  if (distance <= pocket) {
    if (pokeOut) {
      cost += 0.62;
    } else if (!myMelee && theirMelee) {
      cost += 0.5;
    } else if (bruiser && mates <= 0) {
      cost += 0.06;
    } else {
      cost += theirMelee ? 0.22 : 0.1;
    }
  } else if (distance < pocket * 1.22 && pokeOut) {
    cost += 0.2;
  }
  if (distance <= pocket * 1.18) {
    cost += mates * (pokeOut ? 0.3 : myMelee ? 0.16 : 0.22);
  }
  const myStand = Math.min(kit?.preferredRange ?? self.attackRange * 0.7, self.attackRange * 0.92);
  if (myStand <= pocket && mates >= 1 && distance < pocket * 1.45) {
    cost += 0.14 + mates * 0.1;
  }
  if (enemy.attacking && distance <= pocket) {
    cost += 0.08;
  }
  if (mobilityLockOf(enemy) > 0.35) {
    cost *= 0.72;
  }
  return clamp(cost, 0, 1.35);
};

/**
 * If this attack lands and the enemy lives, how stuck is the resulting position?
 */
export const futurePositionCost = (args: {
  self: CombatantView;
  enemy: CombatantView;
  zone: number;
  strain: number;
  clusterRisk: number;
  escapeOpen: boolean;
  finishable: boolean;
  isolation: number;
}): number => {
  const { self, enemy, zone, strain, clusterRisk, escapeOpen, finishable, isolation } = args;
  if (finishable && isolation > 0.55 && enemy.hpRatio < 0.12) {
    return 0;
  }
  let cost = zone * 0.42;
  if (enemy.hpRatio > 0.28) {
    cost += (self.dashCharges <= 0 ? 0.22 : self.dashCharges <= 1 ? 0.1 : 0) + strain * 0.2;
    cost += clusterRisk * 0.22;
    if (!escapeOpen) {
      cost += 0.18;
    }
  }
  if (finishable) {
    cost *= 0.35;
  }
  return clamp(cost, 0, 1.2);
};

/** 0 = resources intact, 1 = spent into a weak follow-up. */
export const reserveGap = (self: CombatantView): number => {
  const dash = self.dashCharges <= 0 ? 0.5 : self.dashCharges <= 1 ? 0.2 : 0;
  const kit = self.abilityReady ? 0 : 0.1;
  const hp = self.hpRatio >= 0.52 ? 0 : (0.52 - self.hpRatio) * 0.75;
  return clamp(dash + kit + hp, 0, 1);
};

export const chaseQualityCost = (args: {
  self: CombatantView;
  enemy: CombatantView;
  allies: CombatantView[];
  enemies: CombatantView[];
  homeX: number;
  pile: number;
  strain: number;
  zone: number;
  escapeOpen: boolean;
}): number => {
  const { self, enemy, allies, enemies, homeX, pile, strain, zone, escapeOpen } = args;
  const d = distOf(self, enemy);
  let nearestAlly = 9999;
  let allyCanFinish = false;
  for (const ally of allies) {
    if (ally.kind !== 'hero') {
      continue;
    }
    const ad = distOf(ally, enemy);
    const gap = distOf(self, ally);
    if (gap < nearestAlly) {
      nearestAlly = gap;
    }
    if (ad + 24 < d && ally.hpRatio > 0.28 && ally.staminaRatio > 0.18) {
      allyCanFinish = true;
    }
  }
  let guards = 0;
  for (const other of enemies) {
    if (other === enemy || other.kind === 'minion') {
      continue;
    }
    if (distOf(other, enemy) < 170) {
      guards += 1;
    }
  }
  let cost = pile * 0.18 + strain * 0.28 + zone * 0.16;
  if (nearestAlly > 220) {
    cost += 0.2;
  }
  if (nearestAlly > 340) {
    cost += 0.16;
  }
  cost += guards * 0.22;
  if (self.hpRatio < 0.42) {
    cost += 0.18;
  }
  if (self.dashCharges <= 0) {
    cost += 0.16;
  } else if (self.dashCharges <= 1 && (self.role === 'assassin' || self.role === 'disruptor')) {
    cost += 0.1;
  }
  if (!escapeOpen) {
    cost += 0.2;
  }
  if (Math.abs(self.x - homeX) > 460 && nearestAlly > 180) {
    cost += 0.16;
  }
  if (allyCanFinish && (guards > 0 || nearestAlly > 200 || self.hpRatio < 0.55)) {
    cost += 0.3;
  }
  if (self.moveSpeed < 120 && d > self.attackRange * 1.85) {
    cost += 0.24;
  } else if ((self.role === 'tank' || self.role === 'frontliner') && d > self.attackRange * 2.1) {
    cost += 0.12;
  }
  if (d > self.attackRange * 3.4) {
    cost += 0.14;
  }
  return clamp(cost, 0, 1.35);
};

export const lifeTradeCost = (args: {
  self: CombatantView;
  finishable: boolean;
  isolation: number;
  victim?: CombatantView;
  enemyKind: CombatantView['kind'];
}): number => {
  const { self, finishable, isolation, victim, enemyKind } = args;
  if (self.hpRatio >= 0.36) {
    return 0;
  }
  let cost = (0.36 - self.hpRatio) * 0.9;
  if (finishable && isolation > 0.65 && enemyKind === 'hero') {
    cost *= 0.22;
  } else if (victim && victim.hpRatio < 0.2) {
    cost *= 0.34;
  } else if (!finishable) {
    cost *= 1;
  }
  return clamp(cost, 0, 0.8);
};

export const readFightShape = (args: {
  self: CombatantView;
  allies: CombatantView[];
  enemies: CombatantView[];
  clusterRisk: number;
  handledNearby: boolean;
  escapeOpen: boolean;
  strain: number;
}): FightShape => {
  const { self, allies, enemies, clusterRisk, handledNearby, escapeOpen, strain } = args;
  let localAllies = 0;
  let localEnemies = 0;
  let allyPower = powerOf(self);
  let enemyPower = 0;
  let lowAlly = false;
  let weakEnemy = false;
  let isolatedWeak = false;
  for (const ally of allies) {
    if (ally.kind !== 'hero') {
      continue;
    }
    if (distOf(self, ally) < 220) {
      localAllies += 1;
      allyPower += powerOf(ally);
    }
    if (ally.hpRatio < 0.24 && distOf(self, ally) < 260) {
      lowAlly = true;
    }
  }
  for (const enemy of enemies) {
    if (enemy.kind !== 'hero' || enemy.visible === false) {
      continue;
    }
    const d = distOf(self, enemy);
    if (d < 220) {
      localEnemies += 1;
      enemyPower += powerOf(enemy);
      if (enemy.hpRatio < 0.3) {
        weakEnemy = true;
      }
    }
  }
  for (const enemy of enemies) {
    if (enemy.kind !== 'hero' || !enemy.visible || enemy.hpRatio > 0.34) {
      continue;
    }
    const guards = enemies.filter(
      (other) => other !== enemy && other.kind === 'hero' && other.visible && distOf(other, enemy) < 150,
    ).length;
    if (guards === 0 && distOf(self, enemy) < 240) {
      isolatedWeak = true;
    }
  }
  const gap = allyPower - enemyPower;
  const surrounded = localEnemies >= localAllies + 2 || (localEnemies >= 2 && localAllies === 0);
  const broke = strain > 0.72 && self.dashCharges <= 0;
  if (
    (self.hpRatio < 0.16 && localEnemies >= 1 && !isolatedWeak) ||
    (surrounded && self.hpRatio < 0.3 && !escapeOpen) ||
    (self.hpRatio < 0.2 && broke && localEnemies >= 1)
  ) {
    return 'collapse';
  }
  if ((surrounded && self.hpRatio < 0.52) || gap < -0.85 || (self.hpRatio < 0.26 && localEnemies > localAllies)) {
    return 'unfavorable';
  }
  if (isolatedWeak && (gap > 0.05 || self.hpRatio > 0.38)) {
    return 'advantage';
  }
  if (weakEnemy && gap > 0.2 && !surrounded && self.hpRatio > 0.34) {
    return 'advantage';
  }
  if ((gap > 0.4 && self.hpRatio > 0.42 && !surrounded && !lowAlly) || (handledNearby && gap > 0.15)) {
    return 'favorable';
  }
  if (clusterRisk > 0.55 && surrounded) {
    return 'unfavorable';
  }
  return 'even';
};

export const biasFightAction = (
  action: TacticalAction,
  score: number,
  shape: FightShape,
  personality: Personality,
  self: CombatantView,
): number => {
  let next = score;
  if (shape === 'advantage') {
    if (action === 'attack' || action === 'finish_target' || action === 'intercept') {
      next += 7 + personality.opportunism * 4;
    }
    if (action === 'chase' && self.hpRatio > 0.4) {
      next += 3;
    }
    if (action === 'retreat' && self.hpRatio > 0.45) {
      next -= 4;
    }
  } else if (shape === 'favorable') {
    if (action === 'attack' || action === 'finish_target') {
      next += 4;
    }
    if (action === 'chase') {
      next -= 2;
    }
    if (action === 'wait_for_opening' || action === 'reposition') {
      next += 2;
    }
  } else if (shape === 'even') {
    if (action === 'wait_for_opening' || action === 'hold_position' || action === 'reposition') {
      next += 5 + personality.patience * 3;
    }
    if (action === 'chase' || action === 'flank') {
      next -= 3;
    }
    if (action === 'attack' && self.staminaRatio < 0.28) {
      next -= 4;
    }
  } else if (shape === 'unfavorable') {
    if (action === 'retreat' || action === 'reposition' || action === 'protect_ally' || action === 'recover') {
      next += 8 + personality.retreatWillingness * 4;
    }
    if (action === 'attack' || action === 'flank' || action === 'assist_ally') {
      next -= 7;
    }
    if (action === 'chase') {
      next -= 12;
    }
    if (action === 'finish_target' && self.hpRatio > 0.22) {
      next += 3;
    }
  } else {
    if (action === 'escape' || action === 'retreat' || action === 'recover') {
      next += 14 + personality.caution * 4;
    }
    if (action === 'attack' || action === 'chase' || action === 'flank' || action === 'assist_ally') {
      next -= 16;
    }
    if (action === 'finish_target' && self.hpRatio < 0.2) {
      next -= 6;
    }
    if (action === 'protect_ally') {
      next += 4;
    }
  }
  return next;
};

export type Opportunity = {
  /** How compromised the target is right now (0..1). */
  value: number;
  /** Remaining life of that window (0..1). */
  life: number;
  /** Mobility / CC lock strength (0..1). */
  locked: number;
  recovering: boolean;
  /** Risk of converting this opening (0..1). */
  risk: number;
  /** Kit-interpreted value after risk (0..1). */
  payoff: number;
};

const recoveringOf = (unit: CombatantView): boolean =>
  leftMs(unit.hitReactLeftMs) > 0 ||
  leftMs(unit.recoveryLeftMs) > 0 ||
  unit.recentlyHit ||
  Boolean(unit.stunned);

/**
 * Visible compromise on a target. Empty hidden meters alone do not create this.
 */
export const readOpening = (enemy: CombatantView): { value: number; life: number; locked: number; recovering: boolean } => {
  if (enemy.kind === 'minion' || enemy.visible === false) {
    return { value: 0, life: 0, locked: 0, recovering: false };
  }
  const locked = mobilityLockOf(enemy);
  const hit = windowLife(leftMs(enemy.hitReactLeftMs) || (enemy.recentlyHit ? 260 : 0), 520);
  const recover = windowLife(leftMs(enemy.recoveryLeftMs), 500);
  const life = Math.max(
    locked,
    hit,
    recover,
    windowLife(leftMs(enemy.slowLeftMs), 2400),
    windowLife(leftMs(enemy.crippleLeftMs), 2800),
    windowLife(leftMs(enemy.stunLeftMs), 1400),
    windowLife(leftMs(enemy.controlLockLeftMs), 720),
  );
  let value = locked * 0.62;
  if (enemy.stunned) {
    value += 0.16;
  }
  if (enemy.recentlyHit || hit > 0) {
    value += 0.08;
  }
  if (recover > 0.3) {
    value += 0.06;
  }
  const shield = enemy.shieldRatio;
  if (enemy.blocking && shield !== undefined && shield < 0.3) {
    value += 0.12;
  } else if (enemy.blocking && (shield === undefined || shield > 0.55)) {
    value -= 0.06;
  }
  if (shield !== undefined && shield < 0.08 && !enemy.blocking) {
    value += 0.1;
  }
  if (enemy.hpRatio < 0.28) {
    value += 0.1;
  }
  if (enemy.hpRatio < 0.14) {
    value += 0.08;
  }
  if (value > 0.14) {
    if ((enemy.dashCharges ?? 2) <= 0) {
      value += 0.08;
    }
    if (enemy.abilityReady === false) {
      value += 0.05;
    }
    if ((enemy.staminaRatio ?? 1) < 0.18) {
      value += 0.06;
    }
  }
  return { value: clamp(value, 0, 1), life, locked, recovering: recoveringOf(enemy) };
};

export type OpportunityArgs = {
  self: CombatantView;
  enemy: CombatantView;
  allies: CombatantView[];
  enemies: CombatantView[];
  kit?: KitProfile;
  isolation: number;
  pile: number;
  zone: number;
  distance: number;
  escapeOpen: boolean;
};

/**
 * How much this kit should want to convert a visible opening, and whether it can.
 * Character identity comes from kit stance / range / initiate — not hero-name rules.
 */
export const opportunityOf = (args: OpportunityArgs): Opportunity => {
  const { self, enemy, allies, kit: givenKit, isolation, pile, zone, distance, escapeOpen } = args;
  const opening = readOpening(enemy);
  const kit = givenKit ?? kitProfileOf(self.heroId, String(self.role), self.attackRange, self);
  const stance = kit.stance;
  const inStrike = distance <= self.attackRange * 1.14;
  const inPocket = distance <= pocketRadius(self) * 1.05;
  const farChase = distance > self.attackRange * 1.7;

  let want = opening.value * (0.42 + kit.pressureBias * 0.34);
  if (stance === 'melee' || kit.wantsInitiate) {
    want += opening.locked * 0.26;
    if (opening.recovering) {
      want += 0.07;
    }
    if (isolation > 0.55) {
      want += opening.value * 0.14;
    }
  }
  if (stance === 'ranged' || kit.wantsPoke) {
    want += opening.locked * 0.14;
    if (distance < kit.comfortMin) {
      want -= 0.22;
    }
  }
  if (stance === 'support') {
    want *= 0.42;
  }
  if (stance === 'skirmish') {
    want += opening.locked * 0.16;
  }
  if (!kit.wantsFlank && (self.role === 'tank' || kit.pressureBias > 0.72) && farChase) {
    want *= 0.52;
  }
  if (inPocket && opening.value > 0.18) {
    want += 0.12;
  }
  if (!kit.wantsInitiate && stance === 'melee') {
    want *= 0.72;
  }
  if (kit.wantsInitiate && opening.life > 0.4 && inStrike) {
    want += 0.08;
  }
  want *= 1 - pile * 0.58;
  want += isolation * opening.value * 0.1;

  let risk = zone * 0.38;
  if (self.hpRatio < 0.42) {
    risk += (0.42 - self.hpRatio) * 0.85;
  }
  risk += self.dashCharges <= 0 ? 0.22 : self.dashCharges <= 1 ? 0.08 : 0;
  risk += self.staminaRatio < 0.2 ? 0.18 : self.staminaRatio < 0.32 ? 0.08 : 0;
  if (stance === 'ranged' && distance < kit.comfortMin) {
    risk += 0.16;
  }
  if (isolation < 0.4) {
    risk += 0.18;
  }
  if (!escapeOpen) {
    risk += 0.12;
  }
  const cover = allies.some(
    (ally) =>
      ally.kind === 'hero' &&
      distOf(ally, self) < 240 &&
      (kitProfileOf(ally.heroId, String(ally.role), ally.attackRange).wantsProtect || ally.role === 'support'),
  );
  if (cover) {
    risk -= 0.1;
  }
  risk -= opening.locked * 0.16;
  risk = clamp(risk, 0, 1);

  const payoff = clamp(want * (1 - risk * 0.7) * (0.55 + opening.life * 0.45), 0, 1);
  return {
    value: clamp(want, 0, 1),
    life: opening.life,
    locked: opening.locked,
    recovering: opening.recovering,
    risk,
    payoff,
  };
};

/**
 * Ally looks ready to land a setup and it has not landed yet.
 * Returns 0 when the window already exists or this kit should not wait.
 */
export const setupPending = (args: {
  self: CombatantView;
  enemy: CombatantView;
  allies: CombatantView[];
  kit?: KitProfile;
  distance: number;
}): number => {
  const { self, enemy, allies, kit, distance } = args;
  if (enemy.kind !== 'hero' || !enemy.visible) {
    return 0;
  }
  if (mobilityLockOf(enemy) > 0.28 || enemy.stunned) {
    return 0;
  }
  if (!(kit?.stance === 'melee' || kit?.wantsInitiate)) {
    return 0;
  }
  let pending = 0;
  for (const ally of allies) {
    if (ally.kind !== 'hero' || !ally.visible) {
      continue;
    }
    const allyKit = kitProfileOf(ally.heroId, String(ally.role), ally.attackRange, ally);
    const ad = distOf(ally, enemy);
    const setter = (allyKit.wantsPoke || allyKit.setupIds.length > 0) && ally.abilityReady !== false;
    if (!setter || ad > 430 || ad < 64) {
      continue;
    }
    pending += 0.4 + (ally.attacking ? 0.18 : 0);
  }
  if (distance <= self.attackRange * 1.02) {
    pending *= 0.22;
  }
  return clamp(pending, 0, 1);
};

/** How strongly this kit should peel a pressured ally instead of chasing its own target. */
export const peelWeight = (
  self: CombatantView,
  ally: CombatantView,
  foes: CombatantView[],
  kit?: KitProfile,
): number => {
  if (ally.kind !== 'hero' || foes.length === 0) {
    return 0;
  }
  const profile = kit ?? kitProfileOf(self.heroId, String(self.role), self.attackRange, self);
  let pressure = 0;
  for (const foe of foes) {
    pressure += 0.28;
    if (foe.attacking || foe.lastAttackerId === ally.id) {
      pressure += 0.16;
    }
  }
  if (ally.recentlyHit) {
    pressure += 0.14;
  }
  if (ally.hpRatio < 0.34) {
    pressure += 0.22;
  } else if (ally.hpRatio < 0.52) {
    pressure += 0.1;
  }
  if (ally.attacking && ally.hpRatio < 0.72) {
    pressure += 0.08;
  }
  let want = pressure * (0.35 + profile.pressureBias * 0.15);
  if (profile.wantsProtect || profile.stance === 'support') {
    want += 0.28;
  }
  if (profile.wantsInitiate && profile.stance === 'melee') {
    want += 0.12;
  }
  if (profile.wantsPoke) {
    want += 0.1;
  }
  if (!profile.wantsFlank && (self.role === 'tank' || profile.stance === 'melee')) {
    want += 0.1;
  }
  const d = distOf(self, ally);
  if (d > 280) {
    want *= 0.7;
  }
  if (self.hpRatio < 0.2) {
    want *= 0.45;
  }
  return clamp(want, 0, 1);
};
