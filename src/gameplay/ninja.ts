export const NINJA_STATS = {
  attack: 75,
  defense: 75,
  health: 75,
  stamina: 75,
  specialAttack: 75,
  specialDefense: 75,
  speed: 75,
  attackSpeed: 75,
} as const;

export const NINJA_STATES = [
  'IDLE',
  'WALK',
  'BLOCK',
  'NORMAL_ATTACK',
  'HEAVY_ATTACK',
  'ABILITY_1',
  'ABILITY_2',
  'ULTIMATE',
  'DASH',
  'HURT_STUNNED',
] as const;

export type NinjaState = (typeof NINJA_STATES)[number];

export const NINJA_CONFIG = {
  role: 'MEDIUM FRONTLINER',
  maxHealth: 100,
  maxStamina: 100,
  walkSpeed: 105,
  runSpeed: 185,
  dashSpeed: 820,
  attackRadius: 78,
  lightAttackCost: 2.5,
  heavyAttackCost: 10,
  blockCost: 7,
  dashCost: 12,
  lightAttackInterval: 225,
  comboWindow: 620,
  blockDuration: 350,
  blockCooldown: 4000,
  dashDuration: 145,
  dashCooldown: 4000,
  staminaRecoveryPerSecond: 19,
} as const;
