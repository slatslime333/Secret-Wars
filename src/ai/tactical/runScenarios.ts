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
import { clusterRiskOf, guardHome, nudgeOffMates, protectStand, regroupStand } from './spacing';
import { cameraPrefs } from '../../config/cameraPrefs';
import { MENDER } from '../../config/mender';
import { DEMON, DEMON_BIG } from '../../config/demon';
import { COLE } from '../../config/cole';
import { WITCH } from '../../config/witch';
import { SHADOW } from '../../config/shadow';
import { DEMON_HELLFIRE, DEMON_HELL_BAT, DEMON_RAGE } from '../../heroes/abilities/demon/tunables';
import { SHADOW_CLAW } from '../../heroes/abilities/shadow/tunables';
import { NINJA_SMOKE } from '../../heroes/abilities/ninja/tunables';
import { abilityDamage } from '../../config/ratings';
import { MENDER_PULSE, MENDER_SOUL, MENDER_ANGEL } from '../../heroes/abilities/mender/tunables';

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

const ally = { x: 400, y: 400 };
const threat = { x: 520, y: 400 };
const protectBody = { x: 360, y: 410, team: 'alpha' as const, attackRange: 70, role: 'frontliner', kind: 'hero' as const, id: 2 };
const protectA = protectStand(protectBody, ally, threat, 1, false, 1);
const protectB = protectStand({ ...protectBody, id: 3 }, ally, threat, -1, false, 2);
const protectGapAlly = Math.hypot(protectA.x - ally.x, protectA.y - ally.y);
const protectPair = Math.hypot(protectA.x - protectB.x, protectA.y - protectB.y);
const protectOk = protectGapAlly > 28 && protectPair > 24;
if (!protectOk) {
  failed += 1;
  console.log(
    `FAIL  protect stand  allyGap=${protectGapAlly.toFixed(0)} pair=${protectPair.toFixed(0)} a=(${protectA.x.toFixed(0)},${protectA.y.toFixed(0)})`,
  );
} else {
  console.log(`ok  protect stand  allyGap=${protectGapAlly.toFixed(0)} pair=${protectPair.toFixed(0)}`);
}

const regroupDest = regroupStand(protectBody, ally, false, 1, 0);
const regroupGap = Math.hypot(regroupDest.x - ally.x, regroupDest.y - ally.y);
const regroupOk = regroupGap > 28;
if (!regroupOk) {
  failed += 1;
  console.log(`FAIL  regroup stand  gap=${regroupGap.toFixed(0)}`);
} else {
  console.log(`ok  regroup stand  gap=${regroupGap.toFixed(0)}`);
}

const home = guardHome({ x: 800, y: 500, team: 'alpha' }, 7);
const homeGap = Math.hypot(home.x - 800, home.y - 500);
const homeOk = homeGap > 16;
if (!homeOk) {
  failed += 1;
  console.log(`FAIL  skeleton home  gap=${homeGap.toFixed(0)}`);
} else {
  console.log(`ok  skeleton home  gap=${homeGap.toFixed(0)}`);
}

const stacked = nudgeOffMates(400, 400, protectBody, [{ x: 400, y: 400, id: 9, kind: 'hero' }], 'regroup', 36);
const stackedGap = Math.hypot(stacked.x - 400, stacked.y - 400);
const stackedOk = stackedGap > 8;
if (!stackedOk) {
  failed += 1;
  console.log(`FAIL  crowd nudge  gap=${stackedGap.toFixed(0)}`);
} else {
  console.log(`ok  crowd nudge  gap=${stackedGap.toFixed(0)}`);
}

const packedRisk = clusterRiskOf(
  { x: 400, y: 400, kind: 'hero' },
  [
    { x: 408, y: 402, kind: 'hero' },
    { x: 404, y: 396, kind: 'hero' },
  ],
  [{ x: 500, y: 400, kind: 'hero', visible: true, attacking: true, role: 'ranged-tank', heroId: 'witch', attackRange: 220 }],
);
const safeRisk = clusterRiskOf(
  { x: 400, y: 400, kind: 'hero' },
  [
    { x: 408, y: 402, kind: 'hero' },
    { x: 404, y: 396, kind: 'hero' },
  ],
  [{ x: 900, y: 400, kind: 'hero', visible: true, attacking: false, role: 'frontliner', heroId: 'ninja', attackRange: 70 }],
);
const clusterOk = packedRisk > 0.2 && safeRisk === 0;
if (!clusterOk) {
  failed += 1;
  console.log(`FAIL  cluster risk  packed=${packedRisk.toFixed(2)} safe=${safeRisk.toFixed(2)}`);
} else {
  console.log(`ok  cluster risk  packed=${packedRisk.toFixed(2)} safe=${safeRisk.toFixed(2)}`);
}

const savedFov = cameraPrefs.getFov();
cameraPrefs.setFov(0);
const zoomIn = cameraPrefs.zoomMultiplier();
cameraPrefs.setFov(1);
const zoomOut = cameraPrefs.zoomMultiplier();
cameraPrefs.setFov(savedFov);
const gameplayZoomOk = zoomIn > 2 && zoomOut < 1.1 && zoomIn !== zoomOut;
if (!gameplayZoomOk) {
  failed += 1;
  console.log(`FAIL  fov gameplay zoom  in=${zoomIn.toFixed(2)} out=${zoomOut.toFixed(2)}`);
} else {
  console.log(`ok  fov gameplay zoom  in=${zoomIn.toFixed(2)} out=${zoomOut.toFixed(2)}`);
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

if (MENDER.ratings.damage !== 7 || MENDER.attackDamage !== 9) {
  failed += 1;
  console.log(`FAIL  mender damage  rating=${MENDER.ratings.damage} dmg=${MENDER.attackDamage}`);
} else {
  console.log('ok  mender damage  rating 7 / hit 9');
}
if (MENDER.ratings.attackSpeed !== 87) {
  failed += 1;
  console.log(`FAIL  mender attack speed  ${MENDER.ratings.attackSpeed} !== 87`);
} else {
  console.log('ok  mender attack speed  87');
}
if (MENDER.ratings.staminaRegen !== 80 || MENDER.ratings.stamina !== 58) {
  failed += 1;
  console.log(
    `FAIL  mender stamina  regen=${MENDER.ratings.staminaRegen} pool=${MENDER.ratings.stamina}`,
  );
} else {
  console.log('ok  mender stamina  recovery 80 / pool 58');
}
if (
  MENDER_PULSE.radius >= 4 ||
  MENDER_PULSE.healHealth !== 0.75 ||
  MENDER_PULSE.healStamina !== 0.5 ||
  MENDER_PULSE.armOffsetRad >= 0.028 ||
  MENDER_PULSE.spreadRad >= 0.07
) {
  failed += 1;
  console.log(
    `FAIL  mender pulse  r=${MENDER_PULSE.radius} heal=${MENDER_PULSE.healHealth}/${MENDER_PULSE.healStamina} offset=${MENDER_PULSE.armOffsetRad} spread=${MENDER_PULSE.spreadRad}`,
  );
} else {
  console.log(
    `ok  mender pulse  r=${MENDER_PULSE.radius} heal ${MENDER_PULSE.healHealth} hp / ${MENDER_PULSE.healStamina} stam`,
  );
}
if (MENDER_SOUL.attachOffset < 32) {
  failed += 1;
  console.log(`FAIL  mender soul attach  offset=${MENDER_SOUL.attachOffset}`);
} else {
  console.log(`ok  mender soul attach  offset=${MENDER_SOUL.attachOffset}`);
}
if (MENDER_ANGEL.aimLength < MENDER_ANGEL.maxRange * 1.4) {
  failed += 1;
  console.log(`FAIL  mender angel aim  len=${MENDER_ANGEL.aimLength} range=${MENDER_ANGEL.maxRange}`);
} else {
  console.log(`ok  mender angel aim  len=${MENDER_ANGEL.aimLength}`);
}

if (
  DEMON.ratings.damage !== 9 ||
  DEMON.ratings.attackSpeed !== 50 ||
  DEMON.ratings.speed !== 60 ||
  DEMON.ratings.stamina !== 53
) {
  failed += 1;
  console.log(
    `FAIL  demon ratings  dmg=${DEMON.ratings.damage} atk=${DEMON.ratings.attackSpeed} spd=${DEMON.ratings.speed} stam=${DEMON.ratings.stamina}`,
  );
} else {
  console.log('ok  demon ratings  damage 9 / attack 50 / speed 60 / stamina 53');
}
if (DEMON_HELL_BAT.maxDurationMs !== 20000 || DEMON_HELL_BAT.recastLockMs < 160) {
  failed += 1;
  console.log(
    `FAIL  hell bat window  max=${DEMON_HELL_BAT.maxDurationMs} recast=${DEMON_HELL_BAT.recastLockMs}`,
  );
} else {
  console.log(
    `ok  hell bat window  max=${DEMON_HELL_BAT.maxDurationMs} recast=${DEMON_HELL_BAT.recastLockMs}`,
  );
}
if (!DEMON_HELL_BAT.deferCooldown) {
  failed += 1;
  console.log('FAIL  hell bat cooldown starts on press');
} else {
  console.log('ok  hell bat cooldown deferred until explode');
}
if (DEMON_HELLFIRE.radius !== Math.round(NINJA_SMOKE.radius * 0.65)) {
  failed += 1;
  console.log(`FAIL  hellfire radius  ${DEMON_HELLFIRE.radius} !== ${Math.round(NINJA_SMOKE.radius * 0.65)}`);
} else {
  console.log(`ok  hellfire radius  ${DEMON_HELLFIRE.radius}`);
}
if (DEMON_RAGE.fillCostMul !== 1.35) {
  failed += 1;
  console.log(`FAIL  rage fill cost  ${DEMON_RAGE.fillCostMul}`);
} else {
  console.log('ok  rage fill cost  1.35');
}
if (DEMON_BIG.attackRange !== Math.round(SHADOW.attackRange * 0.75)) {
  failed += 1;
  console.log(`FAIL  big demon range  ${DEMON_BIG.attackRange}`);
} else {
  console.log(`ok  big demon range  ${DEMON_BIG.attackRange}`);
}
if (COLE.ratings.attackSpeed !== 33 || COLE.ratings.speed !== 52) {
  failed += 1;
  console.log(`FAIL  cole ratings  atk=${COLE.ratings.attackSpeed} spd=${COLE.ratings.speed}`);
} else {
  console.log('ok  cole ratings  attack 33 / speed 52');
}
if (WITCH.ratings.damage !== 52 || WITCH.ratings.stamina !== 53) {
  failed += 1;
  console.log(`FAIL  witch ratings  dmg=${WITCH.ratings.damage} stam=${WITCH.ratings.stamina}`);
} else {
  console.log('ok  witch ratings  damage 52 / stamina 53');
}
if (Math.abs(SHADOW_CLAW.damage - abilityDamage(64) * 2.7 * 0.9 * 0.77) > 0.001) {
  failed += 1;
  console.log(`FAIL  shadow claw damage  ${SHADOW_CLAW.damage}`);
} else {
  console.log('ok  shadow claw damage  -23%');
}

if (failed > 0) {
  throw new Error(`${failed} tactical scenario(s) failed`);
}
console.log(`\n${results.length} tactical scenarios passed`);
console.log(`${objectiveChecks.length} objective checks passed`);
console.log(`${draftChecks.length} draft checks passed`);
console.log(`${mapChecks.length} map checks passed`);
