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
