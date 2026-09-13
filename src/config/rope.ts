import { HeroCombatConfig } from './hero';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Long-range harasser / support. Ratings stay inside the same power band as
 * Ninja / Cole / Death: high range and speed, low HP and light-attack damage.
 *
 * Attack Speed 53 converts to 328ms, then the shared 1.22 swing multiplier
 * yields a 400ms light-attack cadence.
 */
export const ROPE_RATINGS = {
  health: 38,
  stamina: 60,
  damage: 32,
  defense: 48,
  speed: 86,
  attackSpeed: 53,
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
  /** Same endurance pool regen as Cole. */
  staminaRegenPerSecond: 17,
  /** Baseline cost: 12 light shots ≈ 84 of 128 stamina. */
  attackStaminaMul: 1,
  dashMaxCharges: 3,
} as const satisfies HeroCombatConfig;
