import { COLE, COLE_CONVERTED_RANGE } from './cole';
import { MATCH } from './match';

/**
 * Mid-match event tunables. Timing is match-elapsed, not remaining clock.
 * Every kind listed here is in the live rotation; ObjectiveManager's factory
 * must handle each one so unknown types cannot collapse to Capture Zone.
 */
export const OBJECTIVE = {
  /** Opening Capture Zone. Always within the first 10 seconds. */
  earliestStartMs: 5_000,
  openingLatestMs: 10_000,
  openingAtMs: 5_000,
  openingKind: 'capture_zone' as const,
  /**
   * Events may start until the match clock ends. This is not a late-game
   * cutoff — it tracks MATCH.durationMs so the 4-minute window stays honest.
   */
  latestStartMs: MATCH.durationMs,
  /** Short gap after an event ends before the next fair-random pick. */
  gapMinMs: 2_500,
  gapMaxMs: 4_500,
  /** Exclude this many most-recent kinds from the next fair pick. */
  antiRepeat: 2,
  announcementMs: 3_200,
  arrowMs: 2_800,
  kinds: [
    'capture_zone',
    'golden_piggy',
    'bounty_target',
    'healing_shrine',
    'executioner',
    'war_banner',
    'rage_zone',
    'meteor_storm',
  ] as const,
  capture: {
    /** 80% of Cole's light-attack reach. */
    radius: Math.round(COLE_CONVERTED_RANGE * 0.8),
    captureMs: 20_000,
    graceMs: 5_000,
    /** Decay speed after grace. 1 = same rate as capturing. */
    decayMul: 1,
    xpShare: 0.75,
    buffMs: 10_000,
    moveMul: 1.1,
  },
  piggy: {
    radius: 58,
    /** ~30 Cole lights. One hero can finish it; a team finishes much faster. */
    breakDamage: Math.round(COLE.attackDamage * 30),
    projectileDamage: COLE.attackDamage,
    xpShare: 0.25,
  },
  bounty: {
    levelReward: 1,
  },
  shrine: {
    radius: Math.round(COLE_CONVERTED_RANGE * 0.72),
    durationMs: 20_000,
    healPerSecond: 7,
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
    buffMs: 10_000,
    moveMul: 1.1,
    attackMul: 1.1,
    staminaMul: 1.1,
    xpShare: 0.5,
  },
  banner: {
    radius: 88,
    durationMs: 20_000,
    claimMs: 3_000,
    carrierMoveMul: 0.85,
    carrierDamageMul: 1.05,
    xpShare: 0.75,
  },
  rage: {
    radius: Math.round(COLE_CONVERTED_RANGE * 1.45),
    durationMs: 16_000,
    moveMul: 1.4,
    attackMul: 1.1,
    knockbackMul: 1.1,
  },
  meteor: {
    durationMs: 15_000,
    warningMs: 850,
    impactRadius: 72,
    damage: Math.round(COLE.attackDamage * 2.6),
    knockback: 290,
    intervalMs: 2_200,
    firstDelayMs: 450,
    radius: 72,
  },
  /** Team score awarded for Golden Piggy Bank and War Banner. */
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
  war_banner: 'WAR BANNER!',
  rage_zone: 'RAGE ZONE!',
  meteor_storm: 'METEOR STORM!',
};

export const OBJECTIVE_PROMPT: Record<ObjectiveKind, string> = {
  capture_zone: 'Control the zone!',
  golden_piggy: 'Break the pig first!',
  bounty_target: 'Kill the marked target!',
  healing_shrine: 'Hold the shrine to heal!',
  executioner: 'Slay the Executioner!',
  war_banner: 'Claim and protect the banner!',
  rage_zone: 'Fight inside the Rage Zone!',
  meteor_storm: 'Dodge incoming meteors!',
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
  return elapsedMs >= cooldownUntilMs;
};

export const pickObjectiveStartAt = (
  earliestMs: number,
  latestExclusiveMs: number,
  rng: () => number,
): number | undefined => {
  const lo = Math.max(0, earliestMs);
  const hi = latestExclusiveMs - 1;
  if (lo > hi) {
    return undefined;
  }
  return lo + rng() * (hi - lo);
};

export const pickFairObjectiveKind = (recent: readonly ObjectiveKind[], rng: () => number): ObjectiveKind => {
  const kinds = OBJECTIVE.kinds;
  const blocked = new Set(recent.slice(-OBJECTIVE.antiRepeat));
  const pool = kinds.filter((kind) => !blocked.has(kind));
  const use = pool.length > 0 ? pool : [...kinds];
  return use[Math.floor(rng() * use.length)] ?? 'capture_zone';
};

export const pickObjectiveKind = (previous: ObjectiveKind | undefined, rng: () => number): ObjectiveKind =>
  pickFairObjectiveKind(previous ? [previous] : [], rng);

export const nextObjectiveKind = (recent: readonly ObjectiveKind[], rng: () => number): ObjectiveKind => {
  if (recent.length === 0) {
    return OBJECTIVE.openingKind;
  }
  return pickFairObjectiveKind(recent, rng);
};

export const pickEventGapMs = (rng: () => number): number =>
  OBJECTIVE.gapMinMs + rng() * (OBJECTIVE.gapMaxMs - OBJECTIVE.gapMinMs);
