import { HeroCombatConfig } from './hero';
import { NINJA, NINJA_BASE_RANGE } from './ninja';

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
  /** Long versus Ninja, then 13% tighter so the light wedge is less generous. */
  attackRange: Math.round(NINJA_BASE_RANGE * 1.85 * 0.87),
  /** 1/4 narrower than the original 108° Cole wedge. */
  attackArcDegrees: 81,
  bodyRadius: NINJA.bodyRadius,
  staminaRegenPerSecond: 17,
  ammoMax: 4,
  reloadMs: 2500,
  dashMaxCharges: 2,
} as const satisfies HeroCombatConfig;
