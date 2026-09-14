import type { TeamId } from '../config/hero';
import { publishScore, resetScoreWorld } from './scoreBoard';

export type TeamScore = {
  alpha: number;
  bravo: number;
};

/** Hero-kill score only. Minion kills never touch this. */
export class ScoreManager {
  readonly kills: TeamScore = { alpha: 0, bravo: 0 };

  constructor() {
    publishScore(this.kills);
  }

  addKill(team: TeamId, now = 0): void {
    this.kills[team] += 1;
    publishScore(this.kills, team, now);
  }

  /** Objective score, hero kills, or any other team point award. */
  addPoints(team: TeamId, amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.kills[team] += amount;
    publishScore(this.kills);
  }

  snapshot(): TeamScore {
    return { alpha: this.kills.alpha, bravo: this.kills.bravo };
  }

  reset(): void {
    this.kills.alpha = 0;
    this.kills.bravo = 0;
    resetScoreWorld();
    publishScore(this.kills);
  }
}
