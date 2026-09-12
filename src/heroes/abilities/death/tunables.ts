import { NINJA_BASE_RANGE } from '../../../config/ninja';
import { DEATH } from '../../../config/death';
import { abilityDamage } from '../../../config/ratings';

/** 1 → 2 is the fast pair. Then a short pause before the next pair. */
export const DEATH_ATTACK = {
  pairDelayMs: 820,
  animMs: 210,
  finisherAnimMs: 300,
  hit3RangeMul: 1.18,
  hit3DamageMul: 1.22,
  hit12KnockbackMul: 1.05,
  hit3KnockbackMul: 1.55,
  /** Extra radians past the hitmarker edge for anticipation / follow-through. */
  lightWindupRad: 0.62,
  lightFollowRad: 0.78,
  lightBatScale: 1.78,
  lightFinisherBatScale: 2.12,
} as const;

export const DEATH_DASH = {
  damageRating: 54,
  damage: abilityDamage(54),
  knockbackMul: 1.15,
} as const;

export const DEATH_GUN = {
  cooldownMs: 14500,
  bullets: 15,
  intervalMs: 350,
  speed: 500,
  radius: 4,
  lifetimeMs: 5000,
  damageRating: 16,
  damage: abilityDamage(16),
  knockbackMul: 0.35,
  /** Radians of random aim cone. ~7.5° either side — readable spray, not a laser. */
  spreadRad: 0.13,
} as const;

export const DEATH_SMASH = {
  cooldownMs: 7000,
  animMs: 760,
  impactAt: 430,
  radius: Math.round(NINJA_BASE_RANGE * 1.08),
  damageRating: 66,
  damage: abilityDamage(66),
  /**
   * Aimed shove along the smash, not a sideways sweep.
   * launchCap keeps a running target from stacking into a map launch.
   */
  knockbackMul: 1.22,
  launchCap: 310,
  stunMs: 1300,
  batScale: 2.55,
  windupRad: 2.15,
  followRad: 2.05,
} as const;

export const DEATH_SWEEP = {
  durationMs: 4000,
  radius: NINJA_BASE_RANGE * 1.2,
  moveMul: 0.52,
  hitCooldownMs: 420,
  damageRating: 58,
  damage: abilityDamage(58),
  knockbackMul: 3.55,
  spinMs: 720,
} as const;

export const DEATH_KB = DEATH.knockbackPower;
