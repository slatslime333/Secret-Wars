import { HeroCombatConfig } from './hero';
import { COMBAT } from './combat';
import { NINJA_BASE_RANGE } from './ninja';

/**
 * Working Death baseline — durable bruiser. Power is heavy hits, absorb,
 * and disruption, not one-shots.
 */
export const DEATH = {
  id: 'death',
  displayName: 'Death',
  role: 'frontliner',
  maxHealth: 198,
  maxStamina: 140,
  moveSpeed: 148,
  attackDamage: 17,
  defense: 34,
  knockbackPower: 210,
  attackCooldownMs: 230,
  attackRange: NINJA_BASE_RANGE,
  attackArcDegrees: COMBAT.attackArcDegrees,
  bodyRadius: 16,
  staminaRegenPerSecond: 16,
  ammoMax: 6,
  reloadMs: 1800,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
