import { COMBAT } from '../../../config/combat';
import { SHADOW } from '../../../config/shadow';
import { abilityDamage } from '../../../config/ratings';

export const SHADOW_ATTACK = {
  animMs: 280,
  /** Keep light-attack launch far below Cole while the 47 rating stays. */
  knockbackMul: 0.32,
} as const;

export const SHADOW_MARK = {
  durationMs: 3000,
  tickMs: 1000,
  healthPerSecond: 0.0125,
} as const;

export const SHADOW_CLAW = {
  cooldownMs: 15000,
  animMs: 640,
  impactAt: 260,
  /**
   * Frozen at the previous live radius (143 × 2 × 0.65).
   * Light-attack range grew 25%; Claw does not inherit that bump.
   */
  radius: 186,
  halfArc: 0.95,
  aimHalfWidth: SHADOW.bodyRadius * 2 + 10,
  damageRating: 64,
  damage: abilityDamage(64) * 2.7,
  knockbackMul: 5.2,
  launchCap: 780,
  staminaDamage: 7,
} as const;

export const SHADOW_DASH = {
  cooldownMs: 8000,
  distance: Math.round(COMBAT.dashDistance * 1.45),
  durationMs: 140,
  aimHalfWidth: SHADOW.bodyRadius * 2 + 8,
  pathPadding: 10,
  damageRating: 44,
  damage: abilityDamage(44) * 1.35,
  knockbackMul: 3.4,
  staminaDamage: 4,
  slowMul: 0.8,
  attackSlowMul: 1.2,
  slowMs: 2000,
} as const;

export const SHADOW_RAGE = {
  castMs: 2000,
  durationMs: 7000,
  staminaRegenMul: 1.4,
  moveMul: 1.2,
  attackSpeedMul: 1.3,
  staminaPoolMul: 0.2,
  defenseMul: 1.1,
} as const;
