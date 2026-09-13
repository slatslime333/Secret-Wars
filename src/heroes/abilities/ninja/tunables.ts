import { NINJA } from '../../../config/ninja';
import { abilityDamage } from '../../../config/ratings';

/**
 * Ninja kit numbers. Kept off the shared COMBAT table so other heroes
 * can ship completely different radii, timings, and effects.
 *
 * Ability Damage ratings convert through `abilityDamage()` so live hit amounts
 * stay in the same defense-rounding buckets as the previous attackDamage * mul.
 */
export const NINJA_SMOKE = {
  cooldownMs: 10000,
  durationMs: 4000,
  expandMs: 280,
  /** Attack radius * 1.15, then another 15% for the current smoke size. */
  radius: NINJA.attackRange * 1.15 * 1.15,
  /** Drop the cloud a short step along aim, not on Ninja's feet. */
  spawnAhead: 52,
  /** Twice the original 108px blast so the escape actually relocates Ninja. */
  blastDistance: 216,
  blastDurationMs: 170,
  moveMul: 0.6,
  attackSpeedMul: 0.7,
  staminaDrainMul: 1.05,
} as const;

export const NINJA_KICK = {
  cooldownMs: 5700,
  dashDistance: Math.round(112 * 1.2),
  dashDurationMs: 125,
  maxTargets: 4,
  /** Path width uses body radii plus a small contact slop. */
  pathPadding: 8,
  /** Dash-corridor half-width shown while aiming. Matches segmentHitsCircle. */
  aimHalfWidth: NINJA.bodyRadius + NINJA.bodyRadius + 8,
  damageRating: 51,
  /** 15% more than the converted kick so the connect actually rewards the dash. */
  damage: abilityDamage(51) * 1.15,
  knockbackMul: 6.9,
  secondaryKnockbackMul: 5.15,
  /** Lets the kick exceed the shared launch cap without changing other heroes. */
  launchCap: 858,
  staminaDamage: 6,
  hitStopMs: 300,
  hitSlowMul: 0.5,
  hitSlowMs: 1500,
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
  damageRating: 33,
  damage: abilityDamage(33),
  stunMs: 150,
  knockback: 92,
  bounceSpeed: 400,
  staminaDamage: 3,
} as const;
