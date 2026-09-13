import { applyDefense } from '../combat/damage';
import { COLE } from './cole';
import { DEATH } from './death';
import { NINJA, NINJA_BASE_RANGE } from './ninja';
import { gameplayFromRatings } from './ratings';
import { NINJA_KICK, NINJA_TORNADO } from '../heroes/abilities/ninja/tunables';
import { COLE_BALL, COLE_DISCHARGE, COLE_STORM } from '../heroes/abilities/cole/tunables';
import { DEATH_DASH, DEATH_GUN, DEATH_SMASH, DEATH_SWEEP } from '../heroes/abilities/death/tunables';

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
    maxHealth: 147,
    maxStamina: 122,
    moveSpeed: 205,
    attackDamage: 13,
    defense: 26,
    knockbackPower: 205,
    attackCooldownMs: 201,
    attackRange: 109,
  },
  cole: {
    maxHealth: 168,
    maxStamina: 128,
    moveSpeed: 168,
    attackDamage: 14,
    defense: 28,
    knockbackPower: 210,
    attackCooldownMs: 494,
    attackRange: 191,
  },
  death: {
    maxHealth: 198,
    maxStamina: 140,
    moveSpeed: 148,
    attackDamage: 17,
    defense: 34,
    knockbackPower: 210,
    attackCooldownMs: 230,
    attackRange: 134,
  },
};

const OLD_ABILITY_RAW = {
  kick: 13 * 1.28 * 1.15,
  tornado: 13 * 0.86,
  ball: 14 * 1.55,
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
        (id === 'death' && key === 'attackRange') || (id === 'ninja' && key === 'attackRange');
      if (!skipConverted && fromRatings[key] !== expected) {
        mismatches.push(`${id}.${key} converted ${fromRatings[key]} !== pinned ${expected}`);
      }
    });
  });

  const abilityPairs: Array<[string, number, number]> = [
    ['kick', NINJA_KICK.damage, OLD_ABILITY_RAW.kick],
    ['tornado', NINJA_TORNADO.damage, OLD_ABILITY_RAW.tornado],
    ['ball', COLE_BALL.damage, OLD_ABILITY_RAW.ball],
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

  if (mismatches.length > 0) {
    throw new Error(`Foundational stat lock failed:\n${mismatches.join('\n')}`);
  }
};
