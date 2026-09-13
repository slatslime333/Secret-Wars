import { COLE } from '../../../config/cole';
import { COMBAT } from '../../../config/combat';
import { NINJA_BASE_RANGE } from '../../../config/ninja';
import { abilityDamage } from '../../../config/ratings';

export const COLE_ATTACK = {
  lightSlowMul: 0.4,
  targetSlowMul: 0.8,
  targetSlowMs: 1000,
  animMs: 280,
  knockbackMul: 1.5,
  /** Light punches were launch-capped; drop the felt send by 25%. */
  launchCap: Math.round(COMBAT.launchSpeedCap * 0.75),
} as const;

export const COLE_SHOCKWAVE = {
  radius: Math.round(NINJA_BASE_RANGE * 0.7),
  knockbackNear: COLE.knockbackPower * 3.4,
  knockbackFar: COLE.knockbackPower * 1.35,
} as const;

export const COLE_BALL = {
  cooldownMs: 6000,
  speed: 420,
  lifetimeMs: 2200,
  radius: 20,
  damageRating: 60,
  damage: abilityDamage(60),
  knockbackMul: 5.2,
  /** Lets the ball exceed the shared launch cap so the extra mul actually reads. */
  launchCap: 780,
  explodeRadius: 56,
  chainDamageRating: 14,
  chainDamage: abilityDamage(14),
  chainSlowMul: 0.7,
  chainSlowMs: 2000,
  slowMul: 0.55,
  slowMs: 2000,
  chainRange: 92,
  maxTargets: 4,
} as const;

export const COLE_DISCHARGE = {
  cooldownMs: 8000,
  radius: Math.round(NINJA_BASE_RANGE * 1.4),
  damageRating: 60,
  damage: abilityDamage(60),
  knockbackMul: 3.6,
  paralyzeMs: 1000,
  expandMs: 220,
} as const;

export const COLE_STORM = {
  durationMs: 5000,
  radius: Math.round(NINJA_BASE_RANGE * 2.15),
  moveMul: 0.28,
  strikeIntervalMs: 280,
  arcsPerPulse: 2,
  warningMs: 220,
  strikeRadius: 28,
  damageRating: 64,
  damage: abilityDamage(64),
  slowMul: 0.5,
  slowMs: 1000,
} as const;
