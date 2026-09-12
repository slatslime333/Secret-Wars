import { HeroCombatConfig } from './hero';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Foundational frontliner. Conversion preserves current punches, reach, and
 * weight. Ratings describe that kit rather than rewriting it.
 */
export const COLE_RATINGS = {
  health: 60,
  stamina: 60,
  damage: 55,
  defense: 50,
  speed: 48,
  attackSpeed: 36,
  attackRange: 74,
  knockback: 67,
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
  ammoMax: 4,
  reloadMs: 2500,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
