import type { TeamId } from '../config/hero';

export type TeamScore = {
  alpha: number;
  bravo: number;
};

/** Hero-kill score only. Minion kills never touch this. */
export class ScoreManager {
  readonly kills: TeamScore = { alpha: 0, bravo: 0 };

  addKill(team: TeamId): void {
    this.addPoints(team, 1);
  }

  /** Objective score, hero kills, or any other team point award. */
  addPoints(team: TeamId, amount: number): void {
    if (amount <= 0) {
      return;
    }
    this.kills[team] += amount;
  }

  snapshot(): TeamScore {
    return { alpha: this.kills.alpha, bravo: this.kills.bravo };
  }

  reset(): void {
    this.kills.alpha = 0;
    this.kills.bravo = 0;
  }
}
