import { COLE } from '../../../config/cole';
import { NINJA } from '../../../config/ninja';

export const COLE_ATTACK = {
  lightSlowMul: 0.4,
  targetSlowMul: 0.8,
  targetSlowMs: 1000,
  animMs: 280,
} as const;

export const COLE_SHOCKWAVE = {
  radius: Math.round(NINJA.attackRange * 0.7),
  knockbackNear: COLE.knockbackPower * 3.4,
  knockbackFar: COLE.knockbackPower * 1.35,
} as const;

export const COLE_BALL = {
  cooldownMs: 15000,
  speed: 420,
  lifetimeMs: 2200,
  radius: 15,
  damageMul: 1.55,
  knockbackMul: 3.1,
  chainDamageMul: 0.42,
  chainSlowMul: 0.7,
  chainSlowMs: 1000,
  chainRange: 92,
  maxTargets: 4,
} as const;

export const COLE_DISCHARGE = {
  cooldownMs: 20000,
  radius: NINJA.attackRange,
  damageMul: 1.55,
  knockbackMul: 3.6,
  paralyzeMs: 1000,
  expandMs: 220,
} as const;

export const COLE_STORM = {
  durationMs: 3000,
  radius: Math.round(NINJA.attackRange * 2.15),
  moveMul: 0.28,
  strikeIntervalMs: 280,
  warningMs: 220,
  strikeRadius: 28,
  damageMul: 1.7,
  slowMul: 0.5,
  slowMs: 1000,
} as const;
