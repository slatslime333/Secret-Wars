import type { LaneId } from './arena';
import type { MinionKind } from './minion';

export type MatchPhase = 'PLAYING' | 'OVERTIME' | 'SUDDEN_DEATH' | 'FINISHED';

export type StatGrowthKey = 'maxHealth' | 'attackDamage' | 'defense';

export type LaneWaveShare = Record<LaneId, Record<MinionKind, number>>;

/**
 * Draft match tunables. Change values here — do not scatter them through scenes.
 */
export const MATCH = {
  durationMs: 180_000,
  overtimeMs: 60_000,
  suddenDeathEnabled: true,
  respawnDelayMs: 8_000,
  respawnInvulnMs: 900,
  assistWindowMs: 8_000,
  enemyInwardOffset: 72,
  waves: {
    firstDelayMs: 1_400,
    intervalMs: 24_000,
    maxActivePerTeam: 20,
    sword: 6,
    ranger: 4,
    jitter: 28,
    lanes: {
      top: { sword: 2, ranger: 1 },
      mid: { sword: 2, ranger: 2 },
      bottom: { sword: 2, ranger: 1 },
    } satisfies LaneWaveShare,
  },
  xp: {
    startLevel: 1,
    maxLevel: 10,
    sword: 18,
    ranger: 14,
    debugGrant: 25,
    /** XP needed to leave `level` (level 1 → 2 uses curve(1)). */
    curve: (level: number): number => 70 + (level - 1) * 28,
  },
  healing: {
    minionKill: 5,
  },
  growth: {
    order: ['maxHealth', 'attackDamage', 'defense'] as const satisfies readonly StatGrowthKey[],
    perLevel: {
      maxHealth: 6,
      attackDamage: 1.2,
      defense: 1.4,
    } satisfies Record<StatGrowthKey, number>,
  },
  orbs: {
    speed: 620,
    arriveRadius: 18,
    /** Long enough to cross the 2200-wide map; then the orb is discarded. */
    lifetimeMs: 6_500,
    radius: 5,
  },
} as const;

export const xpForMinion = (kind: MinionKind): number =>
  kind === 'ranger' ? MATCH.xp.ranger : MATCH.xp.sword;

export const xpToNextLevel = (level: number): number => {
  if (level >= MATCH.xp.maxLevel) {
    return 0;
  }
  return MATCH.xp.curve(level);
};

export const waveCountForTeam = (): number => MATCH.waves.sword + MATCH.waves.ranger;
