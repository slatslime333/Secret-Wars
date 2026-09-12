import { NINJA } from '../../../config/ninja';
import { NINJA_TORNADO } from '../ninja/tunables';
import { DEATH } from '../../../config/death';

/** 1 → 2 is the fast pair. Then ~1s before the next pair. */
export const DEATH_ATTACK = {
  pairDelayMs: 1000,
  animMs: 190,
  finisherAnimMs: 280,
  hit3RangeMul: 1.18,
  hit3DamageMul: 1.22,
  hit12KnockbackMul: 1.05,
  hit3KnockbackMul: 1.55,
} as const;

export const DEATH_DASH = {
  damageMul: 1.08,
  knockbackMul: 1.15,
} as const;

export const DEATH_GUN = {
  cooldownMs: 16000,
  bullets: 15,
  intervalMs: 350,
  speed: 500,
  radius: 4,
  lifetimeMs: 5000,
  damageMul: 0.44,
  knockbackMul: 0.35,
} as const;

export const DEATH_SMASH = {
  cooldownMs: 11000,
  animMs: 700,
  impactAt: 420,
  radius: Math.round(NINJA.attackRange * 1.08),
  damageMul: 1.48,
  knockbackMul: 1.6,
  stunMs: 1300,
  batScale: 2.35,
} as const;

export const DEATH_SWEEP = {
  durationMs: 4000,
  radius: NINJA_TORNADO.radius,
  moveMul: 0.52,
  hitCooldownMs: 420,
  damageMul: 1.38,
  knockbackMul: 3.55,
  spinMs: 720,
} as const;

export const DEATH_KB = DEATH.knockbackPower;
