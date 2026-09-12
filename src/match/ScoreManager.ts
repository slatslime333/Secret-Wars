import type { TeamId } from '../config/hero';

export type TeamScore = {
  alpha: number;
  bravo: number;
};

/** Hero-kill score only. Minion kills never touch this. */
export class ScoreManager {
  readonly kills: TeamScore = { alpha: 0, bravo: 0 };

  addKill(team: TeamId): void {
    this.kills[team] += 1;
  }

  snapshot(): TeamScore {
    return { alpha: this.kills.alpha, bravo: this.kills.bravo };
  }

  reset(): void {
    this.kills.alpha = 0;
    this.kills.bravo = 0;
  }
}
