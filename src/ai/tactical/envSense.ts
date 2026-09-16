import { ENV_WORLD } from '../../config/environment';
import type { EnvSnapshot } from '../../map/EnvironmentWorld';
import type { KitProfile, ScoredAction, Situation, TacticalAction } from './types';
import { applyHouseBias } from './houseSense';

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

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
 * Environment modifies existing utility. Not a second AI brain.
 */
export const applyEnvBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  write: Write,
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
  count = treeBias(out, count, situation, env, kit, jitter, write);
  count = buildingBias(out, count, situation, env, kit, inFight, jitter, write);
  count = coverBias(out, count, situation, env, kit, inFight, jitter, write);
  count = applyHouseBias(out, count, situation, write);
  return count;
};

/** Crate smash uses the same light-attack path as minion farm; no fake combatant. */
export const envFarmTarget = (
  situation: Situation,
  action: TacticalAction,
  reason: string,
): { x: number; y: number } | undefined => {
  if (action !== 'farm_minions' || !reason.includes('crate')) {
    return undefined;
  }
  const crate = situation.environment?.crate;
  if (!crate) {
    return undefined;
  }
  return { x: crate.x, y: crate.y };
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
  write: Write,
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
  if (inFight || situation.self.recentlyHit) {
    return count;
  }
  if ((situation.objective?.urgency ?? 0) >= 0.7) {
    return count;
  }
  const xpNeed = 1 - (situation.self.xpRatio ?? 0.5);
  const lowLevel = (situation.self.level ?? 1) < 4;
  let value = 24 + xpNeed * 10 + (lowLevel ? 6 : 0) - gap / 12;
  if (safe) {
    value += 14;
  } else {
    value -= 16;
  }
  if (kit?.stance === 'support' || kit?.heroId === 'cole') {
    value -= kit?.heroId === 'cole' ? 3 : 4;
  }
  if (kit?.heroId === 'ninja' && safe) {
    value += 2;
  }
  if ((situation.self.level ?? 1) >= 5 && xpNeed < 0.35) {
    value -= 10;
  }
  value *= jitter;
  if (value < 8 || situation.personality.opportunism < 0.28) {
    return count;
  }
  if (safe && gap < 140) {
    for (let i = 0; i < count; i += 1) {
      if (out[i].action === 'search_for_target' || out[i].action === 'advance') {
        out[i].score -= 8 + (lowLevel ? 4 : 0);
      }
    }
  }
  return write(out, count, 'farm_minions', value, 'safe crate', -1);
};

const barrelBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  env: EnvSnapshot,
  kit: KitProfile | undefined,
  nearestHero: Situation['enemies'][number] | undefined,
  jitter: number,
  write: Write,
): number => {
  const barrel = env.barrel;
  if (!barrel) {
    return count;
  }
  const selfGap = dist(situation.self.x, situation.self.y, barrel.x, barrel.y);
  const cautious =
    kit?.heroId === 'mender' ||
    kit?.stance === 'support' ||
    (kit?.heroId === 'demon' && situation.self.demonForm !== 'big');
  if (selfGap < ENV_WORLD.barrelRadius * (cautious ? 1.15 : 0.85)) {
    for (let i = 0; i < count; i += 1) {
      if (out[i].action === 'attack' || out[i].action === 'advance') {
        out[i].score -= (cautious ? 28 : 14) * jitter;
      }
    }
    return write(out, count, 'reposition', (cautious ? 24 : 18) * jitter, 'leave barrel');
  }
  if (!nearestHero) {
    return count;
  }
  const foeGap = dist(nearestHero.x, nearestHero.y, barrel.x, barrel.y);
  if (cautious) {
    return count;
  }
  if (foeGap < ENV_WORLD.barrelRadius && selfGap > ENV_WORLD.barrelRadius + 18 && situation.personality.opportunism > 0.38) {
    if (kit?.stance === 'ranged' || kit?.wantsPoke || kit?.heroId === 'witch') {
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
  write: Write,
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
  const heroId = kit?.heroId;
  const littleDemon = heroId === 'demon' && situation.self.demonForm !== 'big';
  if (heroId === 'death') {
    for (let i = 0; i < count; i += 1) {
      if (out[i].action === 'flank') {
        out[i].score -= 6;
      }
    }
    return count;
  }
  if (littleDemon || heroId === 'mender') {
    return count;
  }
  if (heroId === 'witch') {
    return write(out, count, 'reposition', 10 * jitter, 'open sightline');
  }
  const flanker = Boolean(kit?.wantsFlank) || heroId === 'ninja' || heroId === 'shadow' || situation.self.demonForm === 'big';
  if (heroId === 'rope' && around > situation.self.attackRange * 0.7) {
    return write(out, count, 'reposition', 9 * jitter, 'open rope lane');
  }
  if (!flanker || situation.personality.opportunism < 0.34) {
    return count;
  }
  return write(out, count, 'reposition', 11 * jitter, 'break wall flank');
};

const treeBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  env: EnvSnapshot,
  kit: KitProfile | undefined,
  jitter: number,
  write: Write,
): number => {
  const tree = env.tree;
  if (!tree) {
    return count;
  }
  const gap = dist(situation.self.x, situation.self.y, tree.x, tree.y);
  if (gap > 90) {
    return count;
  }
  if (tree.state === 'knocked' && (kit?.heroId === 'rope' || kit?.heroId === 'ninja')) {
    return write(out, count, 'reposition', 9 * jitter, 'leave fallen tree');
  }
  return count;
};

const buildingBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  env: EnvSnapshot,
  kit: KitProfile | undefined,
  inFight: boolean,
  jitter: number,
  write: Write,
): number => {
  const building = env.building;
  if (!building || inFight) {
    return count;
  }
  const gap = dist(situation.self.x, situation.self.y, building.x, building.y);
  if (gap > 180) {
    return count;
  }
  const low = situation.self.hpRatio < 0.38;
  const wantsShelter = kit?.heroId === 'mender' || kit?.heroId === 'ninja' || kit?.heroId === 'witch';
  if (!low || !wantsShelter || situation.personality.caution < 0.28) {
    return count;
  }
  return write(out, count, 'reposition', 10 * jitter, 'use building');
};

const coverBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  env: EnvSnapshot,
  kit: KitProfile | undefined,
  inFight: boolean,
  jitter: number,
  write: Write,
): number => {
  const cover = env.cover;
  if (!cover) {
    return count;
  }
  const gap = dist(situation.self.x, situation.self.y, cover.x, cover.y);
  if (gap > 130 || gap < 22) {
    return count;
  }
  const wantsCover =
    inFight ||
    situation.self.recentlyHit ||
    Boolean(situation.projectile?.willHit) ||
    kit?.heroId === 'cole' ||
    kit?.heroId === 'mender' ||
    kit?.heroId === 'witch';
  if (!wantsCover || situation.personality.caution < 0.18) {
    return count;
  }
  if (!inFight && kit?.heroId !== 'cole' && kit?.heroId !== 'mender' && kit?.heroId !== 'witch') {
    return count;
  }
  return write(out, count, 'reposition', (inFight ? 11 : 8) * jitter, 'use cover');
};
