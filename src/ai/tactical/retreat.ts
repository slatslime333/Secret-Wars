import { ARENA, arenaInnerBounds } from '../../config/arena';
import type { CombatantView, Situation } from './types';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

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

const heroThreatAt = (x: number, y: number, heroes: CombatantView[]): number => {
  let nearest = 1e9;
  let close = 0;
  for (const hero of heroes) {
    const d = Math.hypot(hero.x - x, hero.y - y);
    if (d < nearest) {
      nearest = d;
    }
    if (d < hero.attackRange * 1.25 + 24) {
      close += 1;
    }
  }
  return nearest - close * 55;
};

/** Corners and walls are traps — worse than a closer open lane. */
const trapPenalty = (x: number, y: number): number => {
  const box = arenaInnerBounds(18);
  const edgeX = Math.min(x - box.minX, box.maxX - x);
  const edgeY = Math.min(y - box.minY, box.maxY - y);
  const wall = Math.min(edgeX, edgeY);
  const corner = Math.min(edgeX, edgeY) + Math.max(edgeX, edgeY) * 0.15;
  let pen = 0;
  if (wall < 90) {
    pen += (90 - wall) * 1.8;
  }
  if (edgeX < 140 && edgeY < 140) {
    pen += (140 - Math.min(edgeX, edgeY)) * 2.4;
  }
  if (corner < 180) {
    pen += 40;
  }
  return pen;
};

const allyCover = (x: number, y: number, allies: CombatantView[], enemies: CombatantView[]): number => {
  let score = 0;
  for (const ally of allies) {
    if (!ally.visible) {
      continue;
    }
    const d = Math.hypot(ally.x - x, ally.y - y);
    if (ally.kind === 'hero' && d < 240) {
      score += 55 - d * 0.12;
    }
    if (ally.kind === 'minion' && d < 160) {
      score += 18 - d * 0.06;
    }
  }
  if (enemies[0]) {
    const threat = nearestOf({ ...enemies[0], x, y } as CombatantView, enemies);
    if (threat) {
      const behind = allies.some((ally) => {
        if (!ally.visible || ally.kind !== 'hero') {
          return false;
        }
        const toThreat = dist(ally, threat);
        const selfToThreat = Math.hypot(threat.x - x, threat.y - y);
        return toThreat + 30 < selfToThreat && dist(ally, { x, y } as CombatantView) < 200;
      });
      if (behind) {
        score += 36;
      }
    }
  }
  return score;
};

const escapeRoom = (x: number, y: number, enemies: CombatantView[]): number => {
  let open = 0;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * 160;
    const py = y + Math.sin(a) * 160;
    const clamped = clampPoint(px, py);
    const blocked = enemies.some((enemy) => Math.hypot(enemy.x - clamped.x, enemy.y - clamped.y) < 90);
    const moved = Math.hypot(clamped.x - x, clamped.y - y);
    if (!blocked && moved > 80) {
      open += 1;
    }
  }
  return open;
};

export type HealMinionPick = {
  minion: CombatantView;
  score: number;
};

/**
 * Isolated enemy minions that can be killed for health without walking into heroes.
 */
export const pickHealMinion = (situation: Situation): HealMinionPick | undefined => {
  const { self, enemies } = situation;
  const heroes = enemies.filter((unit) => unit.kind === 'hero' && unit.visible);
  let best: HealMinionPick | undefined;
  for (const minion of enemies) {
    if (minion.kind !== 'minion' || !minion.visible) {
      continue;
    }
    const d = dist(self, minion);
    if (d > situation.vision * 1.05) {
      continue;
    }
    const heroGap = heroes.reduce((nearest, hero) => Math.min(nearest, dist(hero, minion)), 1e9);
    if (heroGap < 200) {
      continue;
    }
    const pack = enemies.filter(
      (other) => other.kind === 'minion' && other.visible && other.id !== minion.id && dist(other, minion) < 90,
    ).length;
    const quick = 1 - minion.hpRatio;
    let score =
      40 -
      d * 0.06 +
      Math.min(140, heroGap - 200) * 0.22 +
      quick * 18 -
      pack * 4 +
      (minion.hpRatio < 0.45 ? 8 : 0);
    if (heroGap < 260) {
      score -= 12;
    }
    if (self.hpRatio < 0.28) {
      score += 10;
    }
    if (!best || score > best.score) {
      best = { minion, score };
    }
  }
  return best;
};

/**
 * Pick a recovery point from what this CPU can currently see.
 * Prefers cover, allies, and open lanes — not map corners.
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

  const coverAlly = allies
    .filter((ally) => ally.kind === 'hero' && ally.visible)
    .sort((a, b) => dist(self, a) - dist(self, b))[0];

  const step = prefer === 'cover' ? 280 : 240;
  let dx = 0;
  let dy = 0;
  if (threat) {
    dx = self.x - threat.x;
    dy = self.y - threat.y;
  } else {
    dx = homeX - self.x;
    dy = homeY - self.y;
    const len = Math.hypot(dx, dy) || 1;
    const point = clampPoint(self.x + (dx / len) * 160, self.y + (dy / len) * 70);
    return { kind: 'homeward', ...point };
  }

  const awayLen = Math.hypot(dx, dy) || 1;
  const nx = dx / awayLen;
  const ny = dy / awayLen;
  const quietLane =
    self.y < ARENA.laneY.mid - 80 ? ARENA.laneY.top : self.y > ARENA.laneY.mid + 80 ? ARENA.laneY.bottom : self.y;
  const candidates: Array<{ x: number; y: number }> = [];
  for (const sign of [1, -1]) {
    const ox = -ny * sign;
    const oy = nx * sign;
    candidates.push(
      clampPoint(self.x + nx * step + ox * 90, self.y + ny * step * 0.7 + oy * 100),
      clampPoint(self.x + nx * (step * 0.45) + ox * 160, quietLane),
      clampPoint(self.x + ox * 200, self.y + oy * 200),
    );
  }
  candidates.push(clampPoint(self.x + nx * step * 0.7, self.y + ny * step * 0.7));
  if (coverAlly) {
    const behindX = coverAlly.x + (coverAlly.x - (threat?.x ?? coverAlly.x)) * 0.15;
    const behindY = coverAlly.y + (coverAlly.y - (threat?.y ?? coverAlly.y)) * 0.15;
    candidates.push(clampPoint(behindX, behindY));
    candidates.push(clampPoint(coverAlly.x - nx * 40, coverAlly.y - ny * 40));
  }
  const mid = ARENA.width / 2;
  const ownSide = self.team === 'alpha' ? mid - 180 : mid + 180;
  candidates.push(clampPoint(ownSide, quietLane));
  candidates.push(clampPoint(ownSide, ARENA.laneY.mid));

  const threatList = enemyHeroes.length > 0 ? enemyHeroes : enemies;
  let best = candidates[0];
  let bestScore = -1e9;
  for (const candidate of candidates) {
    const gap = heroThreatAt(candidate.x, candidate.y, threatList);
    const cover = allyCover(candidate.x, candidate.y, allies, threatList);
    const room = escapeRoom(candidate.x, candidate.y, threatList) * 14;
    const trap = trapPenalty(candidate.x, candidate.y);
    const travel = Math.hypot(candidate.x - self.x, candidate.y - self.y);
    const idle = travel > 520 ? (travel - 520) * 0.08 : 0;
    const score = gap * 0.55 + cover + room - trap - idle - travel * 0.04;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return { kind: 'safe', ...best };
};
