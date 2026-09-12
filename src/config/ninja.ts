import { COMBAT } from './combat';
import { HeroCombatConfig } from './hero';
import { MELEE_BASE_RANGE, gameplayFromRatings, type CoreRatings } from './ratings';

/** Shared melee-range baseline (rating 50). Other heroes and abilities scale from this. */
export const NINJA_BASE_RANGE = MELEE_BASE_RANGE;

/**
 * Foundational mobile disruptor. Ratings describe the live kit; conversion is
 * tuned so movement, swing timing, and durability stay as they currently feel.
 */
export const NINJA_RATINGS = {
  health: 48,
  stamina: 55,
  damage: 45,
  defense: 45,
  speed: 80,
  attackSpeed: 84,
  attackRange: 42,
  knockback: 50,
} as const satisfies CoreRatings;

export const NINJA = {
  id: 'ninja',
  displayName: 'Ninja',
  role: 'disruptor' as const,
  ratings: NINJA_RATINGS,
  ...gameplayFromRatings(NINJA_RATINGS),
  attackArcDegrees: COMBAT.attackArcDegrees,
  bodyRadius: 14,
  /** Not a displayed core stat. Kept at the live regen rate. */
  staminaRegenPerSecond: 14 + (26 - 14) * (70 / 99),
  ammoMax: 8,
  reloadMs: COMBAT.attackReloadMs,
  dashMaxCharges: COMBAT.dashMaxCharges,
} as const satisfies HeroCombatConfig;
