import { HeroCombatConfig } from './hero';
import { COLE_CONVERTED_RANGE } from './cole';
import { NINJA } from './ninja';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Attack Speed 42 is the live barrage cadence. Displayed rating matches conversion.
 */
export const WITCH_RATINGS = {
  health: 64,
  stamina: 53,
  staminaRegen: 59,
  damage: 65,
  defense: 59,
  speed: 39,
  attackSpeed: 42,
  attackRange: 85,
  knockback: 36,
} as const satisfies CoreRatings;

const witchGameplay = gameplayFromRatings(WITCH_RATINGS);

/** Previous live light-attack range (Cole × 1.2). Hex and ult keep this radius base. */
export const WITCH_KIT_RANGE = Math.round(COLE_CONVERTED_RANGE * 1.2);

/** Light range before this pass. Hit-marker and skull travel scale from here, separately. */
export const WITCH_LIGHT_RANGE_BASE = Math.round(WITCH_KIT_RANGE * 1.2);

/** Visual hit-marker ring only — not skull travel and not Cole's punch radius. */
export const WITCH_HIT_MARKER_RANGE = Math.round(WITCH_LIGHT_RANGE_BASE * 1.6);

/** Aim line extends past the ring so the shot path is readable. */
export const WITCH_HIT_MARKER_LINE = Math.round(WITCH_HIT_MARKER_RANGE * 1.2);

export const WITCH = {
  id: 'witch',
  displayName: 'Witch',
  role: 'ranged-tank' as const,
  ratings: WITCH_RATINGS,
  ...witchGameplay,
  /**
   * Skull travel. Hit-marker ring uses `WITCH_HIT_MARKER_RANGE`, not this.
   */
  attackRange: Math.round(WITCH_LIGHT_RANGE_BASE * 1.15),
  attackArcDegrees: 22,
  bodyRadius: NINJA.bodyRadius,
  /** 7 barrages × 12 stamina ≈ 84 of 122 — meaningful recharge, leftover for kit. */
  attackStaminaMul: 1.65,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
