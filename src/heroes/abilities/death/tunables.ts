import { NINJA_BASE_RANGE } from '../../../config/ninja';
import { DEATH } from '../../../config/death';

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
  damageMul: 1.08,
  knockbackMul: 1.15,
} as const;

export const DEATH_GUN = {
  cooldownMs: 16000,
  bullets: 15,
  intervalMs: 350,
  speed: 500,
  radius: 4,
  lifetimeMs: 5000,
  damageMul: 0.38,
  knockbackMul: 0.35,
} as const;

export const DEATH_SMASH = {
  cooldownMs: 11000,
  animMs: 760,
  impactAt: 430,
  radius: Math.round(NINJA_BASE_RANGE * 1.08),
  damageMul: 1.48,
  /**
   * Very strong shove, not a map launch. 1.6 sent bodies ~across a lane.
   * Distance ≈ (knockbackPower * mul)^2 / (2 * COMBAT.bodyDrag).
   */
  knockbackMul: 1.08,
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
  damageMul: 1.2,
  knockbackMul: 3.55,
  spinMs: 720,
} as const;

export const DEATH_KB = DEATH.knockbackPower;
