import { HeroCombatConfig } from './hero';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Foundational frontliner. Conversion preserves current punches, reach, and
 * weight. Ratings describe that kit rather than rewriting it.
 */
export const COLE_RATINGS = {
  health: 60,
  stamina: 48,
  staminaRegen: 54,
  damage: 57,
  defense: 50,
  speed: 48,
  attackSpeed: 26,
  attackRange: 74,
  knockback: 52,
} as const satisfies CoreRatings;

const coleGameplay = gameplayFromRatings(COLE_RATINGS);

/** Converted Cole reach before the 25% light-attack tighten. Derived kits keep this. */
export const COLE_CONVERTED_RANGE = coleGameplay.attackRange;

export const COLE = {
  id: 'cole',
  displayName: 'Cole',
  role: 'frontliner',
  ratings: COLE_RATINGS,
  ...coleGameplay,
  /** Light-attack / hit-marker reach. 25% tighter than the converted range. */
  attackRange: Math.round(COLE_CONVERTED_RANGE * 0.75),
  /** 20% tighter than the previous 81° Cole wedge. */
  attackArcDegrees: 65,
  bodyRadius: NINJA.bodyRadius,
  staminaRegenPerSecond: 17,
  /** ~6 step-1 punches to 85% of the pool. round(7 × 2.286) = 16. */
  attackStaminaMul: 16 / 7,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
