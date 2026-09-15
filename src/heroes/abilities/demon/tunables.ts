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
  radius: NINJA_SMOKE.radius,
  durationMs: 4000,
  throwSpeed: 640,
  candleRadius: 6,
  explodeDamageRating: 46,
  explodeDamage: abilityDamage(46),
  tickDamage: 3.2,
  tickMs: 500,
  knockbackMul: 1.15,
  staminaDamage: 3,
} as const;

export const DEMON_HELL_BAT = {
  cooldownMs: 9000,
  launchDistance: 88,
  launchMs: 140,
  maxDurationMs: 2800,
  moveMul: 1.2,
  defenseMul: 1.35,
  minSpeedFrac: 0.72,
  /** No collide-burst until takeoff has actually moved him. */
  contactGraceMs: 280,
  /** Ignore a second E press that lands in the same swing as the start. */
  recastLockMs: 220,
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
  pathPadding: 6,
} as const;

export const DEMON_RAGE = {
  lockMs: 1000,
  durationMs: 8000,
  candleRage: 0.11,
  burnRage: 0.025,
  hellfireExplodeRage: 0.16,
  hellfireTickRage: 0.04,
  hellBatRage: 0.18,
} as const;

export const DEMON_CLAW = {
  animMs: 240,
  knockbackMul: 0.85,
  hitReactionMs: 160,
} as const;

export const demonMeleeRange = (): number => SHADOW.attackRange;

export const demonHellBatRecoil = (distance: number): number =>
  Math.sqrt(Math.max(0, distance) * COMBAT.bodyDrag * 2);
