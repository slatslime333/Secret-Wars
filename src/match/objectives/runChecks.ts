import {
  canStartObjective,
  nextObjectiveKind,
  OBJECTIVE,
  pickEventGapMs,
  pickFairObjectiveKind,
  pickObjectiveKind,
  pickObjectiveStartAt,
} from '../../config/objective';
import { MATCH, xpToNextLevel } from '../../config/match';
import { COLE_CONVERTED_RANGE } from '../../config/cole';
import { emptyCapture, tickCapture } from './captureLogic';
import { shrineControlOf } from './shrineLogic';
import { pickBountyTargets } from './bountyPick';
import { xpShareOfCurrentLevel } from './rewards';
import type { HeroRuntime } from '../HeroRuntime';

export type CheckResult = { name: string; ok: boolean; detail: string };

const rngOf = (values: number[]): (() => number) => {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
};

const scenarioTimingWindow = (): CheckResult => {
  const tooEarly = canStartObjective(4_999, 0, false);
  const firstOk = canStartObjective(5_000, 0, false);
  const lateOk = canStartObjective(239_000, 0, false);
  const overlap = canStartObjective(60_000, 0, true);
  const cooling = !canStartObjective(90_000, 100_000, false);
  const ok = !tooEarly && firstOk && lateOk && !overlap && cooling;
  return {
    name: 'objective start window',
    ok,
    detail: `early=${tooEarly} start=${firstOk} late=${lateOk} overlap=${overlap} cool=${cooling}`,
  };
};

const scenarioRandomStart = (): CheckResult => {
  const a = pickObjectiveStartAt(OBJECTIVE.earliestStartMs, OBJECTIVE.openingLatestMs, rngOf([0]));
  const b = pickObjectiveStartAt(OBJECTIVE.earliestStartMs, OBJECTIVE.openingLatestMs, rngOf([0.999]));
  const late = pickObjectiveStartAt(200_000, MATCH.durationMs, rngOf([0.4]));
  const none = pickObjectiveStartAt(MATCH.durationMs, MATCH.durationMs, rngOf([0.2]));
  const ok =
    a === OBJECTIVE.earliestStartMs &&
    b !== undefined &&
    b < OBJECTIVE.openingLatestMs &&
    late !== undefined &&
    late >= 200_000 &&
    none === undefined;
  return {
    name: 'objective random start',
    ok,
    detail: `a=${a} b=${b?.toFixed(0)} late=${late?.toFixed(0)} none=${none}`,
  };
};

const scenarioKindReroll = (): CheckResult => {
  const first = nextObjectiveKind([], rngOf([0.1]));
  const same = pickFairObjectiveKind(['capture_zone'], rngOf([0]));
  const other = pickObjectiveKind('capture_zone', rngOf([0]));
  const ok = first === 'capture_zone' && same !== 'capture_zone' && other !== 'capture_zone';
  return { name: 'opening capture then fair anti-repeat', ok, detail: `first=${first} same=${same} other=${other}` };
};

const scenarioEventPool = (): CheckResult => {
  const expected = [
    'capture_zone',
    'golden_piggy',
    'bounty_target',
    'healing_shrine',
    'executioner',
    'war_banner',
    'rage_zone',
    'meteor_storm',
  ];
  const ok =
    OBJECTIVE.kinds.length === 8 &&
    expected.every((kind) => (OBJECTIVE.kinds as readonly string[]).includes(kind));
  return { name: 'objective event pool', ok, detail: OBJECTIVE.kinds.join(',') };
};

const scenarioPiggyReward = (): CheckResult => {
  const ok = OBJECTIVE.scoreReward === 1 && OBJECTIVE.piggy.xpShare === 0.25;
  return { name: 'piggy bank team score is +1 with 25% XP', ok, detail: `score=${OBJECTIVE.scoreReward} xp=${OBJECTIVE.piggy.xpShare}` };
};

const scenarioBuffDurations = (): CheckResult => {
  const ok =
    OBJECTIVE.bounty.levelReward === 1 &&
    OBJECTIVE.shrine.durationMs === 20_000 &&
    OBJECTIVE.shrine.healPerSecond === 7 &&
    OBJECTIVE.executioner.buffMs === 10_000 &&
    OBJECTIVE.executioner.moveMul === 1.1 &&
    OBJECTIVE.executioner.attackMul === 1.1 &&
    OBJECTIVE.executioner.staminaMul === 1.1 &&
    OBJECTIVE.executioner.xpShare === 0.5 &&
    OBJECTIVE.capture.xpShare === 0.75 &&
    OBJECTIVE.capture.moveMul === 1.1 &&
    OBJECTIVE.banner.durationMs === 20_000 &&
    OBJECTIVE.banner.claimMs === 3_000 &&
    OBJECTIVE.rage.moveMul === 1.4 &&
    OBJECTIVE.meteor.durationMs === 15_000 &&
    OBJECTIVE.executioner.attackMs >= 1_200 &&
    OBJECTIVE.executioner.moveSpeed < 120;
  return {
    name: 'event reward tunables',
    ok,
    detail: `bountyLv=${OBJECTIVE.bounty.levelReward} shrine=${OBJECTIVE.shrine.healPerSecond}/s execAtk=${OBJECTIVE.executioner.attackMs}`,
  };
};

const scenarioXpShare = (): CheckResult => {
  const need = xpToNextLevel(4);
  const share75 = xpShareOfCurrentLevel(4, 0.75);
  const share25 = xpShareOfCurrentLevel(4, 0.25);
  const share50 = xpShareOfCurrentLevel(4, 0.5);
  const ok = need === 154 && share75 === 116 && share25 === 39 && share50 === 77;
  return {
    name: 'current-level XP share rounding',
    ok,
    detail: `need=${need} 75%=${share75} 25%=${share25} 50%=${share50}`,
  };
};

const scenarioShrineContest = (): CheckResult => {
  const free = shrineControlOf(2, 0);
  const contested = shrineControlOf(1, 1);
  const empty = shrineControlOf(0, 0);
  const ok = free.owner === 'alpha' && !free.contested && contested.contested && contested.owner === null && empty.owner === null && !empty.contested;
  return { name: 'shrine control is exclusive', ok, detail: `free=${free.owner} contested=${contested.contested} empty=${empty.owner}` };
};

const stubHero = (team: 'alpha' | 'bravo', instanceId: string, alive = true): HeroRuntime =>
  ({ team, instanceId, alive, heroId: 'cole' }) as unknown as HeroRuntime;

const scenarioBountyPick = (): CheckResult => {
  const heroes = [
    stubHero('alpha', 'a1'),
    stubHero('alpha', 'a2'),
    stubHero('bravo', 'b1'),
    stubHero('bravo', 'b2'),
    stubHero('bravo', 'b3', false),
  ];
  const first = pickBountyTargets(heroes, rngOf([0, 0]));
  const second = pickBountyTargets(heroes, rngOf([0.9, 0.9]), { alpha: first.alpha?.instanceId, bravo: first.bravo?.instanceId });
  const ok =
    Boolean(first.alpha && first.bravo) &&
    first.alpha?.team === 'alpha' &&
    first.bravo?.team === 'bravo' &&
    first.alpha !== first.bravo &&
    second.alpha?.instanceId !== first.alpha?.instanceId &&
    second.bravo?.instanceId !== first.bravo?.instanceId;
  return {
    name: 'bounty picks one living hero per team',
    ok,
    detail: `first=${first.alpha?.instanceId}/${first.bravo?.instanceId} second=${second.alpha?.instanceId}/${second.bravo?.instanceId}`,
  };
};

const scenarioFairKinds = (): CheckResult => {
  const counts: Record<string, number> = {};
  for (const kind of OBJECTIVE.kinds) {
    counts[kind] = 0;
  }
  let repeats = 0;
  let prev: (typeof OBJECTIVE.kinds)[number] | undefined;
  const recent: Array<(typeof OBJECTIVE.kinds)[number]> = ['capture_zone'];
  for (let i = 0; i < 400; i += 1) {
    const kind = pickFairObjectiveKind(recent, Math.random);
    counts[kind] = (counts[kind] ?? 0) + 1;
    if (kind === prev) {
      repeats += 1;
    }
    prev = kind;
    recent.push(kind);
    if (recent.length > 4) {
      recent.shift();
    }
  }
  const values = Object.values(counts);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const ok = repeats === 0 && min > 20 && max < 90 && values.length === 8;
  return {
    name: 'fair event selector is unpredictable',
    ok,
    detail: `repeats=${repeats} min=${min} max=${max} counts=${JSON.stringify(counts)}`,
  };
};

const scenarioOpeningAndGap = (): CheckResult => {
  const opening = OBJECTIVE.openingAtMs;
  const gapLo = pickEventGapMs(() => 0);
  const gapHi = pickEventGapMs(() => 0.999);
  const noCutoff = OBJECTIVE.latestStartMs === MATCH.durationMs;
  const ok =
    opening === 5_000 &&
    opening < OBJECTIVE.openingLatestMs &&
    gapLo === OBJECTIVE.gapMinMs &&
    gapHi > OBJECTIVE.gapMinMs &&
    gapHi <= OBJECTIVE.gapMaxMs &&
    noCutoff &&
    MATCH.durationMs === 240_000;
  return {
    name: 'opening capture and short gaps, no late cutoff',
    ok,
    detail: `open=${opening} gap=${gapLo}-${gapHi.toFixed(0)} latest=${OBJECTIVE.latestStartMs} match=${MATCH.durationMs}`,
  };
};

const scenarioCaptureRadius = (): CheckResult => {
  const expected = Math.round(COLE_CONVERTED_RANGE * 0.8);
  const ok = OBJECTIVE.capture.radius === expected && expected < COLE_CONVERTED_RANGE;
  return {
    name: 'capture zone radius is 80% of Cole reach',
    ok,
    detail: `radius=${OBJECTIVE.capture.radius} cole=${COLE_CONVERTED_RANGE} expected=${expected}`,
  };
};

const scenarioNoOldCooldown = (): CheckResult => {
  const afterFirst = canStartObjective(8_000, 7_500, false);
  const stillCool = !canStartObjective(7_000, 7_500, false);
  const ok = afterFirst && stillCool && OBJECTIVE.gapMaxMs < 10_000;
  return {
    name: 'no 60s global event cooldown',
    ok,
    detail: `afterFirst=${afterFirst} stillCool=${stillCool} gapMax=${OBJECTIVE.gapMaxMs}`,
  };
};

const scenarioCaptureRules = (): CheckResult => {
  let snap = emptyCapture();
  snap = tickCapture(snap, { alpha: 1, bravo: 0 }, 10_000).snap;
  const one = snap.progress;
  snap = emptyCapture();
  snap = tickCapture(snap, { alpha: 3, bravo: 0 }, 10_000).snap;
  const three = snap.progress;
  const finish = tickCapture(emptyCapture(), { alpha: 1, bravo: 0 }, 20_000);
  let held = tickCapture(emptyCapture(), { alpha: 1, bravo: 0 }, 8_000).snap;
  held = tickCapture(held, { alpha: 1, bravo: 1 }, 5_000).snap;
  const contested = held.phase === 'contested' && Math.abs(held.progress - 0.4) < 0.001;
  let left = tickCapture(emptyCapture(), { alpha: 1, bravo: 0 }, 10_000).snap;
  left = tickCapture(left, { alpha: 0, bravo: 0 }, 16).snap;
  const grace = left.phase === 'grace' && Math.abs(left.progress - 0.5) < 0.001;
  left = tickCapture(left, { alpha: 0, bravo: 0 }, 5_000).snap;
  const afterGrace = left.phase === 'decaying';
  left = tickCapture(left, { alpha: 0, bravo: 0 }, 5_000).snap;
  const decayed = left.progress < 0.5;
  let back = tickCapture(emptyCapture(), { alpha: 1, bravo: 0 }, 10_000).snap;
  back = tickCapture(back, { alpha: 0, bravo: 0 }, 16).snap;
  back = tickCapture(back, { alpha: 1, bravo: 0 }, 2_000).snap;
  const resumed = back.phase === 'capturing' && back.progress > 0.5 && back.progress < 0.62;
  const ok =
    Math.abs(one - three) < 1e-9 &&
    one > 0.49 &&
    one < 0.51 &&
    finish.capturedBy === 'alpha' &&
    contested &&
    grace &&
    afterGrace &&
    decayed &&
    resumed;
  return {
    name: 'capture occupancy rules',
    ok,
    detail: `one=${one.toFixed(2)} three=${three.toFixed(2)} finish=${finish.capturedBy} contested=${contested} grace=${grace} decay=${decayed} resume=${resumed}`,
  };
};

export const runObjectiveChecks = (): CheckResult[] => [
  scenarioTimingWindow(),
  scenarioRandomStart(),
  scenarioKindReroll(),
  scenarioEventPool(),
  scenarioFairKinds(),
  scenarioOpeningAndGap(),
  scenarioCaptureRadius(),
  scenarioNoOldCooldown(),
  scenarioCaptureRules(),
  scenarioPiggyReward(),
  scenarioBuffDurations(),
  scenarioXpShare(),
  scenarioShrineContest(),
  scenarioBountyPick(),
];
