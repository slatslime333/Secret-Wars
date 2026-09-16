import { ARENA, LANES, applyMatchFormat } from '../config/arena';
import { DRAFT_HERO_IDS, HERO_DRAFT_CLASS, otherHeroOfClass } from './classes';
import {
  cycleEnemyPick,
  defaultEnemyPicks,
  draftFromEnemyPicks,
  draftIsValid,
  pickPlayerSpawn,
  placeDraft,
  randomizeDraft,
  teamHasUniqueClasses,
  type PlayerSpawn,
} from './rosterBuild';
import { randomizeSimulatorRoster, rosterHasClassBalance } from '../match/rosterSetup';

export type CheckResult = { name: string; ok: boolean; detail: string };

const rngOf = (values: number[]): (() => number) => {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
};

const scenarioClassMap = (): CheckResult => {
  const ok =
    HERO_DRAFT_CLASS.cole === 'frontliner' &&
    HERO_DRAFT_CLASS.shadow === 'frontliner' &&
    HERO_DRAFT_CLASS.demon === 'frontliner' &&
    HERO_DRAFT_CLASS.ninja === 'support' &&
    HERO_DRAFT_CLASS.rope === 'support' &&
    HERO_DRAFT_CLASS.mender === 'support' &&
    HERO_DRAFT_CLASS.witch === 'tank' &&
    HERO_DRAFT_CLASS.death === 'tank' &&
    otherHeroOfClass('cole') === 'shadow' &&
    otherHeroOfClass('ninja') === 'rope' &&
    otherHeroOfClass('witch') === 'death';
  return { name: 'draft class map', ok, detail: `cole=${HERO_DRAFT_CLASS.cole} ninja=${HERO_DRAFT_CLASS.ninja} witch=${HERO_DRAFT_CLASS.witch}` };
};

const scenarioRandomUnique = (): CheckResult => {
  let ok = true;
  let detail = '';
  for (const hero of DRAFT_HERO_IDS) {
    const draft = randomizeDraft(hero, rngOf([0.1, 0.8, 0.3, 0.6, 0.9, 0.2]));
    if (!draftIsValid(draft) || draft.playerId !== hero) {
      ok = false;
      detail = `${hero} invalid`;
      break;
    }
    if (draft.enemies.includes(hero) || draft.allies.includes(hero)) {
      ok = false;
      detail = `${hero} duplicated`;
      break;
    }
  }
  return { name: 'random draft unique classes', ok, detail: detail || 'all heroes' };
};

const scenarioPickCycles = (): CheckResult => {
  const picks = defaultEnemyPicks('cole', rngOf([0]));
  const support = cycleEnemyPick('cole', picks, 'support');
  const locked = cycleEnemyPick('cole', support, 'frontliner');
  const draft = draftFromEnemyPicks('cole', support);
  const ok =
    picks.frontliner === 'shadow' &&
    locked.frontliner === 'shadow' &&
    support.support !== picks.support &&
    draftIsValid(draft) &&
    teamHasUniqueClasses(draft.enemies);
  return { name: 'pick enemy team cycles', ok, detail: `enemySupport=${support.support} lockedFront=${locked.frontliner}` };
};

const scenarioSpawnNeverSame = (): CheckResult => {
  const avoid: PlayerSpawn = { team: 'alpha', lane: 'mid' };
  const seen = new Set<string>();
  let same = false;
  for (let i = 0; i < 12; i += 1) {
    const spawn = pickPlayerSpawn(rngOf([i / 12, 0.2, 0.7]), avoid);
    seen.add(`${spawn.team}-${spawn.lane}`);
    if (spawn.team === avoid.team && spawn.lane === avoid.lane) {
      same = true;
    }
  }
  const ok = !same && seen.size >= 3;
  return { name: 'player spawn never repeats last', ok, detail: `same=${same} variety=${seen.size}` };
};

const scenarioPlaceUsesSpawn = (): CheckResult => {
  const draft = randomizeDraft('rope', rngOf([0.4, 0.1, 0.9]));
  const placed = placeDraft(draft, { team: 'bravo', lane: 'top' }, rngOf([0.2, 0.8, 0.5]));
  const playerHero = placed.roster.bravo[0];
  const alphaOk = teamHasUniqueClasses(placed.roster.alpha);
  const bravoOk = teamHasUniqueClasses(placed.roster.bravo);
  const ok = placed.playerTeam === 'bravo' && placed.playerLane === 'top' && playerHero === 'rope' && alphaOk && bravoOk;
  return { name: 'placed roster follows spawn side', ok, detail: `player=${playerHero} alpha=${placed.roster.alpha.join(',')} bravo=${placed.roster.bravo.join(',')}` };
};

const scenarioMenderUniqueTeam = (): CheckResult => {
  const draft = randomizeDraft('mender', rngOf([0.2, 0.5, 0.8, 0.1, 0.9]));
  const cole = randomizeDraft('cole', rngOf([0.15, 0.45, 0.75, 0.25, 0.6]));
  const ok = draftIsValid(draft) && draftIsValid(cole) && draft.playerId === 'mender';
  return {
    name: 'mender three-support draft',
    ok,
    detail: `menderAllies=${draft.allies.join(',')} coleAllies=${cole.allies.join(',')}`,
  };
};

const scenarioDemonDraft = (): CheckResult => {
  const draft = randomizeDraft('demon', rngOf([0.2, 0.5, 0.8, 0.1, 0.9]));
  const ok = draftIsValid(draft) && draft.playerId === 'demon' && !draft.enemies.includes('demon') && !draft.allies.includes('demon');
  return { name: 'demon frontliner draft unique', ok, detail: `allies=${draft.allies.join(',')} enemies=${draft.enemies.join(',')}` };
};

const scenarioSixVSixDraft = (): CheckResult => {
  const stream = rngOf([0.12, 0.44, 0.81, 0.07, 0.63, 0.29, 0.91, 0.18, 0.55, 0.73, 0.36, 0.04, 0.88, 0.22, 0.67]);
  const draft = randomizeDraft('mender', stream, '6v6');
  const placed = placeDraft(draft, { team: 'bravo', lane: 'bottom' }, stream);
  const ok =
    draftIsValid(draft) &&
    draft.format === '6v6' &&
    draft.allies.length === 5 &&
    draft.enemies.length === 6 &&
    placed.roster.alpha.length === 6 &&
    placed.roster.bravo.length === 6 &&
    rosterHasClassBalance(placed.roster.alpha) &&
    rosterHasClassBalance(placed.roster.bravo) &&
    placed.playerTeam === 'bravo' &&
    placed.roster.bravo[LANES.indexOf('bottom')] === 'mender';
  applyMatchFormat('6v6');
  const wide = ARENA.width === Math.round(2584 * 1.65) && ARENA.height === Math.round(1504 * 1.65);
  applyMatchFormat('3v3');
  return {
    name: '6v6 two of each class and bigger map',
    ok: ok && wide,
    detail: `allies=${draft.allies.length} enemies=${draft.enemies.length} map=${wide} alpha=${placed.roster.alpha.join(',')}`,
  };
};

const scenarioSimulatorRandomize = (): CheckResult => {
  const roster = randomizeSimulatorRoster(rngOf([0.2, 0.8, 0.15, 0.6, 0.9, 0.35, 0.05, 0.7]));
  const other = randomizeSimulatorRoster(rngOf([0.9, 0.1, 0.4, 0.75, 0.2, 0.55, 0.85, 0.3]));
  const ok =
    rosterHasClassBalance(roster.alpha) &&
    rosterHasClassBalance(roster.bravo) &&
    rosterHasClassBalance(other.alpha) &&
    `${roster.alpha.join(',')}` !== `${other.alpha.join(',')}`;
  return {
    name: 'simulator randomize class lanes',
    ok,
    detail: `alpha=${roster.alpha.join(',')} other=${other.alpha.join(',')}`,
  };
};

export const runDraftChecks = (): CheckResult[] => [
  scenarioClassMap(),
  scenarioRandomUnique(),
  scenarioPickCycles(),
  scenarioSpawnNeverSame(),
  scenarioPlaceUsesSpawn(),
  scenarioMenderUniqueTeam(),
  scenarioDemonDraft(),
  scenarioSixVSixDraft(),
  scenarioSimulatorRandomize(),
];
