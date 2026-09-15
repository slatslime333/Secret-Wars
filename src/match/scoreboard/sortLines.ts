import type { HeroStatLine } from '../CombatStatsTracker';

export const sortScoreboardLines = (lines: HeroStatLine[]): HeroStatLine[] =>
  [...lines].sort((a, b) => {
    if (a.team !== b.team) {
      return a.team === 'alpha' ? -1 : 1;
    }
    if (a.player !== b.player) {
      return a.player ? -1 : 1;
    }
    if (b.personalScore !== a.personalScore) {
      return b.personalScore - a.personalScore;
    }
    return a.displayName.localeCompare(b.displayName);
  });
