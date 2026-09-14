import { HeroCombatConfig } from './hero';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Long-range harasser / support. Ratings stay inside the same power band as
 * Ninja / Cole / Death: high range and speed, low HP and light-attack damage.
 *
 * Attack Speed 59 converts to a faster rope cadence than the old 53 rating.
 */
export const ROPE_RATINGS = {
  health: 38,
  stamina: 62,
  staminaRegen: 78,
  damage: 32,
  defense: 48,
  speed: 86,
  attackSpeed: 59,
  attackRange: 90,
  knockback: 36,
} as const satisfies CoreRatings;

export const ROPE = {
  id: 'rope',
  displayName: 'Rope Man',
  role: 'support' as const,
  ratings: ROPE_RATINGS,
  ...gameplayFromRatings(ROPE_RATINGS),
  attackArcDegrees: 28,
  bodyRadius: NINJA.bodyRadius,
  /** Baseline cost: 12 light shots ≈ 84 of 128 stamina. */
  attackStaminaMul: 1,
  dashMaxCharges: 4,
} as const satisfies HeroCombatConfig;
