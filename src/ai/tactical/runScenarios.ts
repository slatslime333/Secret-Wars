import { runTacticalScenarios } from './scenarios';
import { moveGoal } from './move';
import { smashBatHits, smashHitsTarget } from '../../heroes/abilities/death/smashHit';
import { atFarEdge, roamHuntPoint } from '../../config/arena';

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
  x: 2040,
  y: 640,
  team: 'alpha' as const,
  attackRange: 70,
  role: 'frontliner',
  kind: 'hero' as const,
};
const hunt = moveGoal('search_for_target', body, 4000, 220, 640);
const expected = roamHuntPoint('alpha', 640, Math.floor(4000 / 1800));
const huntOk =
  atFarEdge('alpha', body.x) &&
  Math.hypot(hunt.x - expected.x, hunt.y - expected.y) < 1 &&
  hunt.x < 1600;
if (!huntOk) {
  failed += 1;
  console.log(`FAIL  far-edge roam  dest=(${hunt.x.toFixed(0)},${hunt.y.toFixed(0)}) halt=${hunt.halt}`);
} else {
  console.log(`ok  far-edge roam  dest=(${hunt.x.toFixed(0)},${hunt.y.toFixed(0)}) halt=${hunt.halt}`);
}

if (failed > 0) {
  throw new Error(`${failed} tactical scenario(s) failed`);
}
console.log(`\n${results.length} tactical scenarios passed`);
