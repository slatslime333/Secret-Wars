import type { HeroCombatConfig } from './hero';
import type { TeamId } from './hero';
import { NINJA } from './ninja';

export type MinionKind = 'sword' | 'ranger';

/**
 * Working minion baselines — easy to retune. Heroes stay the individual
 * threat; these numbers exist to make groups matter.
 */
export const MINION = {
  scanRadius: 260,
  leashRadius: 340,
  retargetMs: 420,
  switchScore: 48,
  separateRadius: 22,
  separatePush: 28,
  hitKnockbackMul: 0.48,
  hitReactionMs: 110,
  deathFadeMs: 280,
  groupJitter: 36,
  /** Reserved for the future wave director. Not used to spawn automatically. */
  wave: {
    maxLiving: 24,
    defaultComposition: { sword: 3, ranger: 1 },
  },
} as const;

export const SWORD_MINION = {
  id: 'sword-minion',
  displayName: 'Sword Minion',
  role: 'minion',
  maxHealth: 38,
  maxStamina: 40,
  moveSpeed: 138,
  attackDamage: 5,
  defense: 8,
  knockbackPower: 90,
  attackCooldownMs: 920,
  attackRange: 44,
  attackArcDegrees: 70,
  bodyRadius: 9,
  staminaRegenPerSecond: 10,
  ammoMax: 99,
  reloadMs: 400,
  dashMaxCharges: 0,
  windupMs: 180,
  recoveryMs: 220,
} as const satisfies HeroCombatConfig & { windupMs: number; recoveryMs: number };

export const RANGER_MINION = {
  id: 'ranger-minion',
  displayName: 'Ranger Minion',
  role: 'minion',
  maxHealth: 26,
  maxStamina: 32,
  moveSpeed: 132,
  attackDamage: 3,
  defense: 6,
  knockbackPower: 55,
  attackCooldownMs: 1280,
  /** Limited poke — not map-wide. */
  attackRange: Math.round(NINJA.attackRange * 1.95),
  attackArcDegrees: 28,
  bodyRadius: 9,
  staminaRegenPerSecond: 10,
  ammoMax: 99,
  reloadMs: 400,
  dashMaxCharges: 0,
  windupMs: 240,
  recoveryMs: 260,
  projectileSpeed: 380,
  projectileRadius: 3,
  projectileLifetimeMs: 1400,
  /** Radians of random aim cone. ~8° either side. */
  spreadRad: 0.14,
} as const satisfies HeroCombatConfig & {
  windupMs: number;
  recoveryMs: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileLifetimeMs: number;
  spreadRad: number;
};

export const minionStatsOf = (kind: MinionKind): HeroCombatConfig =>
  kind === 'ranger' ? RANGER_MINION : SWORD_MINION;

export const minionAdvanceX = (team: TeamId): number => (team === 'alpha' ? 1 : -1);
