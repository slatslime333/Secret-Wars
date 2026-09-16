import type { LaneId } from '../config/arena';
import { LANES } from '../config/arena';
import type { TeamId } from '../config/hero';
import { HERO_IDS, type HeroId } from '../heroes/roster';
import { DRAFT_CLASSES, HEROES_BY_CLASS, draftClassOf } from '../draft/classes';

/** One hero per lane, top → mid → bottom. 6v6 appends a second hero per lane. */
export type TeamRoster = HeroId[];

export type MatchRoster = {
  alpha: TeamRoster;
  bravo: TeamRoster;
};

export const DEFAULT_SIMULATOR_ROSTER: MatchRoster = {
  alpha: ['ninja', 'cole', 'death'],
  bravo: ['ninja', 'cole', 'death'],
};

export const cloneRoster = (roster: MatchRoster): MatchRoster => ({
  alpha: [...roster.alpha],
  bravo: [...roster.bravo],
});

export const heroForLane = (roster: TeamRoster, lane: LaneId, slot = 0): HeroId => {
  const base = LANES.indexOf(lane);
  return roster[slot === 0 ? base : 3 + base] ?? roster[base] ?? 'ninja';
};

export const setRosterLane = (roster: MatchRoster, team: TeamId, lane: LaneId, heroId: HeroId, slot = 0): MatchRoster => {
  const next = cloneRoster(roster);
  const index = slot === 0 ? LANES.indexOf(lane) : 3 + LANES.indexOf(lane);
  next[team][index] = heroId;
  return next;
};

export const cycleRosterLane = (roster: MatchRoster, team: TeamId, lane: LaneId): MatchRoster => {
  const current = heroForLane(roster[team], lane);
  const index = HERO_IDS.indexOf(current);
  return setRosterLane(roster, team, lane, HERO_IDS[(index + 1) % HERO_IDS.length]);
};

const pickFrom = (pool: readonly HeroId[], rng: () => number, used: Set<HeroId>): HeroId => {
  const open = pool.filter((id) => !used.has(id));
  const source = open.length > 0 ? open : pool;
  return source[Math.floor(rng() * source.length)] ?? pool[0] ?? 'ninja';
};

const shuffle = <T>(items: readonly T[], rng: () => number): T[] => {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = deck[i];
    const b = deck[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    deck[i] = b;
    deck[j] = a;
  }
  return deck;
};

/** One support, one frontliner, one tank, shuffled onto the three lanes. */
export const randomizeSimulatorRoster = (rng: () => number = Math.random): MatchRoster => {
  const teamOf = (): TeamRoster => {
    const used = new Set<HeroId>();
    const picks = DRAFT_CLASSES.map((cls) => {
      const hero = pickFrom(HEROES_BY_CLASS[cls], rng, used);
      used.add(hero);
      return hero;
    });
    return shuffle(picks, rng);
  };
  return { alpha: teamOf(), bravo: teamOf() };
};

export const rosterHasClassBalance = (roster: TeamRoster): boolean => {
  if (roster.length !== 3 && roster.length !== 6) {
    return false;
  }
  const need = roster.length === 6 ? 2 : 1;
  return DRAFT_CLASSES.every((cls) => roster.filter((id) => draftClassOf(id) === cls).length === need);
};
