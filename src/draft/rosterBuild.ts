import { LANES, type LaneId } from '../config/arena';
import type { TeamId } from '../config/hero';
import type { HeroId } from '../heroes/roster';
import type { MatchRoster, TeamRoster } from '../match/rosterSetup';
import {
  DRAFT_CLASSES,
  HEROES_BY_CLASS,
  draftClassOf,
  otherHeroOfClass,
  type DraftClass,
} from './classes';

const LAST_SPAWN_KEY = 'secretWars.lastPlayerSpawn';

export type PlayerSpawn = {
  team: TeamId;
  lane: LaneId;
};

/** Player hero + two allies vs three unique-class enemies. */
export type PlayDraft = {
  playerId: HeroId;
  allies: [HeroId, HeroId];
  enemies: TeamRoster;
};

export const shuffleOf = <T>(items: readonly T[], rng: () => number): T[] => {
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

export const teamHasUniqueClasses = (heroes: readonly HeroId[]): boolean => {
  if (heroes.length !== 3) {
    return false;
  }
  const seen = new Set<DraftClass>();
  for (const id of heroes) {
    const cls = draftClassOf(id);
    if (seen.has(cls)) {
      return false;
    }
    seen.add(cls);
  }
  return seen.size === 3;
};

export const draftIsValid = (draft: PlayDraft): boolean => {
  const playerTeam = [draft.playerId, ...draft.allies];
  const all = [...playerTeam, ...draft.enemies];
  if (new Set(all).size !== 6) {
    return false;
  }
  return teamHasUniqueClasses(playerTeam) && teamHasUniqueClasses(draft.enemies);
};

export const enemyOfPlayerClass = (playerId: HeroId): HeroId => otherHeroOfClass(playerId);

export const defaultEnemyPicks = (playerId: HeroId, rng: () => number): Record<DraftClass, HeroId> => {
  const picks = {} as Record<DraftClass, HeroId>;
  for (const cls of DRAFT_CLASSES) {
    if (cls === draftClassOf(playerId)) {
      picks[cls] = enemyOfPlayerClass(playerId);
      continue;
    }
    const pool = HEROES_BY_CLASS[cls];
    picks[cls] = pool[Math.floor(rng() * pool.length)] ?? pool[0];
  }
  return picks;
};

export const cycleEnemyPick = (playerId: HeroId, picks: Record<DraftClass, HeroId>, cls: DraftClass): Record<DraftClass, HeroId> => {
  const next = { ...picks };
  if (cls === draftClassOf(playerId)) {
    next[cls] = enemyOfPlayerClass(playerId);
    return next;
  }
  const pool = HEROES_BY_CLASS[cls].filter((id) => id !== playerId);
  const idx = pool.indexOf(picks[cls]);
  next[cls] = pool[(idx + 1) % pool.length] ?? pool[0];
  return next;
};

export const draftFromEnemyPicks = (playerId: HeroId, picks: Record<DraftClass, HeroId>): PlayDraft => {
  const enemies = DRAFT_CLASSES.map((cls) => (cls === draftClassOf(playerId) ? enemyOfPlayerClass(playerId) : picks[cls])) as TeamRoster;
  const used = new Set<HeroId>([playerId, ...enemies]);
  const playerClass = draftClassOf(playerId);
  const allies = DRAFT_CLASSES.filter((cls) => cls !== playerClass).map((cls) => {
    const leftover = HEROES_BY_CLASS[cls].find((id) => !used.has(id));
    return leftover ?? HEROES_BY_CLASS[cls][0];
  }) as [HeroId, HeroId];
  return { playerId, allies, enemies };
};

export const randomizeDraft = (playerId: HeroId, rng: () => number = Math.random): PlayDraft =>
  draftFromEnemyPicks(playerId, defaultEnemyPicks(playerId, rng));

const allSpawns = (): PlayerSpawn[] => {
  const out: PlayerSpawn[] = [];
  for (const team of ['alpha', 'bravo'] as const) {
    for (const lane of LANES) {
      out.push({ team, lane });
    }
  }
  return out;
};

export const readLastPlayerSpawn = (): PlayerSpawn | undefined => {
  try {
    const raw = localStorage.getItem(LAST_SPAWN_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as PlayerSpawn;
    if ((parsed.team === 'alpha' || parsed.team === 'bravo') && LANES.includes(parsed.lane)) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const rememberPlayerSpawn = (spawn: PlayerSpawn): void => {
  try {
    localStorage.setItem(LAST_SPAWN_KEY, JSON.stringify(spawn));
  } catch {
    /* ignore quota / private mode */
  }
};

/** Random side + lane, never the same team+lane as the last Play match. */
export const pickPlayerSpawn = (rng: () => number = Math.random, avoid?: PlayerSpawn): PlayerSpawn => {
  const last = avoid ?? readLastPlayerSpawn();
  const pool = allSpawns().filter((spawn) => !last || spawn.team !== last.team || spawn.lane !== last.lane);
  const picked = pool[Math.floor(rng() * pool.length)] ?? allSpawns()[0];
  return picked ?? { team: 'alpha', lane: 'mid' };
};

export const placeDraft = (
  draft: PlayDraft,
  spawn: PlayerSpawn,
  rng: () => number = Math.random,
): { roster: MatchRoster; playerTeam: TeamId; playerLane: LaneId } => {
  const allyLanes = shuffleOf(
    LANES.filter((lane) => lane !== spawn.lane),
    rng,
  );
  const allyHeroes = shuffleOf(draft.allies, rng);
  const enemyHeroes = shuffleOf(draft.enemies, rng);
  const enemyLanes = shuffleOf([...LANES], rng);
  const empty: TeamRoster = ['ninja', 'cole', 'death'];
  const roster: MatchRoster = { alpha: [...empty], bravo: [...empty] };
  const foe: TeamId = spawn.team === 'alpha' ? 'bravo' : 'alpha';
  roster[spawn.team][LANES.indexOf(spawn.lane)] = draft.playerId;
  allyLanes.forEach((lane, index) => {
    const hero = allyHeroes[index];
    if (hero) {
      roster[spawn.team][LANES.indexOf(lane)] = hero;
    }
  });
  enemyLanes.forEach((lane, index) => {
    const hero = enemyHeroes[index];
    if (hero) {
      roster[foe][LANES.indexOf(lane)] = hero;
    }
  });
  return { roster, playerTeam: spawn.team, playerLane: spawn.lane };
};
