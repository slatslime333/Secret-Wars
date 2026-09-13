import { HeroCombatConfig } from './hero';
import { COLE_CONVERTED_RANGE } from './cole';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Ranged tank / support. Slow walk, high range, rapid skull barrages.
 * Attack Speed 53 converts to 328ms, then a 20% grouping gap and the shared
 * 1.22 swing multiplier yield a ~0.48s barrage cadence.
 */
export const WITCH_RATINGS = {
  health: 65,
  stamina: 55,
  staminaRegen: 59,
  damage: 61,
  defense: 64,
  speed: 39,
  attackSpeed: 53,
  attackRange: 85,
  knockback: 36,
} as const satisfies CoreRatings;

const witchGameplay = gameplayFromRatings(WITCH_RATINGS);

/** Previous live light-attack range (Cole × 1.2). Hex and ult keep this radius base. */
export const WITCH_KIT_RANGE = Math.round(COLE_CONVERTED_RANGE * 1.2);

export const WITCH = {
  id: 'witch',
  displayName: 'Witch',
  role: 'ranged-tank' as const,
  ratings: WITCH_RATINGS,
  ...witchGameplay,
  /**
   * Light-attack / skull range is the previous live value plus another 20%.
   * Aim ring and skull `maxRange` read `WITCH.attackRange`.
   */
  attackRange: Math.round(WITCH_KIT_RANGE * 1.2),
  /** Grouping cadence is 20% slower than the converted 400ms barrage. */
  attackCooldownMs: Math.round(witchGameplay.attackCooldownMs * 1.2),
  attackArcDegrees: 22,
  bodyRadius: NINJA.bodyRadius,
  /** 7 barrages × 12 stamina ≈ 84 of 122 — meaningful recharge, leftover for kit. */
  attackStaminaMul: 1.65,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
