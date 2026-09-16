import type { TeamId } from '../../config/hero';
import type { HeroStatLine } from '../CombatStatsTracker';

/** Rounded average of living roster levels. Empty team counts as 1. */
export const teamLevelOf = (lines: readonly HeroStatLine[], team: TeamId): number => {
  const members = lines.filter((line) => line.team === team);
  if (members.length === 0) {
    return 1;
  }
  return Math.max(1, Math.round(members.reduce((sum, line) => sum + line.currentLevel, 0) / members.length));
};
