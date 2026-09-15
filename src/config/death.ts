import { HeroCombatConfig } from './hero';
import { COMBAT } from './combat';
import { gameplayFromRatings, type CoreRatings, MELEE_BASE_RANGE } from './ratings';

/**
 * Foundational tank / heavy bruiser. Slow because he is heavy and lacks
 * mobility, not because the controls are unresponsive. Conversion keeps the
 * live HP, swing cadence, and walk speed.
 *
 * Attack Speed 77 (not the draft 45) is required: Death’s 230ms cooldown is
 * much faster than Cole’s 430ms. Displaying 45 would imply a sluggish kit
 * that the live character does not have.
 */
export const DEATH_RATINGS = {
  health: 69,
  stamina: 65,
  staminaRegen: 49,
  damage: 70,
  defense: 70,
  speed: 28,
  attackSpeed: 77,
  attackRange: 54,
  knockback: 60,
} as const satisfies CoreRatings;

export const DEATH = {
  id: 'death',
  displayName: 'Death',
  role: 'tank',
  ratings: DEATH_RATINGS,
  ...gameplayFromRatings(DEATH_RATINGS),
  /** 15% more melee reach than the shared 106px baseline, then another 10%. */
  attackRange: Math.round(MELEE_BASE_RANGE * 1.15 * 1.1),
  attackArcDegrees: COMBAT.attackArcDegrees,
  bodyRadius: 16,
  /** Heavier swings cost more stamina. */
  attackStaminaMul: 1.1,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
