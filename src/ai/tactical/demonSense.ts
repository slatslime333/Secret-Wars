import type { AbilityDef } from '../../heroes/abilities/types';
import type { CombatantView, ScoredAction, Situation, TacticalAction } from './types';

export type DemonFormView = 'little' | 'transforming' | 'big' | 'bat';

const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

export const demonFormOf = (self: CombatantView): DemonFormView => self.demonForm ?? 'little';

export const demonRageOf = (self: CombatantView): number => self.rageRatio ?? 0;

export const demonTimeLeft = (self: CombatantView): number => self.transformLeftMs ?? 0;

const nearestHero = (self: CombatantView, enemies: CombatantView[]): { unit: CombatantView; d: number } | undefined =>
  enemies.reduce((best, unit) => {
    if (!unit.visible || unit.kind !== 'hero') {
      return best;
    }
    const d = dist(self, unit);
    return !best || d < best.d ? { unit, d } : best;
  }, undefined as { unit: CombatantView; d: number } | undefined);

const heroCountNear = (self: CombatantView, enemies: CombatantView[], range: number): number =>
  enemies.filter((unit) => unit.kind === 'hero' && unit.visible && dist(self, unit) <= range).length;

/**
 * Character-specific Hellfire / Hell Bat scoring. Does not rewrite global kit tactics.
 */
export const scoreDemonAbility = (def: AbilityDef, situation: Situation): number => {
  if (situation.self.heroId !== 'demon') {
    return 0;
  }
  const { self, enemies, allies } = situation;
  const form = demonFormOf(self);
  const rage = demonRageOf(self);
  const nearest = nearestHero(self, enemies);
  const close = nearest?.d ?? 9999;
  const foes = heroCountNear(self, enemies, 210);
  const hp = self.hpRatio;
  let delta = 0;

  if (def.id === 'demon-hellfire') {
    const grouped = heroCountNear(self, enemies, 190);
    if (form === 'little' || form === 'bat') {
      if (grouped >= 2) {
        delta += 16;
      }
      if (close < 180 && close > 70) {
        delta += 12;
      }
      if (hp < 0.42 && close < 160) {
        delta += 14;
      }
      if (grouped === 0 && close > 280) {
        delta -= 18;
      }
    } else if (form === 'big') {
      if (grouped >= 2) {
        delta += 10;
      }
      if (close < 90) {
        delta += 8;
      }
    }
    if (rage > 0.85 && close < 120 && form !== 'big') {
      delta += 6;
    }
  }

  if (def.id === 'demon-hell-bat') {
    if (form === 'little') {
      if (hp < 0.38 && close < 150) {
        delta += 22;
      } else if (foes >= 3 && close < 160) {
        delta += 16;
      } else if (nearest && nearest.unit.hpRatio < 0.28 && close < 200 && hp > 0.55) {
        delta += 10;
      } else if (close > 260 && hp > 0.7) {
        delta -= 14;
      }
      if (rage > 0.88 && close < 140) {
        delta += 12;
      }
    } else if (form === 'big') {
      const left = demonTimeLeft(self);
      if (nearest && nearest.unit.hpRatio < 0.4 && close < 220 && foes <= 2) {
        delta += 14;
      }
      if (foes >= 3 && hp < 0.4) {
        delta -= 10;
      }
      if (left > 0 && left < 1800 && close < 130) {
        delta += 8;
      }
    }
    const allyNeed = allies.some((ally) => ally.kind === 'hero' && ally.hpRatio < 0.35 && dist(self, ally) < 220);
    if (allyNeed && form === 'big') {
      delta += 8;
    }
  }

  if (def.id === 'demon-rage') {
    delta -= 40;
  }

  return delta;
};

export const applyDemonBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  write: (out: ScoredAction[], count: number, action: TacticalAction, score: number, reason: string, targetId?: number) => number,
): number => {
  if (situation.self.heroId !== 'demon') {
    return count;
  }
  const { self, enemies, allies } = situation;
  const form = demonFormOf(self);
  const rage = demonRageOf(self);
  const left = demonTimeLeft(self);
  const nearest = nearestHero(self, enemies);
  const close = nearest?.d ?? 9999;
  const foes = heroCountNear(self, enemies, 200);
  const hp = self.hpRatio;
  const targetId = nearest?.unit.id ?? -1;
  const allyNear = allies.some((ally) => ally.kind === 'hero' && dist(self, ally) < 180);

  for (let i = 0; i < count; i += 1) {
    const row = out[i];
    if (form === 'little' || form === 'bat' || form === 'transforming') {
      if (row.action === 'chase' || row.action === 'flank' || row.action === 'finish_target') {
        row.score -= 10 + (close < 110 ? 8 : 0) + rage * 6;
      }
      if (row.action === 'attack') {
        row.score += close > self.attackRange * 0.55 && close < self.attackRange * 1.12 ? 10 : -6;
        if (close < 90) {
          row.score -= 12;
        }
      }
      if (row.action === 'reposition' || row.action === 'retreat') {
        row.score += close < 140 ? 8 : 2;
        if (rage > 0.82 && close < 160) {
          row.score += 12;
        }
      }
      if (row.action === 'escape') {
        row.score += hp < 0.34 || (rage > 0.9 && close < 130) ? 14 : 0;
      }
      if (row.action === 'farm_minions' && close < 240) {
        row.score -= 8;
      }
    } else {
      const ending = left > 0 && left < 2200;
      if (row.action === 'attack' || row.action === 'assist_ally') {
        row.score += 12 + (1 - hp) * -4;
        if (foes >= 3 && hp < 0.32) {
          row.score -= 14;
        }
      }
      if (row.action === 'chase' || row.action === 'finish_target') {
        row.score += nearest && nearest.unit.hpRatio < 0.45 && foes <= 2 ? 14 : 4;
        if (foes >= 3 && hp < 0.4) {
          row.score -= 12;
        }
      }
      if (row.action === 'protect_ally') {
        row.score += 6;
      }
      if (row.action === 'retreat' || row.action === 'escape') {
        row.score += ending ? 10 + (close < 120 ? 6 : 0) : -8;
        if (hp < 0.22) {
          row.score += 10;
        }
      }
      if (row.action === 'farm_minions' || row.action === 'wait_for_opening') {
        row.score -= 12;
      }
    }
  }

  if ((form === 'little' || form === 'transforming') && rage > 0.86 && close < 150) {
    count = write(out, count, 'reposition', 18 + rage * 10, 'create space before Demon Rage', targetId);
    if (hp < 0.4 || foes >= 2) {
      count = write(out, count, 'retreat', 16 + (1 - hp) * 8, 'safe transform window', targetId);
    }
  }
  if (form === 'big' && left > 0 && left < 1600 && close < 110 && (foes >= 2 || !allyNear)) {
    count = write(out, count, 'reposition', 14, 'Demon Rage ending, find an exit', targetId);
  }
  if (form === 'little' && close < self.attackRange * 1.05 && close > 90 && hp > 0.28) {
    count = write(out, count, 'attack', 11, 'poke for Demon Rage', targetId);
  }
  return count;
};

/** Aim Hell Bat away from a crowd when Little Demon is escaping. */
export const hellBatAim = (
  self: CombatantView,
  enemies: CombatantView[],
): { x: number; y: number } | undefined => {
  if (self.heroId !== 'demon') {
    return undefined;
  }
  const form = demonFormOf(self);
  const nearest = nearestHero(self, enemies);
  if (!nearest) {
    return undefined;
  }
  const flee =
    form !== 'big' &&
    (self.hpRatio < 0.4 || demonRageOf(self) > 0.88 || heroCountNear(self, enemies, 170) >= 3);
  if (!flee) {
    return { x: nearest.unit.x - self.x, y: nearest.unit.y - self.y };
  }
  return { x: self.x - nearest.unit.x, y: self.y - nearest.unit.y };
};
