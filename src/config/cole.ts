import { HeroCombatConfig } from './hero';
import { NINJA } from './ninja';

/**
 * Working Cole baseline — not locked. Power budget is range, coverage, and
 * CC. Direct damage stays respectable, not a carry nuke.
 */
export const COLE = {
  id: 'cole',
  displayName: 'Cole',
  role: 'frontliner',
  maxHealth: 168,
  maxStamina: 128,
  moveSpeed: 168,
  attackDamage: 14,
  defense: 28,
  knockbackPower: 248,
  attackCooldownMs: 430,
  /** Long versus Ninja, still a frontliner — not full-screen. */
  attackRange: Math.round(NINJA.attackRange * 1.85),
  /** 1/4 narrower than the original 108° Cole wedge. */
  attackArcDegrees: 81,
  bodyRadius: NINJA.bodyRadius,
  staminaRegenPerSecond: 17,
  ammoMax: 4,
  reloadMs: 2500,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
