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

const ninjaGameplay = gameplayFromRatings(NINJA_RATINGS);

export const NINJA = {
  id: 'ninja',
  displayName: 'Ninja',
  role: 'disruptor' as const,
  ratings: NINJA_RATINGS,
  ...ninjaGameplay,
  /** 15% more light-attack reach, then another 13% on the live radius. */
  attackRange: Math.round(ninjaGameplay.attackRange * 1.15 * 1.13),
  attackArcDegrees: COMBAT.attackArcDegrees,
  bodyRadius: 14,
  /** Not a displayed core stat. Kept at the live regen rate. */
  /** Fastest practical regen on the roster. Costs stay efficient via attackStaminaMul. */
  staminaRegenPerSecond: 14 + (26 - 14) * (70 / 99),
  /** Best light-attack stamina efficiency. */
  attackStaminaMul: 0.85,
  dashMaxCharges: 4,
} as const satisfies HeroCombatConfig;
