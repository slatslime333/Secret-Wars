import { HeroCombatConfig } from './hero';
import { NINJA } from './ninja';
import { SHADOW } from './shadow';
import { gameplayFromRatings, type CoreRatings } from './ratings';

/**
 * Little Demon: fragile ranged harasser. Speed and range are the kit;
 * Health and Defense stay low so he cannot trade before transforming.
 */
export const DEMON_RATINGS = {
  health: 34,
  stamina: 53,
  staminaRegen: 58,
  damage: 9,
  defense: 30,
  speed: 60,
  attackSpeed: 48,
  attackRange: 82,
  knockback: 28,
} as const satisfies CoreRatings;

/**
 * Big Demon: temporary melee frontliner. Strong, not 99-across-the-board.
 * Attack Range is Shadow melee minus 25%, applied as an override after conversion.
 */
export const DEMON_BIG_RATINGS = {
  health: 76,
  stamina: 76,
  staminaRegen: 75,
  damage: 65,
  defense: 74,
  speed: 60,
  attackSpeed: 74,
  attackRange: 50,
  knockback: 58,
} as const satisfies CoreRatings;

const littleGameplay = gameplayFromRatings(DEMON_RATINGS);
const bigGameplay = gameplayFromRatings(DEMON_BIG_RATINGS);

export const DEMON = {
  id: 'demon',
  displayName: 'Demon',
  role: 'frontliner' as const,
  ratings: DEMON_RATINGS,
  ...littleGameplay,
  attackArcDegrees: 28,
  bodyRadius: NINJA.bodyRadius,
  attackStaminaMul: 0.85,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;

export const DEMON_BIG = {
  id: 'demon',
  displayName: 'Demon',
  role: 'frontliner' as const,
  ratings: DEMON_BIG_RATINGS,
  ...bigGameplay,
  attackRange: Math.round(SHADOW.attackRange * 0.75),
  attackArcDegrees: 72,
  bodyRadius: NINJA.bodyRadius,
  attackStaminaMul: 12 / 7,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;

/** Live-stat multipliers so level-ups survive the 11-second transform. */
export const DEMON_BIG_MUL = {
  maxHealth: DEMON_BIG.maxHealth / DEMON.maxHealth,
  maxStamina: DEMON_BIG.maxStamina / DEMON.maxStamina,
  moveSpeed: DEMON_BIG.moveSpeed / DEMON.moveSpeed,
  attackDamage: DEMON_BIG.attackDamage / DEMON.attackDamage,
  defense: DEMON_BIG.defense / DEMON.defense,
  knockbackPower: DEMON_BIG.knockbackPower / DEMON.knockbackPower,
  attackCooldownMs: DEMON_BIG.attackCooldownMs / DEMON.attackCooldownMs,
  attackRange: DEMON_BIG.attackRange / DEMON.attackRange,
  staminaRegenPerSecond: DEMON_BIG.staminaRegenPerSecond / DEMON.staminaRegenPerSecond,
} as const;
