import { NINJA_KICK, NINJA_SMOKE } from '../ninja/tunables';
import { GUN_BARRAGE_SPEED_BASE } from '../death/tunables';
import { SHADOW } from '../../../config/shadow';
import { abilityDamage } from '../../../config/ratings';
import { COMBAT } from '../../../config/combat';

export const DEMON_ATTACK = {
  animMs: 160,
  speed: Math.round(GUN_BARRAGE_SPEED_BASE * 1.05),
  radius: 5.2,
  lifetimeMs: 1600,
  knockbackMul: 0.22,
  staminaDamage: 1,
  hitReactionMs: 70,
  color: 0xff7a28,
} as const;

export const DEMON_BURN = {
  candleDamage: 1,
  candleTickMs: 500,
  candleDurationMs: 2000,
  hellfireDamage: 1.25,
  hellfireTickMs: 500,
  hellfireDurationMs: 3000,
} as const;

export const DEMON_HELLFIRE = {
  cooldownMs: 9000,
  range: NINJA_KICK.dashDistance,
  radius: Math.round(NINJA_SMOKE.radius * 0.65),
  durationMs: 4000,
  throwSpeed: 640,
  candleRadius: 6,
  explodeDamageRating: 6,
  explodeDamage: 6,
  tickDamage: 3.2,
  tickMs: 500,
  knockbackMul: 1.15,
  staminaDamage: 3,
} as const;

export const DEMON_HELL_BAT = {
  cooldownMs: 9000,
  launchDistance: 88,
  launchMs: 140,
  /** Stay a bat until recast, contact, or this timeout. */
  maxDurationMs: 20000,
  moveMul: 1.2,
  defenseMul: 1.35,
  minSpeedFrac: 0.72,
  /** Ignore a second E press that lands in the same swing as the start. */
  recastLockMs: 220,
  explodeOnContact: true,
  radius: NINJA_SMOKE.radius,
  damageRating: 38,
  damage: abilityDamage(38),
  knockbackMul: 4.6,
  launchCap: 760,
  staminaDamage: 4,
  slowMul: 0.75,
  attackSlowMul: 1.25,
  slowMs: 1500,
  recoilDistance: 148,
  deferCooldown: true,
} as const;

export const DEMON_RAGE = {
  /** Transformation pause before Big Demon can act. */
  lockMs: 1000,
  /** Big Demon window after the transform pause ends. */
  durationMs: 9000,
  /** Meter needs 35% more damage to fill. */
  fillCostMul: 1.35,
  /** 20% of light-attack damage converts into rage, relative to the rating-50 ability hit. */
  lightDamageToRage: 0.20,
  /** 12% of ability damage converts into rage on the same curve. */
  abilityDamageToRage: 0.12,
  /** Restored when Big Demon form actually starts. */
  staminaOnActivate: 0.2,
  /** Applied when the 1s transform pause ends and Big form begins. */
  healOnActivate: 0.08,
} as const;

export const DEMON_CLAW = {
  animMs: 240,
  knockbackMul: 0.85,
  hitReactionMs: 160,
} as const;

export const demonMeleeRange = (): number => Math.round(SHADOW.attackRange * 0.75);

export const demonHellBatRecoil = (distance: number): number =>
  Math.sqrt(Math.max(0, distance) * COMBAT.bodyDrag * 2);
