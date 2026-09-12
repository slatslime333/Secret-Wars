import { NINJA } from '../../../config/ninja';

/**
 * Ninja kit numbers. Kept off the shared COMBAT table so other heroes
 * can ship completely different radii, timings, and effects.
 */
export const NINJA_SMOKE = {
  cooldownMs: 10000,
  durationMs: 4000,
  expandMs: 280,
  /** 15% larger than Ninja's actual attack radius, not the body hitbox. */
  radius: NINJA.attackRange * 1.15,
  /** Twice the original 108px blast so the escape actually relocates Ninja. */
  blastDistance: 216,
  blastDurationMs: 170,
  moveMul: 0.7,
  attackSpeedMul: 0.7,
  staminaDrainMul: 1.05,
} as const;

export const NINJA_KICK = {
  cooldownMs: 6300,
  dashDistance: 112,
  dashDurationMs: 125,
  maxTargets: 4,
  /** Path width uses body radii plus a small contact slop. */
  pathPadding: 8,
  /** Dash-corridor half-width shown while aiming. Matches segmentHitsCircle. */
  aimHalfWidth: NINJA.bodyRadius + NINJA.bodyRadius + 8,
  damageMul: 1.28,
  knockbackMul: 5.05,
  secondaryKnockbackMul: 3.85,
  /** Lets the kick exceed the shared launch cap without changing other heroes. */
  launchCap: 740,
  staminaDamage: 6,
  hitStopMs: 100,
  backflipMs: 460,
  backflipDistance: 192,
  missRecoverMs: 200,
  missRecoverDistance: 34,
  jumpHeight: 44,
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
