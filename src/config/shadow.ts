import { HeroCombatConfig } from './hero';
import { COLE } from './cole';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Melee frontliner. Cole-sized, slower than Ninja, short claws.
 * Attack Speed 39 converts to 410ms, then the shared 1.22 swing multiplier
 * yields a 0.5s light-attack cadence.
 */
export const SHADOW_RATINGS = {
  health: 70,
  stamina: 50,
  damage: 50,
  defense: 40,
  speed: 39,
  attackSpeed: 39,
  attackRange: 50,
  knockback: 47,
} as const satisfies CoreRatings;

const shadowGameplay = gameplayFromRatings(SHADOW_RATINGS);

export const SHADOW = {
  id: 'shadow',
  displayName: 'Shadow',
  role: 'frontliner' as const,
  ratings: SHADOW_RATINGS,
  ...shadowGameplay,
  /** 25% shorter than Cole’s live attack radius. */
  attackRange: Math.round(COLE.attackRange * 0.75),
  attackArcDegrees: 68,
  bodyRadius: NINJA.bodyRadius,
  staminaRegenPerSecond: 16,
  /** 9 light attacks × ~9.3 stamina ≈ 84 of 116 — leftover for kit. */
  attackStaminaMul: 1.33,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
