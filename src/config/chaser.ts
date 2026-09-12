/**
 * Practice opponent for Demo 1. Unused in the live match. Gameplay values are
 * pinned to the old conversion so this dummy does not shift with the playable
 * 50-baseline curves.
 */
export const CHASER = {
  id: 'chaser',
  displayName: 'Chaser',
  ratings: {
    health: 62,
    stamina: 50,
    attackDamage: 54,
    defense: 48,
    knockbackPower: 52,
    movementSpeed: 46,
    attackCooldown: 38,
    attackRange: 62,
  },
  maxHealth: 140,
  moveSpeed: 184,
  attackDamage: 12,
  defense: 21,
  knockbackPower: 183,
  attackCooldownMs: 328,
  attackRange: 103,
  bodyRadius: 15,
} as const;
