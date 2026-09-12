import { NINJA } from '../../../config/ninja';

/**
 * Ninja kit numbers. Kept off the shared COMBAT table so other heroes
 * can ship completely different radii, timings, and effects.
 */
export const NINJA_SMOKE = {
  cooldownMs: 15000,
  durationMs: 4000,
  expandMs: 280,
  /** 15% larger than Ninja's actual body hit radius. */
  radius: NINJA.bodyRadius * 1.15,
  blastDistance: 108,
  blastDurationMs: 170,
  moveMul: 0.7,
  attackSpeedMul: 0.7,
  staminaDrainMul: 1.05,
} as const;

export const NINJA_KICK = {
  cooldownMs: 8000,
  dashDistance: 112,
  dashDurationMs: 125,
  maxTargets: 4,
  /** Path width uses body radii plus a small contact slop. */
  pathPadding: 8,
  damageMul: 1.12,
  knockbackMul: 3.15,
  secondaryKnockbackMul: 2.45,
  staminaDamage: 6,
  backflipMs: 260,
  backflipDistance: 46,
} as const;

export const NINJA_TORNADO = {
  durationMs: 3000,
  /** 20% larger than Ninja's actual attack radius. */
  radius: NINJA.attackRange * 1.2,
  swipeIntervalMs: 165,
  hitCooldownMs: 280,
  damageMul: 0.86,
  stunMs: 150,
  knockback: 92,
  bounceSpeed: 400,
  staminaDamage: 3,
} as const;
