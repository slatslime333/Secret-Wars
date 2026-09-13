import { COLE, COLE_CONVERTED_RANGE } from './cole';

/**
 * Random mid-match objective tunables. Timing is match-elapsed, not remaining
 * clock. Keep new event types out of this file — they register themselves.
 */
export const OBJECTIVE = {
  /** No event may start before this elapsed time. */
  earliestStartMs: 20_000,
  /** Starts at or after 2:20 elapsed are illegal. Valid window is [20s, 2:19]. */
  latestStartMs: 140_000,
  cooldownMs: 60_000,
  announcementMs: 2_400,
  arrowMs: 2_600,
  kinds: ['capture_zone', 'golden_piggy'] as const,
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
  scoreReward: 2,
} as const;

export type ObjectiveKind = (typeof OBJECTIVE.kinds)[number];

export const OBJECTIVE_LABEL: Record<ObjectiveKind, string> = {
  capture_zone: 'CAPTURE ZONE!',
  golden_piggy: 'GOLDEN PIGGY BANK!',
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
