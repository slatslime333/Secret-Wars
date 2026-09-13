import { canStartObjective, OBJECTIVE, pickObjectiveKind, pickObjectiveStartAt } from '../../config/objective';
import { COLE } from '../../config/cole';
import { emptyCapture, tickCapture } from './captureLogic';

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

const scenarioCaptureRadius = (): CheckResult => {
  const expected = Math.round(COLE.attackRange * 0.8);
  const ok = OBJECTIVE.capture.radius === expected && expected < COLE.attackRange;
  return {
    name: 'capture zone radius is 80% of Cole reach',
    ok,
    detail: `radius=${OBJECTIVE.capture.radius} cole=${COLE.attackRange} expected=${expected}`,
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
  scenarioCaptureRadius(),
  scenarioSecondEventWindow(),
  scenarioCaptureRules(),
];
