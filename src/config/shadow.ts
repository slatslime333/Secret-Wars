import { HeroCombatConfig } from './hero';
import { COLE_CONVERTED_RANGE } from './cole';
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
  staminaRegen: 66,
  damage: 52,
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
  /**
   * Previous live Cole×0.75 (143px), then +25% on that light-attack radius,
   * then two −10% cuts on the resulting swipe.
   * Claw radius is frozen separately so this does not shrink the ability.
   */
  attackRange: Math.round(Math.round(Math.round(Math.round(COLE_CONVERTED_RANGE * 0.75) * 1.25) * 0.9) * 0.9),
  attackArcDegrees: 68,
  bodyRadius: NINJA.bodyRadius,
  /** Moderately fast — quicker than Death’s 16/s, not Ninja-fast. Rage still multiplies this. */
  staminaRegenPerSecond: 20,
  /** ~8 step-1 swipes to 85% of the pool. round(7 × 1.714) = 12. */
  attackStaminaMul: 12 / 7,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
