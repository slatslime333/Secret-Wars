import { HeroCombatConfig } from './hero';
import { COLE_CONVERTED_RANGE } from './cole';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Attack Speed 38 is the live barrage cadence. Displayed rating matches conversion.
 */
export const WITCH_RATINGS = {
  health: 65,
  stamina: 53,
  staminaRegen: 59,
  damage: 42,
  defense: 64,
  speed: 39,
  attackSpeed: 38,
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
  attackArcDegrees: 22,
  bodyRadius: NINJA.bodyRadius,
  /** 7 barrages × 12 stamina ≈ 84 of 122 — meaningful recharge, leftover for kit. */
  attackStaminaMul: 1.65,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
