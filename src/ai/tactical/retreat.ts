import { ARENA, arenaInnerBounds } from '../../config/arena';
import type { CombatantView, Situation } from './types';

const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

export type RetreatGoal = {
  kind: 'safe' | 'minions' | 'homeward';
  x: number;
  y: number;
};

export type RetreatPrefer = 'any' | 'cover' | 'minions';

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

const clampPoint = (x: number, y: number): { x: number; y: number } => {
  const box = arenaInnerBounds(18);
  return {
    x: Math.max(box.minX, Math.min(box.maxX, x)),
    y: Math.max(box.minY, Math.min(box.maxY, y)),
  };
};

const threatScore = (x: number, y: number, enemies: CombatantView[]): number => {
  let nearest = 1e9;
  for (const enemy of enemies) {
    if (!enemy.visible) {
      continue;
    }
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d < nearest) {
      nearest = d;
    }
  }
  return nearest;
};

/**
 * Pick a recovery point from what this CPU can currently see.
 * Always step away from danger — never snap back to the spawn pad.
 */
export const pickRetreatGoal = (situation: Situation, prefer: RetreatPrefer = 'any'): RetreatGoal => {
  const { self, allies, enemies, homeX, homeY } = situation;
  const enemyHeroes = enemies.filter((unit) => unit.kind === 'hero' && unit.visible);
  const allyMinions = allies.filter((unit) => unit.kind === 'minion' && unit.visible);
  const threat = nearestOf(self, enemyHeroes.length > 0 ? enemyHeroes : enemies.filter((unit) => unit.visible));

  const pack = allyMinions[0]
    ? allyMinions.reduce(
        (best, minion) => {
          const d = dist(self, minion);
          return d < best.d ? { minion, d } : best;
        },
        { minion: allyMinions[0], d: dist(self, allyMinions[0]) },
      )
    : undefined;
  const packSafe =
    Boolean(pack) && !enemyHeroes.some((hero) => dist(hero, pack!.minion) < 200);
  if (prefer === 'minions' && pack) {
    return { kind: 'minions', x: pack.minion.x, y: pack.minion.y };
  }
  if ((prefer === 'any' || prefer === 'minions') && pack && packSafe && self.hpRatio > 0.12) {
    return { kind: 'minions', x: pack.minion.x, y: pack.minion.y };
  }

  const step = prefer === 'cover' ? 360 : 300;
  let dx = 0;
  let dy = 0;
  if (threat) {
    dx = self.x - threat.x;
    dy = self.y - threat.y;
  } else {
    dx = homeX - self.x;
    dy = homeY - self.y;
    const len = Math.hypot(dx, dy) || 1;
    const point = clampPoint(self.x + (dx / len) * 180, self.y + (dy / len) * 80);
    return { kind: 'homeward', ...point };
  }

  const awayLen = Math.hypot(dx, dy) || 1;
  const quietLane =
    self.y < ARENA.laneY.mid - 80 ? ARENA.laneY.top : self.y > ARENA.laneY.mid + 80 ? ARENA.laneY.bottom : self.y;
  const candidates: Array<{ x: number; y: number }> = [];
  for (const sign of [1, -1]) {
    const nx = dx / awayLen;
    const ny = dy / awayLen;
    const ox = -ny * sign;
    const oy = nx * sign;
    candidates.push(
      clampPoint(self.x + nx * step + ox * 70, self.y + ny * step * 0.85 + oy * 90),
      clampPoint(self.x + nx * (step * 0.55) + ox * 140, quietLane),
    );
  }
  candidates.push(clampPoint(self.x + (dx / awayLen) * step, self.y + (dy / awayLen) * step));

  let best = candidates[0];
  let bestGap = -1;
  for (const candidate of candidates) {
    const gap = threatScore(candidate.x, candidate.y, enemyHeroes.length > 0 ? enemyHeroes : enemies);
    const spawnPull = Math.hypot(candidate.x - homeX, candidate.y - homeY);
    const score = gap - spawnPull * 0.08;
    if (score > bestGap) {
      bestGap = score;
      best = candidate;
    }
  }

  const spawnGap = Math.hypot(self.x - homeX, self.y - homeY);
  if (spawnGap < 90) {
    return { kind: 'safe', ...best };
  }
  return { kind: prefer === 'cover' ? 'safe' : 'safe', ...best };
};
