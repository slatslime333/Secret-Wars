import { canStartObjective, nextObjectiveKind, OBJECTIVE, pickObjectiveKind, pickObjectiveStartAt } from '../../config/objective';
import { COLE_CONVERTED_RANGE } from '../../config/cole';
import { emptyCapture, tickCapture } from './captureLogic';
import { shrineControlOf } from './shrineLogic';
import { pickBountyTargets } from './bountyPick';
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
  const tooEarly = canStartObjective(19_999, 0, false);
  const firstOk = canStartObjective(20_000, 0, false);
  const lastOk = canStartObjective(139_999, 0, false);
  const tooLate = canStartObjective(140_000, 0, false);
  const overlap = canStartObjective(60_000, 0, true);
  const cooling = canStartObjective(90_000, 100_000, false);
  const ok = !tooEarly && firstOk && lastOk && !tooLate && !overlap && !cooling;
  return {
    name: 'objective start window',
    ok,
    detail: `early=${tooEarly} start=${firstOk} last=${lastOk} late=${tooLate} overlap=${overlap} cool=${cooling}`,
  };
};

const scenarioRandomStart = (): CheckResult => {
  const a = pickObjectiveStartAt(0, OBJECTIVE.latestStartMs, rngOf([0]));
  const b = pickObjectiveStartAt(0, OBJECTIVE.latestStartMs, rngOf([0.999]));
  const afterCool = pickObjectiveStartAt(120_000, OBJECTIVE.latestStartMs, rngOf([0.4]));
  const none = pickObjectiveStartAt(140_000, OBJECTIVE.latestStartMs, rngOf([0.2]));
  const ok =
    a === OBJECTIVE.earliestStartMs &&
    b !== undefined &&
    b < OBJECTIVE.latestStartMs &&
    afterCool !== undefined &&
    afterCool >= 120_000 &&
    none === undefined;
  return {
    name: 'objective random start',
    ok,
    detail: `a=${a} b=${b?.toFixed(0)} cool=${afterCool?.toFixed(0)} none=${none}`,
  };
};

const scenarioKindReroll = (): CheckResult => {
  const first = pickObjectiveKind(undefined, rngOf([0.1]));
  const same = pickObjectiveKind('capture_zone', rngOf([0.9, 0.1]));
  const other = pickObjectiveKind('capture_zone', rngOf([0.1, 0.1]));
  const ok = Boolean(first) && same === 'capture_zone' && other === 'golden_piggy';
  return { name: 'objective kind variety', ok, detail: `first=${first} same=${same} other=${other}` };
};

const scenarioEventPool = (): CheckResult => {
  const expected = ['capture_zone', 'golden_piggy', 'bounty_target', 'healing_shrine', 'executioner'];
  const ok =
    OBJECTIVE.kinds.length === 5 &&
    expected.every((kind) => (OBJECTIVE.kinds as readonly string[]).includes(kind));
  return { name: 'objective event pool', ok, detail: OBJECTIVE.kinds.join(',') };
};

const scenarioPiggyReward = (): CheckResult => {
  const ok = OBJECTIVE.scoreReward === 1;
  return { name: 'piggy bank team score is +1', ok, detail: `score=${OBJECTIVE.scoreReward}` };
};

const scenarioBuffDurations = (): CheckResult => {
  const ok =
    OBJECTIVE.bounty.buffMs === 20_000 &&
    OBJECTIVE.bounty.moveMul === 1.3 &&
    OBJECTIVE.bounty.attackMul === 1.3 &&
    OBJECTIVE.bounty.levelReward === 2 &&
    OBJECTIVE.shrine.durationMs === 20_000 &&
    OBJECTIVE.executioner.buffMs === 20_000 &&
    OBJECTIVE.executioner.moveMul === 1.18 &&
    OBJECTIVE.executioner.attackMul === 1.18 &&
    OBJECTIVE.executioner.staminaMul === 1.18 &&
    OBJECTIVE.executioner.attackMs >= 1_200 &&
    OBJECTIVE.executioner.moveSpeed < 120;
  return {
    name: 'event reward tunables',
    ok,
    detail: `bountyLv=${OBJECTIVE.bounty.levelReward} shrine=${OBJECTIVE.shrine.durationMs} execAtk=${OBJECTIVE.executioner.attackMs}`,
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

const scenarioKindDeck = (): CheckResult => {
  const queue: Array<(typeof OBJECTIVE.kinds)[number]> = [];
  const firstCycle = new Set<string>();
  for (let i = 0; i < OBJECTIVE.kinds.length; i += 1) {
    firstCycle.add(nextObjectiveKind(queue, rngOf([0.2, 0.8, 0.4, 0.6])));
  }
  const second = nextObjectiveKind(queue, rngOf([0.3]));
  const ok = firstCycle.size === OBJECTIVE.kinds.length && OBJECTIVE.kinds.includes(second);
  return {
    name: 'objective kind deck covers every registered event',
    ok,
    detail: `cycle=${[...firstCycle].join(',')} next=${second} kinds=${OBJECTIVE.kinds.join(',')}`,
  };
};

const scenarioFirstEventFitsSecond = (): CheckResult => {
  const firstHi = pickObjectiveStartAt(OBJECTIVE.earliestStartMs, OBJECTIVE.firstLatestStartMs, rngOf([0.999]));
  const afterCaptureCool = (OBJECTIVE.firstLatestStartMs - 1) + OBJECTIVE.capture.captureMs + OBJECTIVE.cooldownMs;
  const second = pickObjectiveStartAt(afterCaptureCool, Math.min(afterCaptureCool + 8_000, OBJECTIVE.latestStartMs), rngOf([0]));
  const tooLateFirst = pickObjectiveStartAt(OBJECTIVE.firstLatestStartMs, OBJECTIVE.firstLatestStartMs, rngOf([0.2]));
  const ok =
    firstHi !== undefined &&
    firstHi < OBJECTIVE.firstLatestStartMs &&
    afterCaptureCool < OBJECTIVE.latestStartMs &&
    second !== undefined &&
    second >= afterCaptureCool &&
    tooLateFirst === undefined;
  return {
    name: 'first event leaves room for every other kind',
    ok,
    detail: `firstHi=${firstHi?.toFixed(0)} coolDone=${afterCaptureCool} second=${second?.toFixed(0)} none=${tooLateFirst}`,
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

const scenarioSecondEventWindow = (): CheckResult => {
  const afterFirst = pickObjectiveStartAt(20_000 + 60_000, OBJECTIVE.latestStartMs, rngOf([0.5]));
  const tooLateForSecond = pickObjectiveStartAt(140_000, OBJECTIVE.latestStartMs, rngOf([0.2]));
  const coolBlocks = !canStartObjective(70_000, 80_000, false);
  const afterCool = canStartObjective(80_000, 80_000, false);
  const ok = afterFirst !== undefined && afterFirst >= 80_000 && tooLateForSecond === undefined && coolBlocks && afterCool;
  return {
    name: 'second event after 60s cooldown',
    ok,
    detail: `next=${afterFirst?.toFixed(0)} none=${tooLateForSecond} coolBlocks=${coolBlocks} afterCool=${afterCool}`,
  };
};

const scenarioCaptureRules = (): CheckResult => {
  let snap = emptyCapture();
  // One player captures at the same speed as three — 20s to finish.
  snap = tickCapture(snap, { alpha: 1, bravo: 0 }, 10_000).snap;
  const one = snap.progress;
  snap = emptyCapture();
  snap = tickCapture(snap, { alpha: 3, bravo: 0 }, 10_000).snap;
  const three = snap.progress;
  const finish = tickCapture(emptyCapture(), { alpha: 1, bravo: 0 }, 20_000);
  // Contested freezes.
  let held = tickCapture(emptyCapture(), { alpha: 1, bravo: 0 }, 8_000).snap;
  held = tickCapture(held, { alpha: 1, bravo: 1 }, 5_000).snap;
  const contested = held.phase === 'contested' && Math.abs(held.progress - 0.4) < 0.001;
  // Leave: 5s grace keeps progress, then decay.
  let left = tickCapture(emptyCapture(), { alpha: 1, bravo: 0 }, 10_000).snap;
  left = tickCapture(left, { alpha: 0, bravo: 0 }, 16).snap;
  const grace = left.phase === 'grace' && Math.abs(left.progress - 0.5) < 0.001;
  left = tickCapture(left, { alpha: 0, bravo: 0 }, 5_000).snap;
  const afterGrace = left.phase === 'decaying';
  left = tickCapture(left, { alpha: 0, bravo: 0 }, 5_000).snap;
  const decayed = left.progress < 0.5;
  // Return during grace preserves and resumes.
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
  scenarioKindDeck(),
  scenarioFirstEventFitsSecond(),
  scenarioCaptureRadius(),
  scenarioSecondEventWindow(),
  scenarioCaptureRules(),
  scenarioPiggyReward(),
  scenarioBuffDurations(),
  scenarioShrineContest(),
  scenarioBountyPick(),
];
