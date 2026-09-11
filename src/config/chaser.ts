import { fromRating } from './ratings';

/**
 * Practice opponent for Demo 1. Weaker and slower than Ninja (70/99)
 * so combo, block, and dash can be read in a real fight.
 */
const health = 62;
const stamina = 50;
const attackDamage = 54;
const defense = 48;
const knockbackPower = 52;
const movementSpeed = 46;
const attackCooldown = 38;
const attackRange = 62;

export const CHASER = {
  id: 'chaser',
  displayName: 'Chaser',
  ratings: {
    health,
    stamina,
    attackDamage,
    defense,
    knockbackPower,
    movementSpeed,
    attackCooldown,
    attackRange,
  },
  maxHealth: Math.round(fromRating(health, 90, 170)),
  moveSpeed: Math.round(fromRating(movementSpeed, 145, 230)),
  attackDamage: Math.round(fromRating(attackDamage, 7, 16)),
  defense: Math.round(fromRating(defense, 10, 32)),
  knockbackPower: Math.round(fromRating(knockbackPower, 120, 240)),
  attackCooldownMs: Math.round(fromRating(attackCooldown, 420, 180)),
  attackRange: Math.round(fromRating(attackRange, 78, 118)),
  bodyRadius: 15,
} as const;
