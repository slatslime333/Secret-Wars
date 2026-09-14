import { COLE, COLE_CONVERTED_RANGE } from './cole';

/**
 * Random mid-match objective tunables. Timing is match-elapsed, not remaining
 * clock. Every kind listed here is in the live rotation; ObjectiveManager's
 * factory must handle each one so unknown types cannot collapse to Capture Zone.
 */
export const OBJECTIVE = {
  /** No event may start before this elapsed time. */
  earliestStartMs: 20_000,
  /**
   * First event must start early enough that a later kind still fits after
   * the 60s cooldown. Valid first-start window is [20s, 50s].
   */
  firstLatestStartMs: 50_000,
  /** Starts at or after 2:20 elapsed are illegal. Valid window is [20s, 2:19]. */
  latestStartMs: 140_000,
  cooldownMs: 60_000,
  announcementMs: 2_400,
  arrowMs: 2_600,
  kinds: ['capture_zone', 'golden_piggy', 'bounty_target', 'healing_shrine', 'executioner'] as const,
  /** After the first event, prefer a different kind this often. */
  rerollSameKind: 0.72,
  capture: {
    /** 80% of Cole's light-attack reach. */
    radius: Math.round(COLE_CONVERTED_RANGE * 0.8),
    captureMs: 20_000,
    graceMs: 5_000,
    /** Decay speed after grace. 1 = same rate as capturing. */
    decayMul: 1,
  },
  piggy: {
    radius: 58,
    /** ~30 Cole lights. One hero can finish it; a team finishes much faster. */
    breakDamage: Math.round(COLE.attackDamage * 30),
    projectileDamage: COLE.attackDamage,
  },
  bounty: {
    levelReward: 2,
    buffMs: 20_000,
    moveMul: 1.3,
    attackMul: 1.3,
  },
  shrine: {
    radius: Math.round(COLE_CONVERTED_RANGE * 0.72),
    durationMs: 20_000,
    healPerSecond: 9,
  },
  executioner: {
    radius: 48,
    /** 20% less HP than the original 40 Cole-hit pool. */
    breakDamage: Math.round(COLE.attackDamage * 40 * 0.8),
    projectileDamage: COLE.attackDamage,
    moveSpeed: 74,
    /** 25% slower swings than the original 1550ms cadence. */
    attackMs: Math.round(1_550 / 0.75),
    attackRange: 88,
    damage: Math.round(COLE.attackDamage * 2.15 * 0.9),
    knockback: 3.7,
    pursueRange: 440,
    buffMs: 20_000,
    moveMul: 1.18,
    attackMul: 1.18,
    staminaMul: 1.18,
  },
  /** Team score awarded for Golden Piggy Bank. */
  scoreReward: 1,
  auraTint: 0xe23b3b,
} as const;

export type ObjectiveKind = (typeof OBJECTIVE.kinds)[number];

export const OBJECTIVE_LABEL: Record<ObjectiveKind, string> = {
  capture_zone: 'CAPTURE ZONE!',
  golden_piggy: 'GOLDEN PIGGY BANK!',
  bounty_target: 'BOUNTY TARGET!',
  healing_shrine: 'HEALING SHRINE!',
  executioner: 'EXECUTIONER!',
};

export const canStartObjective = (
  elapsedMs: number,
  cooldownUntilMs: number,
  active: boolean,
): boolean => {
  if (active) {
    return false;
  }
  if (elapsedMs < OBJECTIVE.earliestStartMs) {
    return false;
  }
  if (elapsedMs >= OBJECTIVE.latestStartMs) {
    return false;
  }
  return elapsedMs >= cooldownUntilMs;
};

export const pickObjectiveStartAt = (
  earliestMs: number,
  latestExclusiveMs: number,
  rng: () => number,
): number | undefined => {
  const lo = Math.max(OBJECTIVE.earliestStartMs, earliestMs);
  const hi = Math.min(OBJECTIVE.latestStartMs, latestExclusiveMs) - 1;
  if (lo > hi) {
    return undefined;
  }
  return lo + rng() * (hi - lo);
};

export const pickObjectiveKind = (previous: ObjectiveKind | undefined, rng: () => number): ObjectiveKind => {
  const kinds = OBJECTIVE.kinds;
  if (!previous || kinds.length < 2 || rng() > OBJECTIVE.rerollSameKind) {
    return kinds[Math.floor(rng() * kinds.length)] ?? 'capture_zone';
  }
  const others = kinds.filter((kind) => kind !== previous);
  return others[Math.floor(rng() * others.length)] ?? previous;
};

/** Fisher–Yates copy so every registered kind appears before any repeat. */
export const shuffleObjectiveKinds = (rng: () => number): ObjectiveKind[] => {
  const deck = [...OBJECTIVE.kinds];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = deck[i];
    const b = deck[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    deck[i] = b;
    deck[j] = a;
  }
  return deck;
};

/** Consume the next kind from a shuffled deck, refilling when empty. */
export const nextObjectiveKind = (queue: ObjectiveKind[], rng: () => number): ObjectiveKind => {
  if (queue.length === 0) {
    queue.push(...shuffleObjectiveKinds(rng));
  }
  return queue.shift() ?? OBJECTIVE.kinds[0] ?? 'capture_zone';
};
