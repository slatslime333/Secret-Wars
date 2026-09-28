/**
 * How a hero wants to fight. Personality still decides how boldly they
 * play this identity. These are priorities, not scripts.
 */
export type CombatIdentity = {
  heroId: string;
  /** Prefer angles and short commits over standing in the pocket. */
  mobility: number;
  /** Willing to take a hit to keep pressure. */
  trade: number;
  /** Wait for a large window instead of poking. */
  burst: number;
  /** Stay outside the opponent's melee. */
  rangeKeep: number;
  /** Leave a private target to help an ally. */
  peel: number;
  /** Stay in after the first swing. */
  commit: number;
  /** Change angle and timing instead of repeating a line. */
  unpredictability: number;
};

const IDENTITY: Record<string, CombatIdentity> = {
  ninja: {
    heroId: 'ninja',
    mobility: 0.86,
    trade: 0.34,
    burst: 0.48,
    rangeKeep: 0.28,
    peel: 0.22,
    commit: 0.4,
    unpredictability: 0.62,
  },
  cole: {
    heroId: 'cole',
    mobility: 0.28,
    trade: 0.84,
    burst: 0.36,
    rangeKeep: 0.18,
    peel: 0.48,
    commit: 0.78,
    unpredictability: 0.22,
  },
  death: {
    heroId: 'death',
    mobility: 0.34,
    trade: 0.58,
    burst: 0.86,
    rangeKeep: 0.46,
    peel: 0.4,
    commit: 0.44,
    unpredictability: 0.3,
  },
  rope: {
    heroId: 'rope',
    mobility: 0.78,
    trade: 0.32,
    burst: 0.4,
    rangeKeep: 0.52,
    peel: 0.36,
    commit: 0.34,
    unpredictability: 0.84,
  },
  witch: {
    heroId: 'witch',
    mobility: 0.46,
    trade: 0.24,
    burst: 0.52,
    rangeKeep: 0.88,
    peel: 0.42,
    commit: 0.3,
    unpredictability: 0.4,
  },
  shadow: {
    heroId: 'shadow',
    mobility: 0.8,
    trade: 0.3,
    burst: 0.7,
    rangeKeep: 0.36,
    peel: 0.16,
    commit: 0.28,
    unpredictability: 0.58,
  },
  mender: {
    heroId: 'mender',
    mobility: 0.4,
    trade: 0.18,
    burst: 0.22,
    rangeKeep: 0.74,
    peel: 0.92,
    commit: 0.2,
    unpredictability: 0.24,
  },
  demon: {
    heroId: 'demon',
    mobility: 0.62,
    trade: 0.4,
    burst: 0.46,
    rangeKeep: 0.7,
    peel: 0.2,
    commit: 0.36,
    unpredictability: 0.5,
  },
};

const DEMON_BIG: CombatIdentity = {
  heroId: 'demon',
  mobility: 0.22,
  trade: 0.9,
  burst: 0.58,
  rangeKeep: 0.12,
  peel: 0.34,
  commit: 0.86,
  unpredictability: 0.26,
};

const FALLBACK: CombatIdentity = {
  heroId: 'unknown',
  mobility: 0.45,
  trade: 0.5,
  burst: 0.45,
  rangeKeep: 0.4,
  peel: 0.4,
  commit: 0.5,
  unpredictability: 0.35,
};

export const combatIdentityOf = (heroId: string, demonForm?: string): CombatIdentity => {
  if (heroId === 'demon' && (demonForm === 'big' || demonForm === 'transforming')) {
    return DEMON_BIG;
  }
  return IDENTITY[heroId] ?? FALLBACK;
};
