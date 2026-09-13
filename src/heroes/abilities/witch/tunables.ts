import { SWORD_MINION } from '../../../config/minion';
import { WITCH } from '../../../config/witch';
import { abilityDamage } from '../../../config/ratings';

export const WITCH_SKULL = {
  count: 4,
  spawnGapMs: 40,
  fireGapMs: 30,
  fireDelayMs: 200,
  sequenceMs: 340,
  commitSlowMul: 0.7,
  hitSlowMul: 0.8,
  hitSlowMs: 2000,
  damageMul: 0.28,
  knockbackMul: 0.55,
  staminaDamage: 2,
  speed: 520,
  radius: 5,
  lifetimeMs: 1600,
  wallSpread: 11,
  spawnForward: 20,
} as const;

export const WITCH_TOMBSTONE = {
  cooldownMs: 15000,
  castMs: 1400,
  emergeMs: 520,
  summonCount: 2,
  cap: 4,
  offset: 28,
  protectRadius: 210,
  leashRadius: 250,
} as const;

export const WITCH_SKELETON = {
  id: 'witch-skeleton',
  displayName: 'Skeleton',
  role: 'minion' as const,
  maxHealth: SWORD_MINION.maxHealth * 3,
  maxStamina: SWORD_MINION.maxStamina,
  moveSpeed: SWORD_MINION.moveSpeed,
  attackDamage: SWORD_MINION.attackDamage * 1.5,
  defense: SWORD_MINION.defense,
  knockbackPower: SWORD_MINION.knockbackPower,
  vsMinionKnockback: SWORD_MINION.vsMinionKnockback,
  attackCooldownMs: Math.round(SWORD_MINION.attackCooldownMs / 1.2),
  attackRange: SWORD_MINION.attackRange,
  attackArcDegrees: SWORD_MINION.attackArcDegrees,
  bodyRadius: SWORD_MINION.bodyRadius,
  staminaRegenPerSecond: SWORD_MINION.staminaRegenPerSecond,
  dashMaxCharges: 0,
  windupMs: Math.round(SWORD_MINION.windupMs / 1.2),
  recoveryMs: Math.round(SWORD_MINION.recoveryMs / 1.2),
} as const;

export const WITCH_HEX = {
  cooldownMs: 12000,
  castMs: 1000,
  durationMs: Math.round(5000 * 1.3),
  allyRangeMul: 0.5 * 1.25,
  shieldHealthMul: 0.15,
  moveMul: 1.3,
  attackSpeedMul: 1.3,
} as const;

export const WITCH_ULT = {
  cooldownMs: 45_000,
  castMs: 1600,
  summonCount: 3,
  auraRadiusMul: 0.5,
  debuffMs: 5000,
  moveMul: 0.7,
  attackSlowMul: 1.3,
  damageRating: 28,
  damage: abilityDamage(28),
} as const;

export const witchAttackRange = (): number => WITCH.attackRange;

export const witchAuraRadius = (): number => Math.round(WITCH.attackRange * WITCH_ULT.auraRadiusMul);

export const witchHexAllyRange = (): number => Math.round(WITCH.attackRange * WITCH_HEX.allyRangeMul);

/** Live Witch light-attack range (Cole × 1.2, then another 20%). */
export const WITCH_VS_COLE_RANGE = WITCH.attackRange;
