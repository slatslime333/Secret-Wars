import { COMBAT } from './combat';
import { HeroCombatConfig } from './hero';
import { NINJA_RATING, fromRating } from './ratings';

const r = NINJA_RATING;

/**
 * Support / disruptor. Stats stay on the 70 baseline for now — identity
 * lives in the kit and role tag, not a full rebalance.
 */
export const NINJA = {
  id: 'ninja',
  displayName: 'Ninja',
  role: 'support' as const,
  rating: r,
  ratings: {
    health: r,
    stamina: r,
    attackDamage: r,
    defense: r,
    knockbackPower: r,
    movementSpeed: r,
    attackCooldown: r,
    attackRange: r,
  },
  maxHealth: Math.round(fromRating(r, 90, 170)),
  maxStamina: Math.round(fromRating(r, 80, 140)),
  moveSpeed: Math.round(fromRating(r, 145, 230)),
  attackDamage: Math.round(fromRating(r, 7, 16)),
  defense: Math.round(fromRating(r, 10, 32)),
  knockbackPower: Math.round(fromRating(r, 120, 240)),
  /** Higher rating = faster swings. Range is slow → fast milliseconds. */
  attackCooldownMs: Math.round(fromRating(r, 300, 160)),
  /** Low-to-medium melee. Not a long-range poke. */
  attackRange: Math.round(fromRating(r, 78, 118)),
  attackArcDegrees: COMBAT.attackArcDegrees,
  bodyRadius: 14,
  staminaRegenPerSecond: fromRating(r, 14, 26),
  ammoMax: COMBAT.attackAmmoMax,
  reloadMs: COMBAT.attackReloadMs,
  dashMaxCharges: COMBAT.dashMaxCharges,
} as const satisfies HeroCombatConfig & { rating: number; ratings: Record<string, number> };
