import { HeroCombatConfig } from './hero';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Ranged support. High range, attack speed, and Pulse damage; low HP / knockback.
 * Pulse is a dual-SMG light attack; the kit is built around protecting allies.
 */
export const MENDER_RATINGS = {
  health: 40,
  stamina: 58,
  staminaRegen: 80,
  damage: 7,
  defense: 32,
  speed: 62,
  attackSpeed: 87,
  attackRange: 88,
  knockback: 22,
} as const satisfies CoreRatings;

export const MENDER = {
  id: 'mender',
  displayName: 'Mender',
  role: 'support' as const,
  ratings: MENDER_RATINGS,
  ...gameplayFromRatings(MENDER_RATINGS),
  attackArcDegrees: 22,
  bodyRadius: NINJA.bodyRadius,
  /** Fast Pulse volleys should spend a slice of the pool, not dump it. */
  attackStaminaMul: 0.85,
  dashMaxCharges: 3,
} as const satisfies HeroCombatConfig;
