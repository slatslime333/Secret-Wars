import type { LaneId } from '../config/arena';
import { LANES } from '../config/arena';
import type { TeamId } from '../config/hero';
import { HERO_IDS, type HeroId } from '../heroes/roster';

/** One hero per lane, top → mid → bottom. */
export type TeamRoster = [HeroId, HeroId, HeroId];

export type MatchRoster = {
  alpha: TeamRoster;
  bravo: TeamRoster;
};

export const DEFAULT_SIMULATOR_ROSTER: MatchRoster = {
  alpha: ['ninja', 'cole', 'death'],
  bravo: ['ninja', 'cole', 'death'],
};

export const cloneRoster = (roster: MatchRoster): MatchRoster => ({
  alpha: [roster.alpha[0], roster.alpha[1], roster.alpha[2]],
  bravo: [roster.bravo[0], roster.bravo[1], roster.bravo[2]],
});

export const heroForLane = (roster: TeamRoster, lane: LaneId): HeroId => roster[LANES.indexOf(lane)];

export const setRosterLane = (roster: MatchRoster, team: TeamId, lane: LaneId, heroId: HeroId): MatchRoster => {
  const next = cloneRoster(roster);
  next[team][LANES.indexOf(lane)] = heroId;
  return next;
};

export const cycleRosterLane = (roster: MatchRoster, team: TeamId, lane: LaneId): MatchRoster => {
  const current = heroForLane(roster[team], lane);
  const index = HERO_IDS.indexOf(current);
  return setRosterLane(roster, team, lane, HERO_IDS[(index + 1) % HERO_IDS.length]);
};
