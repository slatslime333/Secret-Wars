/**
 * 4-minute War Score economy. ~1,000 points/team is a balance target, not a
 * win threshold — highest score at 0:00 wins.
 */
export const WAR_SCORE = {
  heroKill: 80,
  heroKillTiers: [80, 60, 40, 20] as const,
  /** Each stretch without dying drops one repeat-kill tier back toward 80. */
  repeatRecoverMs: 40_000,
  swordMinion: 3,
  rangerMinion: 4,
  capture: 100,
  piggy: 100,
  bounty: 120,
  executioner: 100,
  banner: 100,
  finalMinuteMs: 60_000,
} as const;

export type ScoreReason =
  | 'hero_kill'
  | 'sword_minion'
  | 'ranger_minion'
  | 'capture_zone'
  | 'golden_pig'
  | 'bounty'
  | 'executioner'
  | 'war_banner';

export const SCORE_REASONS: readonly ScoreReason[] = [
  'hero_kill',
  'sword_minion',
  'ranger_minion',
  'capture_zone',
  'golden_pig',
  'bounty',
  'executioner',
  'war_banner',
] as const;

export const OBJECTIVE_SCORE: Partial<Record<string, number>> = {
  capture_zone: WAR_SCORE.capture,
  golden_piggy: WAR_SCORE.piggy,
  bounty_target: WAR_SCORE.bounty,
  executioner: WAR_SCORE.executioner,
  war_banner: WAR_SCORE.banner,
};

export const OBJECTIVE_REASON: Partial<Record<string, ScoreReason>> = {
  capture_zone: 'capture_zone',
  golden_piggy: 'golden_pig',
  bounty_target: 'bounty',
  executioner: 'executioner',
  war_banner: 'war_banner',
};

export const objectiveScoreLine = (kind: string): string | undefined => {
  const amount = OBJECTIVE_SCORE[kind];
  return amount ? `+${amount} SCORE` : undefined;
};

/** 1st recent death → 80, 2nd → 60, 3rd → 40, 4th+ → 20. */
export const heroKillPoints = (deathIndex: number): number => {
  const i = Math.min(Math.max(1, deathIndex), WAR_SCORE.heroKillTiers.length) - 1;
  return WAR_SCORE.heroKillTiers[i] ?? WAR_SCORE.heroKill;
};

/** Survive `repeatRecoverMs` to shed one farming-streak death. */
export const recoveredDeathStreak = (deaths: number, lastDeathAt: number, now: number): number => {
  if (deaths <= 0) {
    return 0;
  }
  const drops = Math.floor(Math.max(0, now - lastDeathAt) / WAR_SCORE.repeatRecoverMs);
  return Math.max(0, deaths - drops);
};

export const formatWarScore = (value: number): string => {
  const n = Math.round(value);
  return Math.abs(n) >= 1000 ? n.toLocaleString('en-US') : String(n);
};
