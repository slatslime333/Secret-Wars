import { applyDefense } from '../combat/damage';
import { COLE } from './cole';
import { DEATH } from './death';
import { NINJA, NINJA_BASE_RANGE } from './ninja';
import { SHADOW } from './shadow';
import { gameplayFromRatings } from './ratings';
import { lightAttackStaminaCost } from './combat';
import { NINJA_KICK, NINJA_TORNADO } from '../heroes/abilities/ninja/tunables';
import { COLE_BALL, COLE_DISCHARGE, COLE_STORM } from '../heroes/abilities/cole/tunables';
import { DEATH_DASH, DEATH_GUN, DEATH_SMASH, DEATH_SWEEP } from '../heroes/abilities/death/tunables';
import { SHADOW_CLAW, SHADOW_DASH } from '../heroes/abilities/shadow/tunables';
import { backflipKickDef } from '../heroes/abilities/ninja/backflipKick';

type PinnedStats = {
  maxHealth: number;
  maxStamina: number;
  moveSpeed: number;
  attackDamage: number;
  defense: number;
  knockbackPower: number;
  attackCooldownMs: number;
  attackRange: number;
};

/** Live gameplay numbers from before the 50-baseline conversion. Do not drift. */
export const PINNED_GAMEPLAY: Record<'ninja' | 'cole' | 'death', PinnedStats> = {
  ninja: {
    maxHealth: 143,
    maxStamina: 112,
    moveSpeed: 205,
    attackDamage: 13,
    defense: 26,
    knockbackPower: 205,
    attackCooldownMs: 201,
    attackRange: 123,
  },
  cole: {
    maxHealth: 168,
    maxStamina: 120,
    moveSpeed: 172,
    attackDamage: 14,
    defense: 28,
    knockbackPower: 210,
    attackCooldownMs: 449,
    attackRange: 217,
  },
  death: {
    maxHealth: 185,
    maxStamina: 134,
    moveSpeed: 146,
    attackDamage: 16,
    defense: 37,
    knockbackPower: 231,
    attackCooldownMs: 230,
    attackRange: 134,
  },
};

const OLD_ABILITY_RAW = {
  kick: 13 * 1.28 * 1.15,
  tornado: 13 * 0.86,
  chain: 14 * 0.42,
  discharge: 14 * 1.55,
  storm: 14 * 1.7,
  gun: 17 * 0.38,
  smash: 17 * 1.48,
  sweep: 17 * 1.2,
  dash: 17 * 1.08,
} as const;

const DEFENSE_SAMPLES = [26, 28, 34] as const;

const sameDefenseBuckets = (a: number, b: number): boolean =>
  DEFENSE_SAMPLES.every((defense) => applyDefense(a, defense) === applyDefense(b, defense));

export const assertFoundationalStatLock = (): void => {
  const converted = {
    ninja: gameplayFromRatings(NINJA.ratings),
    cole: gameplayFromRatings(COLE.ratings),
    death: gameplayFromRatings(DEATH.ratings),
  };

  const mismatches: string[] = [];
  if (NINJA_BASE_RANGE !== 106) {
    mismatches.push(`NINJA_BASE_RANGE ${NINJA_BASE_RANGE} !== 106`);
  }

  (['ninja', 'cole', 'death'] as const).forEach((id) => {
    const pinned = PINNED_GAMEPLAY[id];
    const live = id === 'ninja' ? NINJA : id === 'cole' ? COLE : DEATH;
    const fromRatings = converted[id];
    (Object.keys(pinned) as (keyof PinnedStats)[]).forEach((key) => {
      const expected = pinned[key];
      if (live[key] !== expected) {
        mismatches.push(`${id}.${key} live ${live[key]} !== pinned ${expected}`);
      }
      const skipConverted =
        (id === 'death' && key === 'attackRange') ||
        (id === 'ninja' && key === 'attackRange') ||
        (id === 'cole' && key === 'attackRange');
      if (!skipConverted && fromRatings[key] !== expected) {
        mismatches.push(`${id}.${key} converted ${fromRatings[key]} !== pinned ${expected}`);
      }
    });
  });

  const abilityPairs: Array<[string, number, number]> = [
    ['kick', NINJA_KICK.damage, OLD_ABILITY_RAW.kick],
    ['tornado', NINJA_TORNADO.damage, OLD_ABILITY_RAW.tornado],
    ['chain', COLE_BALL.chainDamage, OLD_ABILITY_RAW.chain],
    ['discharge', COLE_DISCHARGE.damage, OLD_ABILITY_RAW.discharge],
    ['storm', COLE_STORM.damage, OLD_ABILITY_RAW.storm],
    ['gun', DEATH_GUN.damage, OLD_ABILITY_RAW.gun],
    ['smash', DEATH_SMASH.damage, OLD_ABILITY_RAW.smash],
    ['sweep', DEATH_SWEEP.damage, OLD_ABILITY_RAW.sweep],
    ['dash', DEATH_DASH.damage, OLD_ABILITY_RAW.dash],
  ];
  abilityPairs.forEach(([name, convertedDamage, previous]) => {
    if (!sameDefenseBuckets(convertedDamage, previous)) {
      mismatches.push(`${name} defense buckets drifted (${convertedDamage} vs ${previous})`);
    }
  });

  if (SHADOW.ratings.damage !== 68) {
    mismatches.push(`shadow damage rating ${SHADOW.ratings.damage} !== 68`);
  }
  if (SHADOW.ratings.defense !== 39) {
    mismatches.push(`shadow defense rating ${SHADOW.ratings.defense} !== 39`);
  }
  if (SHADOW.attackDamage !== 16) {
    mismatches.push(`shadow attackDamage ${SHADOW.attackDamage} !== 16`);
  }
  if (SHADOW.attackRange !== 109) {
    mismatches.push(`shadow attackRange ${SHADOW.attackRange} !== 109`);
  }
  if (SHADOW_CLAW.radius !== 186) {
    mismatches.push(`shadow claw radius ${SHADOW_CLAW.radius} !== 186`);
  }
  if (SHADOW_CLAW.damage !== 50) {
    mismatches.push(`shadow claw damage ${SHADOW_CLAW.damage} !== 50`);
  }
  if (SHADOW_DASH.damage !== 26) {
    mismatches.push(`shadow dash damage ${SHADOW_DASH.damage} !== 26`);
  }
  if (Math.abs(SHADOW_DASH.knockbackMul - 3.4 * 1.25) > 0.001) {
    mismatches.push(`shadow dash knockbackMul ${SHADOW_DASH.knockbackMul} !== ${3.4 * 1.25}`);
  }
  const shadowCost = lightAttackStaminaCost(1, SHADOW.attackStaminaMul);
  const coleCost = lightAttackStaminaCost(1, COLE.attackStaminaMul);
  if (Math.round((SHADOW.maxStamina * 0.85) / shadowCost) !== 8) {
    mismatches.push(`shadow lights-to-recover ${Math.round((SHADOW.maxStamina * 0.85) / shadowCost)} !== 8 (cost ${shadowCost})`);
  }
  if (Math.round((COLE.maxStamina * 0.85) / coleCost) !== 6) {
    mismatches.push(`cole lights-to-recover ${Math.round((COLE.maxStamina * 0.85) / coleCost)} !== 6 (cost ${coleCost})`);
  }
  if (backflipKickDef.maxCharges !== 1 || backflipKickDef.startingCharges !== 1) {
    mismatches.push(`ninja kick charges ${backflipKickDef.maxCharges}/${backflipKickDef.startingCharges} !== 1`);
  }
  if (DEATH_SMASH.knockback > 600 || DEATH_SMASH.knockback < 350) {
    mismatches.push(`death smash knockback ${DEATH_SMASH.knockback} is not a heavy shove`);
  }
  if (DEATH_GUN.intervalMs !== 238) {
    mismatches.push(`gun barrage interval ${DEATH_GUN.intervalMs} !== 238`);
  }
  if (Math.round(COLE_BALL.damage) !== 30) {
    mismatches.push(`electric ball displayed damage ${Math.round(COLE_BALL.damage)} !== 30`);
  }

  if (mismatches.length > 0) {
    throw new Error(`Foundational stat lock failed:\n${mismatches.join('\n')}`);
  }
};
