import { NINJA_BASE_RANGE } from '../../../config/ninja';
import { DEATH } from '../../../config/death';
import { abilityDamage } from '../../../config/ratings';

/** Pre-velocity-buff gun speed. Rope kits keep this so gun buffs do not leak. */
export const GUN_BARRAGE_SPEED_BASE = 625;

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
  bullets: 18,
  /** 15% faster than the previous 280ms cadence. */
  intervalMs: Math.round(280 * 0.85),
  /** 20% more velocity than the previous 625px/s. */
  speed: Math.round(GUN_BARRAGE_SPEED_BASE * 1.2),
  radius: 4,
  lifetimeMs: 5000,
  damageRating: 16,
  damage: abilityDamage(16),
  knockbackMul: 0.35,
  /** Aim laser length while the barrage is firing. */
  laserLength: 720,
  /** Radians of random aim cone. ~7.5° either side — readable spray, not a laser. */
  spreadRad: 0.13,
} as const;

export const DEATH_SMASH = {
  cooldownMs: 7000,
  animMs: 760,
  impactAt: 430,
  radius: Math.round(NINJA_BASE_RANGE * 1.08 * 1.2),
  /** Bat thickness. Hits anywhere along the swinging bat use the same shove. */
  halfWidth: 42,
  damageRating: 66,
  damage: abilityDamage(66),
  /**
   * Strong shove — heavier than a light, not a map-width launch.
   * Global launchSpeedCap still applies as a hard ceiling.
   */
  knockback: 460,
  launchCap: 540,
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
