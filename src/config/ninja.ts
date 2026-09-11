import { NINJA_RATING, fromRating } from './ratings';

const r = NINJA_RATING;

/**
 * Ninja is the only Demo 1 hero: average generalist, 70/99 on every primary.
 * Converted values live here so combat code never hardcodes 70.
 */
export const NINJA = {
  id: 'ninja',
  displayName: 'Ninja',
  role: 'Baseline generalist',
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
  attackRange: Math.round(fromRating(r, 64, 100)),
  bodyRadius: 14,
  staminaRegenPerSecond: fromRating(r, 14, 26),
} as const;
