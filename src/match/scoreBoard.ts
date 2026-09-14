import type { TeamId } from '../config/hero';
import type { TeamScore } from './ScoreManager';

export type ScoreWorld = {
  alpha: number;
  bravo: number;
  alphaMomentum: number;
  bravoMomentum: number;
  lastKillAt: number;
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

let world: ScoreWorld = {
  alpha: 0,
  bravo: 0,
  alphaMomentum: 0,
  bravoMomentum: 0,
  lastKillAt: 0,
};

/** HUD-visible team score plus a short fight-momentum EMA from hero kills. */
export const publishScore = (score: TeamScore, killer?: TeamId, now = 0): void => {
  world.alpha = score.alpha;
  world.bravo = score.bravo;
  if (!killer) {
    return;
  }
  world.alphaMomentum *= 0.84;
  world.bravoMomentum *= 0.84;
  if (killer === 'alpha') {
    world.alphaMomentum = clamp(world.alphaMomentum + 0.3, -1, 1);
    world.bravoMomentum = clamp(world.bravoMomentum - 0.24, -1, 1);
  } else {
    world.bravoMomentum = clamp(world.bravoMomentum + 0.3, -1, 1);
    world.alphaMomentum = clamp(world.alphaMomentum - 0.24, -1, 1);
  }
  world.lastKillAt = now;
};

export const resetScoreWorld = (): void => {
  world = {
    alpha: 0,
    bravo: 0,
    alphaMomentum: 0,
    bravoMomentum: 0,
    lastKillAt: 0,
  };
};

export const scoreWorld = (): ScoreWorld => world;

export const scoreHintFor = (team: TeamId): { self: number; enemy: number; momentum: number; lastKillAt: number } => {
  const foe: TeamId = team === 'alpha' ? 'bravo' : 'alpha';
  return {
    self: team === 'alpha' ? world.alpha : world.bravo,
    enemy: foe === 'alpha' ? world.alpha : world.bravo,
    momentum: team === 'alpha' ? world.alphaMomentum : world.bravoMomentum,
    lastKillAt: world.lastKillAt,
  };
};
