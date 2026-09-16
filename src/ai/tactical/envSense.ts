import { ENV_WORLD } from '../../config/environment';
import type { EnvSnapshot } from '../../map/EnvironmentWorld';
import type { KitProfile, ScoredAction, Situation, TacticalAction } from './types';

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/**
 * Environment modifies existing utility. Not a second AI brain.
 */
export const applyEnvBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  write: (
    rows: ScoredAction[],
    used: number,
    action: TacticalAction,
    score: number,
    reason: string,
    targetId?: number,
    allyId?: number,
  ) => number,
): number => {
  const env = situation.environment;
  if (!env) {
    return count;
  }
  const self = situation.self;
  const kit = situation.kit;
  const nearestHero = situation.enemies.find((enemy) => enemy.kind === 'hero' && enemy.visible);
  const fightDist = nearestHero ? dist(self.x, self.y, nearestHero.x, nearestHero.y) : 9999;
  const inFight = Boolean(nearestHero) && fightDist < self.attackRange * 1.65;
  const safe = !inFight && self.hpRatio > 0.42;
  const jitter = 0.72 + (situation.personality.opportunism - 0.5) * 0.35 + (situation.personality.reactionQuality - 0.5) * 0.2;

  count = crateBias(out, count, situation, env, kit, inFight, safe, jitter, write);
  count = barrelBias(out, count, situation, env, kit, nearestHero, jitter, write);
  count = wallBias(out, count, situation, env, kit, nearestHero, inFight, jitter, write);
  return count;
};

const crateBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  env: EnvSnapshot,
  kit: KitProfile | undefined,
  inFight: boolean,
  safe: boolean,
  jitter: number,
  write: (
    rows: ScoredAction[],
    used: number,
    action: TacticalAction,
    score: number,
    reason: string,
    targetId?: number,
    allyId?: number,
  ) => number,
): number => {
  const crate = env.crate;
  if (!crate) {
    return count;
  }
  const gap = dist(situation.self.x, situation.self.y, crate.x, crate.y);
  if (gap > 210) {
    return count;
  }
  for (let i = 0; i < count; i += 1) {
    if (out[i].action === 'farm_minions' && inFight) {
      out[i].score -= 14;
    }
  }
  if (inFight) {
    return count;
  }
  const xpNeed = 1 - (situation.self.xpRatio ?? 0.5);
  const lowLevel = (situation.self.level ?? 1) < 4;
  let value = 6 + xpNeed * 10 + (lowLevel ? 4 : 0) - gap / 40;
  if (!safe) {
    value -= 10;
  }
  if (kit?.stance === 'support') {
    value -= 4;
  }
  value *= jitter;
  if (value < 8 || situation.personality.opportunism < 0.28) {
    return count;
  }
  return write(out, count, 'reposition', value, 'safe crate', -1);
};

const barrelBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  env: EnvSnapshot,
  kit: KitProfile | undefined,
  nearestHero: Situation['enemies'][number] | undefined,
  jitter: number,
  write: (
    rows: ScoredAction[],
    used: number,
    action: TacticalAction,
    score: number,
    reason: string,
    targetId?: number,
    allyId?: number,
  ) => number,
): number => {
  const barrel = env.barrel;
  if (!barrel || !nearestHero) {
    return count;
  }
  const selfGap = dist(situation.self.x, situation.self.y, barrel.x, barrel.y);
  const foeGap = dist(nearestHero.x, nearestHero.y, barrel.x, barrel.y);
  if (selfGap < ENV_WORLD.barrelRadius * 0.85) {
    for (let i = 0; i < count; i += 1) {
      if (out[i].action === 'attack' || out[i].action === 'advance') {
        out[i].score -= 10 * jitter;
      }
    }
    return write(out, count, 'reposition', 18 * jitter, 'leave barrel');
  }
  if (foeGap < ENV_WORLD.barrelRadius && selfGap > ENV_WORLD.barrelRadius + 18 && situation.personality.opportunism > 0.38) {
    if (kit?.stance === 'ranged' || kit?.wantsPoke) {
      return write(out, count, 'attack', 12 * jitter, 'barrel near foe', nearestHero.id);
    }
  }
  return count;
};

const wallBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  env: EnvSnapshot,
  kit: KitProfile | undefined,
  nearestHero: Situation['enemies'][number] | undefined,
  inFight: boolean,
  jitter: number,
  write: (
    rows: ScoredAction[],
    used: number,
    action: TacticalAction,
    score: number,
    reason: string,
    targetId?: number,
    allyId?: number,
  ) => number,
): number => {
  const wall = env.wall;
  if (!wall || !nearestHero || inFight) {
    return count;
  }
  const wallGap = dist(situation.self.x, situation.self.y, wall.x, wall.y);
  const through = dist(wall.x, wall.y, nearestHero.x, nearestHero.y);
  const around = dist(situation.self.x, situation.self.y, nearestHero.x, nearestHero.y);
  if (wallGap > 120 || through > around * 0.85) {
    return count;
  }
  const flanker = Boolean(kit?.wantsFlank) || kit?.heroId === 'ninja' || kit?.heroId === 'shadow';
  const deathLikesChoke = kit?.heroId === 'death';
  if (deathLikesChoke) {
    for (let i = 0; i < count; i += 1) {
      if (out[i].action === 'flank') {
        out[i].score -= 6;
      }
    }
    return count;
  }
  if (!flanker || situation.personality.opportunism < 0.34) {
    return count;
  }
  return write(out, count, 'reposition', 11 * jitter, 'break wall flank');
};
