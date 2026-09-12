import type { CombatantView, Situation } from './types';

const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

export type RetreatGoal = {
  kind: 'spawn' | 'safe' | 'minions';
  x: number;
  y: number;
};

const nearestOf = (self: CombatantView, units: CombatantView[]): CombatantView | undefined => {
  let best: CombatantView | undefined;
  let bestD = 1e9;
  for (const unit of units) {
    if (!unit.visible) {
      continue;
    }
    const d = dist(self, unit);
    if (d < bestD) {
      best = unit;
      bestD = d;
    }
  }
  return best;
};

export type RetreatPrefer = 'any' | 'cover' | 'minions';

/**
 * Pick a recovery point from what this CPU can currently see.
 * Spawn is the last resort — nearby cover or friendly minions come first.
 */
export const pickRetreatGoal = (situation: Situation, prefer: RetreatPrefer = 'any'): RetreatGoal => {
  const { self, allies, enemies, homeX, homeY } = situation;
  const enemyHeroes = enemies.filter((unit) => unit.kind === 'hero' && unit.visible);
  const allyMinions = allies.filter((unit) => unit.kind === 'minion' && unit.visible);
  const outnumbered = enemyHeroes.length >= 2 && allies.filter((unit) => unit.kind === 'hero').length === 0;
  const desperate = self.hpRatio < 0.14 || (self.hpRatio < 0.2 && outnumbered);

  if (desperate || (prefer === 'cover' && self.hpRatio < 0.12)) {
    return { kind: 'spawn', x: homeX, y: homeY };
  }

  const pack = allyMinions[0]
    ? allyMinions.reduce(
        (best, minion) => {
          const d = dist(self, minion);
          return d < best.d ? { minion, d } : best;
        },
        { minion: allyMinions[0], d: dist(self, allyMinions[0]) },
      )
    : undefined;
  const allowMinions = prefer === 'any' || prefer === 'minions';
  if (pack && self.hpRatio > 0.16 && allowMinions) {
    const threatNearPack = enemyHeroes.some((hero) => dist(hero, pack.minion) < 210);
    if (!threatNearPack) {
      return { kind: 'minions', x: pack.minion.x, y: pack.minion.y };
    }
  }
  if (prefer === 'minions' && pack) {
    return { kind: 'minions', x: pack.minion.x, y: pack.minion.y };
  }

  const threat = nearestOf(self, enemyHeroes);
  if (!threat) {
    const dx = homeX - self.x;
    const dy = homeY - self.y;
    const len = Math.hypot(dx, dy) || 1;
    return { kind: 'safe', x: self.x + (dx / len) * 220, y: self.y + (dy / len) * 120 };
  }

  const awayX = self.x - threat.x;
  const awayY = self.y - threat.y;
  const awayLen = Math.hypot(awayX, awayY) || 1;
  const homeBias = 0.42;
  const nx = awayX / awayLen * (1 - homeBias) + ((homeX - self.x) / (Math.hypot(homeX - self.x, homeY - self.y) || 1)) * homeBias;
  const ny = awayY / awayLen * (1 - homeBias) + ((homeY - self.y) / (Math.hypot(homeX - self.x, homeY - self.y) || 1)) * homeBias;
  const nlen = Math.hypot(nx, ny) || 1;
  return {
    kind: 'safe',
    x: self.x + (nx / nlen) * 280,
    y: self.y + (ny / nlen) * 280,
  };
};
