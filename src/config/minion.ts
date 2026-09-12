import type { HeroCombatConfig } from './hero';
import type { TeamId } from './hero';
import { NINJA_BASE_RANGE } from './ninja';

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
  /** Soft spacing so clumps unstick without flying apart. */
  separateRadius: 26,
  separatePush: 38,
  /** Hero hits still land a shove, not a launch. */
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

/**
 * Muted team skins. Bright cyan/red stay on pennants; bodies use darker
 * readable versions so squads are obvious without going neon.
 */
export const MINION_TEAM_SKIN = {
  alpha: {
    skin: 0x1f6d76,
    skinDark: 0x134850,
    cloth: 0x16343c,
    leather: 0x2a4a48,
  },
  bravo: {
    skin: 0x8a3036,
    skinDark: 0x54181e,
    cloth: 0x3a161c,
    leather: 0x5a2a24,
  },
} as const;

export const SWORD_MINION = {
  id: 'sword-minion',
  displayName: 'Sword Minion',
  role: 'minion',
  /** ~4 Death lights / ~6 Ninja lights. Durable unit, not a tiny hero. */
  maxHealth: 64,
  maxStamina: 40,
  moveSpeed: 138,
  attackDamage: 4,
  defense: 8,
  knockbackPower: 90,
  /**
   * Applied only vs opposing minions, as the final launch speed.
   * ~70px travel — a visible shove, not a map launch.
   */
  vsMinionKnockback: 280,
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
} as const satisfies HeroCombatConfig & {
  windupMs: number;
  recoveryMs: number;
  vsMinionKnockback: number;
};

export const RANGER_MINION = {
  id: 'ranger-minion',
  displayName: 'Ranger Minion',
  role: 'minion',
  /** ~3 Death lights / ~4 Ninja lights. */
  maxHealth: 48,
  maxStamina: 32,
  moveSpeed: 132,
  attackDamage: 2,
  defense: 6,
  knockbackPower: 55,
  attackCooldownMs: 1560,
  /** Limited poke — not map-wide. */
  attackRange: Math.round(NINJA_BASE_RANGE * 1.95),
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
  projectileColor: 0xe8c878,
  /** Radians of random aim cone. ~8° either side. */
  spreadRad: 0.14,
} as const satisfies HeroCombatConfig & {
  windupMs: number;
  recoveryMs: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileLifetimeMs: number;
  projectileColor: number;
  spreadRad: number;
};

export const minionStatsOf = (kind: MinionKind): HeroCombatConfig =>
  kind === 'ranger' ? RANGER_MINION : SWORD_MINION;

export const minionAdvanceX = (team: TeamId): number => (team === 'alpha' ? 1 : -1);
