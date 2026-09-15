import { MATCH } from '../../config/match';
import {
  OBJECTIVE_SCORE,
  WAR_SCORE,
  formatWarScore,
  heroKillPoints,
  recoveredDeathStreak,
} from '../../config/score';
import { ScoreManager } from '../ScoreManager';
import { MatchManager } from '../MatchManager';
import { resolveWarWinner, teamAvgHp } from '../resolveWinner';

export type ScoreCheck = { name: string; ok: boolean; detail: string };

const check = (name: string, ok: boolean, detail: string): ScoreCheck => ({ name, ok, detail });

const scenarioKillTiers = (): ScoreCheck => {
  const score = new ScoreManager();
  const first = score.awardHeroKill('alpha', 'hero-a', 1_000);
  const second = score.awardHeroKill('alpha', 'hero-a', 2_000);
  const third = score.awardHeroKill('alpha', 'hero-a', 3_000);
  const fourth = score.awardHeroKill('alpha', 'hero-a', 4_000);
  const fifth = score.awardHeroKill('alpha', 'hero-a', 5_000);
  const ok =
    first === 80 &&
    second === 60 &&
    third === 40 &&
    fourth === 20 &&
    fifth === 20 &&
    score.kills.alpha === 220 &&
    score.heroKills.alpha === 5;
  return check(
    'hero kill tiers 80-60-40-20',
    ok,
    `awards=${[first, second, third, fourth, fifth].join(',')} total=${score.kills.alpha}`,
  );
};

const scenarioKillRecovery = (): ScoreCheck => {
  const score = new ScoreManager();
  score.awardHeroKill('alpha', 'hero-a', 0);
  score.awardHeroKill('alpha', 'hero-a', 1_000);
  const recovered = recoveredDeathStreak(2, 1_000, 1_000 + WAR_SCORE.repeatRecoverMs);
  const after = score.awardHeroKill('alpha', 'hero-a', 1_000 + WAR_SCORE.repeatRecoverMs);
  const ok = recovered === 1 && after === 60 && heroKillPoints(1) === 80;
  return check('repeat-kill recovery after surviving a stretch', ok, `streak=${recovered} next=${after}`);
};

const scenarioMinions = (): ScoreCheck => {
  const score = new ScoreManager();
  const sword = score.awardMinion('bravo', 'sword', 100);
  const ranger = score.awardMinion('bravo', 'ranger', 100);
  const ok = sword === 3 && ranger === 4 && score.kills.bravo === 7 && score.minionKills.bravo === 2;
  return check('minion scores are +3 sword and +4 ranger', ok, `sword=${sword} ranger=${ranger}`);
};

const scenarioObjectives = (): ScoreCheck => {
  const score = new ScoreManager();
  const capture = score.awardObjective('alpha', 'capture_zone', 10, 'cap-1');
  const pig = score.awardObjective('alpha', 'golden_piggy', 20, 'pig-1');
  const bounty = score.awardObjective('alpha', 'bounty_target', 30, 'bounty-1');
  const exec = score.awardObjective('bravo', 'executioner', 40, 'exec-1');
  const banner = score.awardObjective('bravo', 'war_banner', 50, 'banner-1');
  const shrine = score.awardObjective('alpha', 'healing_shrine', 60, 'shrine-1');
  const rage = score.awardObjective('alpha', 'rage_zone', 70, 'rage-1');
  const meteor = score.awardObjective('alpha', 'meteor_storm', 80, 'meteor-1');
  const ok =
    capture === 100 &&
    pig === 100 &&
    bounty === 120 &&
    exec === 100 &&
    banner === 100 &&
    shrine === 0 &&
    rage === 0 &&
    meteor === 0 &&
    score.kills.alpha === 320 &&
    score.kills.bravo === 200 &&
    score.objectives.alpha === 3 &&
    score.objectives.bravo === 2 &&
    OBJECTIVE_SCORE.healing_shrine === undefined;
  return check(
    'objective war-score amounts and no shrine/rage/meteor points',
    ok,
    `a=${score.kills.alpha} b=${score.kills.bravo} shrine=${shrine} rage=${rage} meteor=${meteor}`,
  );
};

const scenarioIdempotentObjective = (): ScoreCheck => {
  const score = new ScoreManager();
  const first = score.awardObjective('alpha', 'capture_zone', 10, 'cap-same');
  const second = score.awardObjective('alpha', 'capture_zone', 11, 'cap-same');
  const other = score.awardObjective('alpha', 'capture_zone', 12, 'cap-next');
  const ok = first === 100 && second === 0 && other === 100 && score.kills.alpha === 200;
  return check('objective grants are idempotent per source', ok, `first=${first} second=${second} other=${other}`);
};

const scenarioLock = (): ScoreCheck => {
  const score = new ScoreManager();
  score.awardHeroKill('alpha', 'hero-a', 1);
  score.lock();
  const after = score.awardHeroKill('alpha', 'hero-b', 2);
  const minion = score.awardMinion('alpha', 'sword', 3);
  const obj = score.awardObjective('alpha', 'war_banner', 4, 'banner-lock');
  const ok = after === 0 && minion === 0 && obj === 0 && score.kills.alpha === 80;
  return check('lock freezes scoring after 0:00', ok, `after=${after} minion=${minion} obj=${obj} total=${score.kills.alpha}`);
};

const scenarioClockEnd = (): ScoreCheck => {
  let decided = 0;
  const match = new MatchManager(() => {
    decided += 1;
    return 'alpha';
  });
  match.update(MATCH.durationMs);
  const ok =
    match.finished &&
    match.remainingMs === 0 &&
    match.winner === 'alpha' &&
    match.reason === 'time' &&
    match.phase === 'FINISHED' &&
    decided === 1 &&
    !match.playing;
  match.update(1_000);
  const ok2 = decided === 1 && match.winner === 'alpha';
  return check('clock expiry finishes the match without overtime', ok && ok2, `phase=${match.phase} winner=${match.winner}`);
};

const scenarioTieBreak = (): ScoreCheck[] => {
  const byScore = resolveWarWinner({
    score: { self: 500, enemy: 400 },
    heroKills: { self: 0, enemy: 9 },
    objectives: { self: 0, enemy: 4 },
    avgHp: { self: 10, enemy: 90 },
  });
  const byKills = resolveWarWinner({
    score: { self: 400, enemy: 400 },
    heroKills: { self: 4, enemy: 3 },
    objectives: { self: 0, enemy: 4 },
    avgHp: { self: 10, enemy: 90 },
  });
  const byObj = resolveWarWinner({
    score: { self: 400, enemy: 400 },
    heroKills: { self: 3, enemy: 3 },
    objectives: { self: 2, enemy: 1 },
    avgHp: { self: 10, enemy: 90 },
  });
  const byHp = resolveWarWinner({
    score: { self: 400, enemy: 400 },
    heroKills: { self: 3, enemy: 3 },
    objectives: { self: 1, enemy: 1 },
    avgHp: { self: 40, enemy: 20 },
  });
  const draw = resolveWarWinner({
    score: { self: 400, enemy: 400 },
    heroKills: { self: 3, enemy: 3 },
    objectives: { self: 1, enemy: 1 },
    avgHp: { self: 30, enemy: 30 },
  });
  const avg = teamAvgHp([
    { team: 'alpha', kind: 'hero', hp: 80 },
    { team: 'alpha', kind: 'hero', hp: 0 },
    { team: 'bravo', kind: 'hero', hp: 40 },
    { team: 'bravo', kind: 'hero', hp: 40 },
  ]);
  return [
    check('tie-break order score → kills → objectives → HP → draw', byScore === 'alpha' && byKills === 'alpha' && byObj === 'alpha' && byHp === 'alpha' && draw === 'draw', `score=${byScore} kills=${byKills} obj=${byObj} hp=${byHp} draw=${draw}`),
    check('dead heroes count as 0 HP in the average', Math.abs(avg.self - 40) < 0.01 && Math.abs(avg.enemy - 40) < 0.01, `alpha=${avg.self} bravo=${avg.enemy}`),
  ];
};

const scenarioEconomyTarget = (): ScoreCheck => {
  const score = new ScoreManager();
  for (let i = 0; i < 6; i += 1) {
    score.awardHeroKill('alpha', `v${i}`, i * 8_000);
  }
  score.awardObjective('alpha', 'capture_zone', 1, 'c');
  score.awardObjective('alpha', 'golden_piggy', 2, 'p');
  score.awardObjective('alpha', 'bounty_target', 3, 'b');
  score.awardObjective('alpha', 'executioner', 4, 'e');
  score.awardObjective('alpha', 'war_banner', 5, 'w');
  for (let i = 0; i < 40; i += 1) {
    score.awardMinion('alpha', i % 2 === 0 ? 'sword' : 'ranger');
  }
  const tel = score.telemetry(MATCH.durationMs);
  const ok = tel.alpha >= 800 && tel.alpha <= 1600 && formatWarScore(1200) === '1,200';
  return check('economy sanity sits near the 1000-point target', ok, `alpha=${tel.alpha} spm=${tel.scorePerMinute.alpha.toFixed(1)}`);
};

export const runWarScoreChecks = (): ScoreCheck[] => [
  scenarioKillTiers(),
  scenarioKillRecovery(),
  scenarioMinions(),
  scenarioObjectives(),
  scenarioIdempotentObjective(),
  scenarioLock(),
  scenarioClockEnd(),
  ...scenarioTieBreak(),
  scenarioEconomyTarget(),
];
