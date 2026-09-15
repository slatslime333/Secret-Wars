import type { TeamId } from '../config/hero';
import {
  OBJECTIVE_REASON,
  OBJECTIVE_SCORE,
  SCORE_REASONS,
  WAR_SCORE,
  recoveredDeathStreak,
  heroKillPoints,
  type ScoreReason,
} from '../config/score';
import { publishScore, resetScoreWorld } from './scoreBoard';

export type TeamScore = {
  alpha: number;
  bravo: number;
};

export type ScoreGrant = {
  team: TeamId;
  amount: number;
  reason: ScoreReason;
  source?: string;
  now: number;
};

export type WarScoreTelemetry = {
  durationMs: number;
  alpha: number;
  bravo: number;
  byReason: Record<ScoreReason, TeamScore>;
  heroKills: TeamScore;
  minionKills: TeamScore;
  objectives: TeamScore;
  repeatKillReduction: number;
  scorePerMinute: { alpha: number; bravo: number };
};

const emptyTeam = (): TeamScore => ({ alpha: 0, bravo: 0 });

const emptyByReason = (): Record<ScoreReason, TeamScore> => {
  const out = {} as Record<ScoreReason, TeamScore>;
  for (const reason of SCORE_REASONS) {
    out[reason] = emptyTeam();
  }
  return out;
};

/**
 * Single War Score ledger. Hero kills, minions, and objectives all enter here.
 * Locking at 0:00 makes later grants no-ops.
 */
export class ScoreManager {
  readonly kills: TeamScore = emptyTeam();
  readonly heroKills: TeamScore = emptyTeam();
  readonly minionKills: TeamScore = emptyTeam();
  readonly objectives: TeamScore = emptyTeam();
  private readonly byReason: Record<ScoreReason, TeamScore> = emptyByReason();
  private readonly victimStreak = new Map<string, { deaths: number; lastDeathAt: number }>();
  private readonly granted = new Set<string>();
  private repeatKillReduction = 0;
  private locked = false;
  private canScore: () => boolean = () => !this.locked;

  constructor(canScore?: () => boolean) {
    if (canScore) {
      this.canScore = canScore;
    }
    publishScore(this.kills);
  }

  get open(): boolean {
    return !this.locked && this.canScore();
  }

  lock(): void {
    this.locked = true;
  }

  /**
   * Only scoring entry. Reasons keep HUD, AI, and telemetry on one number.
   * Returns the awarded amount (0 if locked/invalid).
   */
  addTeamScore(team: TeamId, amount: number, reason: ScoreReason, now = 0, source?: string): number {
    const value = Math.round(amount);
    if (value <= 0 || this.locked || !this.canScore()) {
      return 0;
    }
    if (source) {
      if (this.granted.has(source)) {
        return 0;
      }
      this.granted.add(source);
    }
    this.kills[team] += value;
    this.byReason[reason][team] += value;
    if (reason === 'hero_kill') {
      this.heroKills[team] += 1;
    } else if (reason === 'sword_minion' || reason === 'ranger_minion') {
      this.minionKills[team] += 1;
    } else {
      this.objectives[team] += 1;
    }
    publishScore(this.kills, reason === 'hero_kill' ? team : undefined, now);
    return value;
  }

  /** Hero kill with per-victim diminishing score. The kill still counts. */
  awardHeroKill(team: TeamId, victimId: string, now: number): number {
    if (this.locked || !this.canScore()) {
      return 0;
    }
    const prev = this.victimStreak.get(victimId) ?? { deaths: 0, lastDeathAt: 0 };
    const streak = recoveredDeathStreak(prev.deaths, prev.lastDeathAt, now);
    const deathIndex = streak + 1;
    const amount = heroKillPoints(deathIndex);
    this.repeatKillReduction += Math.max(0, WAR_SCORE.heroKill - amount);
    this.victimStreak.set(victimId, { deaths: deathIndex, lastDeathAt: now });
    return this.addTeamScore(team, amount, 'hero_kill', now);
  }

  awardMinion(team: TeamId, kind: 'sword' | 'ranger', now = 0): number {
    const amount = kind === 'ranger' ? WAR_SCORE.rangerMinion : WAR_SCORE.swordMinion;
    const reason: ScoreReason = kind === 'ranger' ? 'ranger_minion' : 'sword_minion';
    return this.addTeamScore(team, amount, reason, now);
  }

  awardObjective(team: TeamId, kind: string, now = 0, source?: string): number {
    const amount = OBJECTIVE_SCORE[kind];
    const reason = OBJECTIVE_REASON[kind];
    if (!amount || !reason) {
      return 0;
    }
    return this.addTeamScore(team, amount, reason, now, source ?? `${kind}:${now}`);
  }

  snapshot(): TeamScore {
    return { alpha: this.kills.alpha, bravo: this.kills.bravo };
  }

  telemetry(durationMs: number): WarScoreTelemetry {
    const minutes = Math.max(1 / 60, durationMs / 60_000);
    return {
      durationMs,
      alpha: this.kills.alpha,
      bravo: this.kills.bravo,
      byReason: SCORE_REASONS.reduce(
        (out, reason) => {
          out[reason] = { ...this.byReason[reason] };
          return out;
        },
        {} as Record<ScoreReason, TeamScore>,
      ),
      heroKills: { ...this.heroKills },
      minionKills: { ...this.minionKills },
      objectives: { ...this.objectives },
      repeatKillReduction: this.repeatKillReduction,
      scorePerMinute: {
        alpha: this.kills.alpha / minutes,
        bravo: this.kills.bravo / minutes,
      },
    };
  }

  reset(): void {
    this.kills.alpha = 0;
    this.kills.bravo = 0;
    this.heroKills.alpha = 0;
    this.heroKills.bravo = 0;
    this.minionKills.alpha = 0;
    this.minionKills.bravo = 0;
    this.objectives.alpha = 0;
    this.objectives.bravo = 0;
    for (const reason of SCORE_REASONS) {
      this.byReason[reason] = emptyTeam();
    }
    this.victimStreak.clear();
    this.granted.clear();
    this.repeatKillReduction = 0;
    this.locked = false;
    resetScoreWorld();
    publishScore(this.kills);
  }
}
