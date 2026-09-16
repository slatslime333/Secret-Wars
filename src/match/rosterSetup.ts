import type { LaneId, MatchFormat } from '../config/arena';
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

export const DEFAULT_SIMULATOR_ROSTER_6V6: MatchRoster = {
  alpha: ['ninja', 'cole', 'death', 'rope', 'shadow', 'witch'],
  bravo: ['ninja', 'cole', 'death', 'rope', 'shadow', 'witch'],
};

export const defaultSimulatorRoster = (format: MatchFormat = '3v3'): MatchRoster =>
  cloneRoster(format === '6v6' ? DEFAULT_SIMULATOR_ROSTER_6V6 : DEFAULT_SIMULATOR_ROSTER);

export const cloneRoster = (roster: MatchRoster): MatchRoster => ({
  alpha: [...roster.alpha],
  bravo: [...roster.bravo],
});

export const rosterFitsFormat = (roster: MatchRoster, format: MatchFormat): boolean => {
  const size = format === '6v6' ? 6 : 3;
  return roster.alpha.length === size && roster.bravo.length === size;
};

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

export const swapSimulatorTeams = (roster: MatchRoster): MatchRoster => ({
  alpha: [...roster.bravo],
  bravo: [...roster.alpha],
});

export const simulatorSlotLabel = (index: number): string => {
  const lane = LANES[index % LANES.length] ?? 'mid';
  return index >= 3 ? `${lane.toUpperCase()} 2` : lane.toUpperCase();
};

/** Replace a slot. Same-team duplicates swap; other class picks swap with that class seat. */
export const applySimulatorPick = (
  roster: MatchRoster,
  team: TeamId,
  index: number,
  nextId: HeroId,
): MatchRoster => {
  const next = cloneRoster(roster);
  const current = next[team][index];
  if (!current || current === nextId) {
    return roster;
  }
  const same = next[team].findIndex((id, i) => i !== index && id === nextId);
  if (same >= 0) {
    next[team][same] = current;
    next[team][index] = nextId;
    return next;
  }
  if (draftClassOf(current) === draftClassOf(nextId)) {
    next[team][index] = nextId;
    return next;
  }
  const mate = next[team].findIndex((id, i) => i !== index && draftClassOf(id) === draftClassOf(nextId));
  if (mate >= 0) {
    next[team][index] = nextId;
    next[team][mate] = current;
    return next;
  }
  next[team][index] = nextId;
  return next;
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

/** One of each class (3v3) or two of each class (6v6), shuffled onto the pads. */
export const randomizeSimulatorRoster = (
  rng: () => number = Math.random,
  format: MatchFormat = '3v3',
): MatchRoster => {
  const need = format === '6v6' ? 2 : 1;
  const teamOf = (): TeamRoster => {
    const used = new Set<HeroId>();
    const picks: HeroId[] = [];
    for (const cls of DRAFT_CLASSES) {
      for (let n = 0; n < need; n += 1) {
        const hero = pickFrom(HEROES_BY_CLASS[cls], rng, used);
        used.add(hero);
        picks.push(hero);
      }
    }
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
