import { runTacticalScenarios } from './scenarios';
import { runObjectiveChecks } from '../../match/objectives/runChecks';
import { runDraftChecks } from '../../draft/runChecks';
import { runMapChecks } from '../../map/runChecks';
import { moveGoal } from './move';
import { smashBatHits, smashHitsTarget } from '../../heroes/abilities/death/smashHit';
import { atFarEdge, roamHuntPoint, ARENA } from '../../config/arena';
import { kitProfileOf } from './kitProfile';
import { personalityFromSeed } from './personality';
import { pickOpeningForTest } from './strategy';

const results = runTacticalScenarios();
let failed = 0;
for (const result of results) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}

const smashAhead = smashHitsTarget(0, 0, 1, 0, 80, 8, 16);
const smashHandle = smashBatHits(0, 0, 0, 24, 4, 16);
const smashSide = smashHitsTarget(0, 0, 1, 0, 0, 90, 16);
const smashBehind = smashHitsTarget(0, 0, 1, 0, -80, 0, 16);
const smashSwept = smashBatHits(0, 0, Math.PI / 2, 8, 80, 16);
if (!smashAhead || !smashHandle || smashSide || smashBehind || !smashSwept) {
  failed += 1;
  console.log(
    `FAIL  smash bat  ahead=${smashAhead} handle=${smashHandle} side=${smashSide} behind=${smashBehind} swept=${smashSwept}`,
  );
} else {
  console.log('ok  smash bat  forward/handle/swept hit, side/behind miss');
}

const body = {
  x: ARENA.width - 80,
  y: ARENA.laneY.mid,
  team: 'alpha' as const,
  attackRange: 70,
  role: 'frontliner',
  kind: 'hero' as const,
};
const hunt = moveGoal('search_for_target', body, 4000, 220, ARENA.laneY.mid);
const expected = roamHuntPoint('alpha', ARENA.laneY.mid, Math.floor(4000 / 1800));
const huntOk =
  atFarEdge('alpha', body.x) &&
  Math.hypot(hunt.x - expected.x, hunt.y - expected.y) < 1 &&
  hunt.x < ARENA.width * 0.7;
if (!huntOk) {
  failed += 1;
  console.log(`FAIL  far-edge roam  dest=(${hunt.x.toFixed(0)},${hunt.y.toFixed(0)}) halt=${hunt.halt}`);
} else {
  console.log(`ok  far-edge roam  dest=(${hunt.x.toFixed(0)},${hunt.y.toFixed(0)}) halt=${hunt.halt}`);
}

const witch = kitProfileOf('witch', 'ranged-tank', 220);
const ninja = kitProfileOf('ninja', 'disruptor', 123);
const openings = new Set<string>();
for (let i = 0; i < 8; i += 1) {
  const seed = `cpu-${i}`;
  openings.add(pickOpeningForTest(seed, i, witch, personalityFromSeed(seed)));
  openings.add(pickOpeningForTest(seed, i, ninja, personalityFromSeed(`${seed}-n`)));
}
if (openings.size < 4) {
  failed += 1;
  console.log(`FAIL  opening variety  ${[...openings].join(',')}`);
} else {
  console.log(`ok  opening variety  ${openings.size} plans`);
}
const cautiousWitch = personalityFromSeed('cautious-witch');
cautiousWitch.aggression = 0.28;
cautiousWitch.caution = 0.82;
cautiousWitch.patience = 0.8;
const reckless = pickOpeningForTest('w1', 0, witch, cautiousWitch);
if (reckless === 'rush_center') {
  failed += 1;
  console.log(`FAIL  cautious witch rush  ${reckless}`);
} else {
  console.log(`ok  cautious witch opening  ${reckless}`);
}

const execBody = {
  x: 900,
  y: ARENA.laneY.mid,
  team: 'alpha' as const,
  attackRange: 196,
  role: 'ranged',
  kind: 'hero' as const,
};
const execGoal = moveGoal('contest_objective', execBody, 0, 220, ARENA.laneY.mid, undefined, undefined, 1, 0, undefined, {
  stance: 'ranged',
  preferredRange: 172,
  objective: { kind: 'executioner', x: 1100, y: ARENA.laneY.mid, radius: 48 },
});
const execGap = Math.hypot(execGoal.x - 1100, execGoal.y - ARENA.laneY.mid);
const execStand = Math.max(48 + 18, Math.min(196 * 0.86, 196 + 48 * 0.2));
const execOk = Math.abs(execGap - execStand) < 28 && execGap > 120;
if (!execOk) {
  failed += 1;
  console.log(`FAIL  executioner standoff  gap=${execGap.toFixed(0)} stand=${execStand.toFixed(0)} halt=${execGoal.halt}`);
} else {
  console.log(`ok  executioner standoff  gap=${execGap.toFixed(0)} stand=${execStand.toFixed(0)}`);
}

const objectiveChecks = runObjectiveChecks();
for (const result of objectiveChecks) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}

const draftChecks = runDraftChecks();
for (const result of draftChecks) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}

const mapChecks = runMapChecks();
for (const result of mapChecks) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}

if (failed > 0) {
  throw new Error(`${failed} tactical scenario(s) failed`);
}
console.log(`\n${results.length} tactical scenarios passed`);
console.log(`${objectiveChecks.length} objective checks passed`);
console.log(`${draftChecks.length} draft checks passed`);
console.log(`${mapChecks.length} map checks passed`);
