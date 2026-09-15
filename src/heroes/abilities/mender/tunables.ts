import { COLE_BALL, COLE_DISCHARGE } from '../cole/tunables';
import { GUN_BARRAGE_SPEED_BASE } from '../death/tunables';
import { NINJA_KICK } from '../ninja/tunables';
import { COMBAT } from '../../../config/combat';
import { NINJA_BASE_RANGE } from '../../../config/ninja';
import { MENDER } from '../../../config/mender';
import { abilityDamage } from '../../../config/ratings';

export const MENDER_PULSE = {
  speed: Math.round(GUN_BARRAGE_SPEED_BASE * 1.12),
  radius: 3.4,
  /** Safety cap only. Shots are not range-limited; they fly until a hit or the map edge. */
  lifetimeMs: 8000,
  /** Dual uzis stay close to the aim line. */
  spreadRad: 0.038,
  armOffsetRad: 0.014,
  armReach: 14,
  knockbackMul: 0.42,
  staminaDamage: 2,
  hitSlowMul: 0.88,
  hitSlowMs: 450,
  /** Ally Pulse hits restore a sliver of health and stamina. */
  healHealth: 0.75,
  healStamina: 0.5,
  color: 0x4ec8ff,
} as const;

export const MENDER_ANGEL = {
  cooldownMs: 8000,
  durationMs: 4000,
  speed: COLE_BALL.speed,
  radius: 18,
  lifetimeMs: 1600,
  maxRange: Math.round(MENDER.attackRange * 1.15),
  /** Throw line is longer than the ball's travel so the aim reads at range. */
  aimLength: Math.round(MENDER.attackRange * 1.85),
  healRatio: 1 / 5,
  staminaRatio: 0.35,
  staminaCap: 22,
  explodeDamage: abilityDamage(8),
  explodeKnockbackMul: COLE_DISCHARGE.knockbackMul * 0.9,
  baseRadius: Math.round(COLE_DISCHARGE.radius * 0.42),
  maxRadius: Math.round(COLE_DISCHARGE.radius * 1.12),
  absorbRef: 50,
} as const;

export const MENDER_SOUL = {
  cooldownMs: 16000,
  dashDistance: NINJA_KICK.dashDistance,
  dashDurationMs: NINJA_KICK.dashDurationMs,
  pathPadding: 10,
  buffMs: 8000,
  healMaxHp: 0.15,
  moveMul: 1.2,
  attackSpeedMul: 1.2,
  staminaRegenMul: 1.2,
  backflipMs: NINJA_KICK.backflipMs,
  backflipDistance: NINJA_KICK.backflipDistance,
  jumpHeight: NINJA_KICK.jumpHeight,
  attachOffset: 36,
  auraTint: 0xe03040,
} as const;

export const MENDER_WIND = {
  durationMs: 8500,
  /** 15% smaller than the previous Ninja-range × 2.35 field. */
  radius: Math.round(Math.round(NINJA_BASE_RANGE * 2.35) * 0.85),
  healPerSecond: 4,
  staminaRegenMul: 1.22,
  defenseMul: 1.4,
  enemySlowMul: 0.82,
  pulseMs: 280,
} as const;

export const menderSoulRange = (): number => MENDER_SOUL.dashDistance;

export const menderAngelRange = (): number => MENDER_ANGEL.maxRange;

/** Shared recoil speed for the Soul Dash exit, matching Backflip Kick. */
export const menderExitRecoil = (distance: number): number =>
  Math.sqrt(Math.max(0, distance) * COMBAT.bodyDrag * 2);
