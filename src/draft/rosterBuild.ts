import { LANES, type LaneId, type MatchFormat } from '../config/arena';
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

/** Player hero + allies vs unique-class enemies. 6v6 uses 5 allies and 6 enemies. */
export type PlayDraft = {
  playerId: HeroId;
  allies: HeroId[];
  enemies: HeroId[];
  format?: MatchFormat;
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
  const need = heroes.length === 6 ? 2 : 1;
  if (heroes.length !== need * 3) {
    return false;
  }
  const seen: Record<DraftClass, number> = { frontliner: 0, support: 0, tank: 0 };
  for (const id of heroes) {
    seen[draftClassOf(id)] += 1;
  }
  return DRAFT_CLASSES.every((cls) => seen[cls] === need);
};

export const draftIsValid = (draft: PlayDraft): boolean => {
  const playerTeam = [draft.playerId, ...draft.allies];
  const format = draft.format ?? '3v3';
  const size = format === '6v6' ? 6 : 3;
  if (playerTeam.length !== size || draft.enemies.length !== size) {
    return false;
  }
  if (format === '3v3' && new Set([...playerTeam, ...draft.enemies]).size !== 6) {
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

export const draftFromEnemyPicks = (playerId: HeroId, picks: Record<DraftClass, HeroId>, format: MatchFormat = '3v3'): PlayDraft => {
  if (format === '6v6') {
    return randomizeDraft(playerId, Math.random, '6v6');
  }
  const enemies = DRAFT_CLASSES.map((cls) => (cls === draftClassOf(playerId) ? enemyOfPlayerClass(playerId) : picks[cls]));
  const used = new Set<HeroId>([playerId, ...enemies]);
  const playerClass = draftClassOf(playerId);
  const allies = DRAFT_CLASSES.filter((cls) => cls !== playerClass).map((cls) => {
    const leftover = HEROES_BY_CLASS[cls].find((id) => !used.has(id));
    return leftover ?? HEROES_BY_CLASS[cls][0];
  });
  return { playerId, allies, enemies, format };
};

const pickClassPair = (cls: DraftClass, prefer: HeroId | undefined, rng: () => number, avoid: Set<HeroId>): HeroId[] => {
  const pool = [...HEROES_BY_CLASS[cls]];
  const first = prefer && pool.includes(prefer) ? prefer : pool[Math.floor(rng() * pool.length)] ?? pool[0];
  const rest = pool.filter((id) => id !== first);
  const second = rest.find((id) => !avoid.has(id)) ?? rest[Math.floor(rng() * rest.length)] ?? first;
  return [first ?? pool[0] ?? 'ninja', second ?? first ?? pool[0] ?? 'ninja'];
};

export const randomizeDraft = (playerId: HeroId, rng: () => number = Math.random, format: MatchFormat = '3v3'): PlayDraft => {
  if (format !== '6v6') {
    return draftFromEnemyPicks(playerId, defaultEnemyPicks(playerId, rng), '3v3');
  }
  const playerClass = draftClassOf(playerId);
  const allies: HeroId[] = [];
  const enemies: HeroId[] = [];
  for (const cls of DRAFT_CLASSES) {
    const pair = pickClassPair(cls, cls === playerClass ? playerId : undefined, rng, new Set([playerId]));
    if (cls === playerClass) {
      allies.push(pair.find((id) => id !== playerId) ?? pair[1] ?? pair[0]);
    } else {
      allies.push(...pair);
    }
    enemies.push(...pickClassPair(cls, undefined, rng, new Set()));
  }
  return { playerId, allies: allies.slice(0, 5), enemies: enemies.slice(0, 6), format: '6v6' };
};

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
): { roster: MatchRoster; playerTeam: TeamId; playerLane: LaneId; playerSlot: number } => {
  const format = draft.format ?? '3v3';
  const slots = format === '6v6' ? [0, 1] : [0];
  const pads: { lane: LaneId; slot: number }[] = [];
  for (const slot of slots) {
    for (const lane of LANES) {
      pads.push({ lane, slot });
    }
  }
  const write = (team: TeamId, lane: LaneId, slot: number, hero: HeroId, dest: MatchRoster): void => {
    const index = slot === 0 ? LANES.indexOf(lane) : 3 + LANES.indexOf(lane);
    dest[team][index] = hero;
  };
  const empty: TeamRoster = format === '6v6' ? ['ninja', 'cole', 'death', 'rope', 'shadow', 'witch'] : ['ninja', 'cole', 'death'];
  const roster: MatchRoster = { alpha: [...empty], bravo: [...empty] };
  const foe: TeamId = spawn.team === 'alpha' ? 'bravo' : 'alpha';
  write(spawn.team, spawn.lane, 0, draft.playerId, roster);
  const allyPads = shuffleOf(
    pads.filter((pad) => !(pad.lane === spawn.lane && pad.slot === 0)),
    rng,
  );
  const allyHeroes = shuffleOf(draft.allies, rng);
  allyPads.forEach((pad, index) => {
    const hero = allyHeroes[index];
    if (hero) {
      write(spawn.team, pad.lane, pad.slot, hero, roster);
    }
  });
  const enemyPads = shuffleOf(pads, rng);
  const enemyHeroes = shuffleOf(draft.enemies, rng);
  enemyPads.forEach((pad, index) => {
    const hero = enemyHeroes[index];
    if (hero) {
      write(foe, pad.lane, pad.slot, hero, roster);
    }
  });
  return { roster, playerTeam: spawn.team, playerLane: spawn.lane, playerSlot: 0 };
};
