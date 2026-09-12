import { COLE } from '../../../config/cole';
import { NINJA_BASE_RANGE } from '../../../config/ninja';

export const COLE_ATTACK = {
  lightSlowMul: 0.4,
  targetSlowMul: 0.8,
  targetSlowMs: 1000,
  animMs: 280,
  knockbackMul: 2,
} as const;

export const COLE_SHOCKWAVE = {
  radius: Math.round(NINJA_BASE_RANGE * 0.7),
  knockbackNear: COLE.knockbackPower * 3.4,
  knockbackFar: COLE.knockbackPower * 1.35,
} as const;

export const COLE_BALL = {
  cooldownMs: 9000,
  speed: 420,
  lifetimeMs: 2200,
  radius: 20,
  damageMul: 1.55,
  knockbackMul: 3.85,
  explodeRadius: 56,
  chainDamageMul: 0.42,
  chainSlowMul: 0.7,
  chainSlowMs: 1000,
  chainRange: 92,
  maxTargets: 4,
} as const;

export const COLE_DISCHARGE = {
  cooldownMs: 10000,
  radius: NINJA_BASE_RANGE,
  damageMul: 1.55,
  knockbackMul: 3.6,
  paralyzeMs: 1000,
  expandMs: 220,
} as const;

export const COLE_STORM = {
  durationMs: 5000,
  radius: Math.round(NINJA_BASE_RANGE * 2.15),
  moveMul: 0.28,
  strikeIntervalMs: 280,
  warningMs: 220,
  strikeRadius: 28,
  damageMul: 1.7,
  slowMul: 0.5,
  slowMs: 1000,
} as const;
