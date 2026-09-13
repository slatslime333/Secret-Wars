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

export const COLE = {
  id: 'cole',
  displayName: 'Cole',
  role: 'frontliner',
  ratings: COLE_RATINGS,
  ...gameplayFromRatings(COLE_RATINGS),
  /** 20% tighter than the previous 81° Cole wedge. */
  attackArcDegrees: 65,
  bodyRadius: NINJA.bodyRadius,
  staminaRegenPerSecond: 17,
  /** ~6 step-1 punches to 85% of the pool. round(7 × 2.286) = 16. */
  attackStaminaMul: 16 / 7,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
