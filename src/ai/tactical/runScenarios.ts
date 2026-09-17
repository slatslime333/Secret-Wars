import { runTacticalScenarios } from './scenarios';
import { runObjectiveChecks } from '../../match/objectives/runChecks';
import { runDraftChecks } from '../../draft/runChecks';
import { runMapChecks } from '../../map/runChecks';
import { moveGoal } from './move';
import { smashBatHits, smashHitsTarget } from '../../heroes/abilities/death/smashHit';
import { DEATH_ATTACK } from '../../heroes/abilities/death/tunables';
import { atFarEdge, roamHuntPoint, ARENA } from '../../config/arena';
import { kitProfileOf } from './kitProfile';
import { personalityFromSeed } from './personality';
import { pickOpeningForTest } from './strategy';
import { clusterRiskOf, occupancyOf, combatStand, guardHome, nudgeOffMates, protectStand, regroupStand } from './spacing';
import { cameraPrefs, spectatorZoomLimits } from '../../config/cameraPrefs';
import { MENDER } from '../../config/mender';
import { DEMON, DEMON_BIG } from '../../config/demon';
import { COLE, COLE_CONVERTED_RANGE } from '../../config/cole';
import { DEATH } from '../../config/death';
import { ROPE } from '../../config/rope';
import { WITCH, WITCH_HIT_MARKER_LINE, WITCH_HIT_MARKER_RANGE, WITCH_LIGHT_RANGE_BASE } from '../../config/witch';
import { SHADOW, SHADOW_HIT_MARKER_RANGE } from '../../config/shadow';
import { DEMON_HELLFIRE, DEMON_HELL_BAT, DEMON_RAGE } from '../../heroes/abilities/demon/tunables';
import { demonRageFromLightDamage, demonRageFromAbilityDamage } from '../../heroes/abilities/demon/form';
import { SHADOW_CLAW, SHADOW_DASH } from '../../heroes/abilities/shadow/tunables';
import { NINJA_SMOKE } from '../../heroes/abilities/ninja/tunables';
import { ABILITY_DAMAGE_CURVE } from '../../config/ratings';
import { MENDER_HIT_MARKER_LINE, MENDER_PULSE, MENDER_SOUL, MENDER_ANGEL, MENDER_WIND } from '../../heroes/abilities/mender/tunables';
import { NINJA_BASE_RANGE } from '../../config/ninja';
import { runCombatFeedbackChecks } from '../../ui/combatFeedback/runChecks';
import { runWarScoreChecks } from '../../match/score/runChecks';
import { runScoreboardChecks } from '../../match/scoreboard/runChecks';
import { WITCH_SKELETON } from '../../heroes/abilities/witch/tunables';
import { ComboTracker } from '../../combat/ComboTracker';
import { COLE_BALL } from '../../heroes/abilities/cole/tunables';
import { ROPE_GRAB, ROPE_PUNCH, ROPE_SHOT, ROPE_SPRAY } from '../../heroes/abilities/rope/tunables';
import { steerAround } from '../../map/query';
import { StuckTracker, WallProbe, CornerProbe } from './stuck';
import { generateFromSeed } from '../../map/generate';
import { MapQuery } from '../../map/query';
import { NEUTRAL_PERSONALITY } from './types';

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

const deathReach = DEATH.attackRange * 1.1 + 8;
const witchBody = {
  x: 360,
  y: ARENA.laneY.mid,
  team: 'alpha' as const,
  attackRange: WITCH.attackRange,
  role: 'ranged-tank',
  kind: 'hero' as const,
};
const deathFocus = { x: 520, y: ARENA.laneY.mid, aimX: -1, aimY: 0 };
const witchStand = moveGoal('attack', witchBody, 0, 220, ARENA.laneY.mid, deathFocus, undefined, 1, 0, undefined, {
  stance: 'ranged',
  preferredRange: WITCH.attackRange * 0.9,
  threatReach: deathReach,
});
const witchGap = Math.hypot(witchStand.x - deathFocus.x, witchStand.y - deathFocus.y);
const witchOk = witchGap > deathReach && witchGap < WITCH.attackRange * 0.95;
if (!witchOk) {
  failed += 1;
  console.log(`FAIL  witch vs death stand  gap=${witchGap.toFixed(0)} pocket=${deathReach.toFixed(0)}`);
} else {
  console.log(`ok  witch vs death stand  gap=${witchGap.toFixed(0)} pocket=${deathReach.toFixed(0)}`);
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

const attackFocus = { x: 520, y: 400 };
const standA = combatStand(protectBody, attackFocus, 'attack', 1, 0, [{ x: 400, y: 400, id: 9, kind: 'hero' }], 'melee', 0.4, 80);
const standB = combatStand({ ...protectBody, id: 3, x: 390, y: 410 }, attackFocus, 'attack', -1, 1, [{ x: 400, y: 400, id: 2, kind: 'hero' }, { x: standA.x, y: standA.y, id: 9, kind: 'hero' }], 'melee', 0.4, 80);
const standPair = Math.hypot(standA.x - standB.x, standA.y - standB.y);
const standOk = standPair > 36 && Math.hypot(standA.x - attackFocus.x, standA.y - attackFocus.y) > 40;
if (!standOk) {
  failed += 1;
  console.log(`FAIL  combat stand  pair=${standPair.toFixed(0)} a=(${standA.x.toFixed(0)},${standA.y.toFixed(0)})`);
} else {
  console.log(`ok  combat stand  pair=${standPair.toFixed(0)}`);
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
const occupancyRisk = occupancyOf(
  { x: 400, y: 400, kind: 'hero' },
  [
    { x: 408, y: 402, kind: 'hero' },
    { x: 404, y: 396, kind: 'hero' },
  ],
);
const spreadRisk = clusterRiskOf(
  { x: 400, y: 400, kind: 'hero' },
  [
    { x: 520, y: 400, kind: 'hero' },
    { x: 400, y: 530, kind: 'hero' },
  ],
  [{ x: 900, y: 400, kind: 'hero', visible: true, attacking: false, role: 'frontliner', heroId: 'ninja', attackRange: 70 }],
);
const clusterOk = packedRisk > 0.2 && occupancyRisk > 0.15 && spreadRisk < 0.12 && safeRisk >= occupancyRisk * 0.5;
if (!clusterOk) {
  failed += 1;
  console.log(
    `FAIL  cluster risk  packed=${packedRisk.toFixed(2)} occ=${occupancyRisk.toFixed(2)} spread=${spreadRisk.toFixed(2)} far=${safeRisk.toFixed(2)}`,
  );
} else {
  console.log(
    `ok  cluster risk  packed=${packedRisk.toFixed(2)} occ=${occupancyRisk.toFixed(2)} spread=${spreadRisk.toFixed(2)} far=${safeRisk.toFixed(2)}`,
  );
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

{
  const savedSpecFov = cameraPrefs.getFov();
  cameraPrefs.setFov(0.5);
  const limits = spectatorZoomLimits(1280, 720, 1);
  cameraPrefs.setFov(savedSpecFov);
  const fit = Math.min(1280 / ARENA.width, 720 / ARENA.height);
  const specOk = limits.min < limits.max && limits.min > fit && limits.max <= 1.05 && limits.max >= 0.9;
  if (!specOk) {
    failed += 1;
    console.log(`FAIL  spectate zoom  min=${limits.min.toFixed(3)} max=${limits.max.toFixed(3)} fit=${fit.toFixed(3)}`);
  } else {
    console.log(`ok  spectate zoom  min=${limits.min.toFixed(2)} max=${limits.max.toFixed(2)} (not full map)`);
  }
}

const objectiveChecks = runObjectiveChecks();
for (const result of objectiveChecks) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}

const warScoreChecks = runWarScoreChecks();
for (const result of warScoreChecks) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}

const scoreboardChecks = runScoreboardChecks();
for (const result of scoreboardChecks) {
  const mark = result.ok ? 'ok' : 'FAIL';
  if (!result.ok) {
    failed += 1;
  }
  console.log(`${mark}  ${result.name}  ${result.detail}`);
}

const feedbackChecks = runCombatFeedbackChecks();
for (const result of feedbackChecks) {
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

if (MENDER.ratings.damage !== 8 || MENDER.attackDamage !== 9) {
  failed += 1;
  console.log(`FAIL  mender damage  rating=${MENDER.ratings.damage} dmg=${MENDER.attackDamage}`);
} else {
  console.log('ok  mender damage  rating 8 / hit 9');
}
if (MENDER.ratings.attackSpeed !== 80) {
  failed += 1;
  console.log(`FAIL  mender attack speed  ${MENDER.ratings.attackSpeed} !== 80`);
} else {
  console.log('ok  mender attack speed  80');
}
if (MENDER.ratings.staminaRegen !== 71 || MENDER.ratings.stamina !== 58) {
  failed += 1;
  console.log(
    `FAIL  mender stamina  regen=${MENDER.ratings.staminaRegen} pool=${MENDER.ratings.stamina}`,
  );
} else {
  console.log('ok  mender stamina  recovery 71 / pool 58');
}
if (
  MENDER_PULSE.radius >= 4 ||
  MENDER_PULSE.healHealth !== 1 ||
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
if (
  MENDER_SOUL.moveMul !== 1.15 ||
  MENDER_SOUL.attackSpeedMul !== 1.15 ||
  MENDER_SOUL.staminaRegenMul !== 1.06 ||
  MENDER_SOUL.buffMs !== 7000
) {
  failed += 1;
  console.log(
    `FAIL  mender soul dash buff  move=${MENDER_SOUL.moveMul} atk=${MENDER_SOUL.attackSpeedMul} stam=${MENDER_SOUL.staminaRegenMul} ms=${MENDER_SOUL.buffMs}`,
  );
} else {
  console.log('ok  mender soul dash  +15% move/atk, +6% stam regen, 7s');
}
if (MENDER_ANGEL.cooldownMs !== 9000) {
  failed += 1;
  console.log(`FAIL  mender angel cooldown  ${MENDER_ANGEL.cooldownMs}`);
} else {
  console.log('ok  mender guardian angel  9s cooldown from explode');
}
if (MENDER_ANGEL.aimLength < MENDER_ANGEL.maxRange * 1.4) {
  failed += 1;
  console.log(`FAIL  mender angel aim  len=${MENDER_ANGEL.aimLength} range=${MENDER_ANGEL.maxRange}`);
} else {
  console.log(`ok  mender angel aim  len=${MENDER_ANGEL.aimLength}`);
}
{
  const expectedWind = Math.round(Math.round(NINJA_BASE_RANGE * 2.35) * 0.85);
  if (MENDER_WIND.radius !== expectedWind) {
    failed += 1;
    console.log(`FAIL  mender wind radius  ${MENDER_WIND.radius} !== ${expectedWind}`);
  } else {
    console.log(`ok  mender wind radius  ${MENDER_WIND.radius} (15% smaller)`);
  }
}

if (
  DEMON.ratings.damage !== 9 ||
  DEMON.ratings.attackSpeed !== 48 ||
  DEMON.ratings.speed !== 60 ||
  DEMON.ratings.stamina !== 53
) {
  failed += 1;
  console.log(
    `FAIL  demon ratings  dmg=${DEMON.ratings.damage} atk=${DEMON.ratings.attackSpeed} spd=${DEMON.ratings.speed} stam=${DEMON.ratings.stamina}`,
  );
} else {
  console.log('ok  demon ratings  damage 9 / attack 48 / speed 60 / stamina 53');
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
if (!DEMON_HELL_BAT.explodeOnContact) {
  failed += 1;
  console.log('FAIL  hell bat does not explode on contact');
} else {
  console.log('ok  hell bat  explodes on hero/minion contact or recast');
}
if (DEMON_HELLFIRE.explodeDamage !== 6) {
  failed += 1;
  console.log(`FAIL  hellfire blast  ${DEMON_HELLFIRE.explodeDamage}`);
} else {
  console.log('ok  hellfire blast  6 damage');
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
if (DEMON_RAGE.lockMs !== 1000 || DEMON_RAGE.durationMs !== 10000) {
  failed += 1;
  console.log(`FAIL  demon rage duration  lock=${DEMON_RAGE.lockMs} big=${DEMON_RAGE.durationMs}`);
} else {
  console.log('ok  demon rage  1s lock + 10s big');
}
if (
  DEMON_RAGE.lightDamageToRage !== 0.2 ||
  Math.abs(demonRageFromLightDamage(ABILITY_DAMAGE_CURVE.at50) - 0.2) > 0.0001
) {
  failed += 1;
  console.log(`FAIL  demon light rage  convert=${demonRageFromLightDamage(ABILITY_DAMAGE_CURVE.at50)}`);
} else {
  console.log('ok  demon lights  fill rage');
}
if (
  DEMON_RAGE.abilityDamageToRage !== 0.12 ||
  Math.abs(demonRageFromAbilityDamage(ABILITY_DAMAGE_CURVE.at50) - 0.12) > 0.0001
) {
  failed += 1;
  console.log(`FAIL  demon ability rage  convert=${demonRageFromAbilityDamage(ABILITY_DAMAGE_CURVE.at50)}`);
} else {
  console.log('ok  demon abilities  fill 12% rage');
}
if (DEMON_RAGE.staminaOnActivate !== 0.2) {
  failed += 1;
  console.log(`FAIL  demon rage stamina grant  ${DEMON_RAGE.staminaOnActivate}`);
} else {
  console.log('ok  demon rage  restores 20% max stamina');
}
if (DEMON_RAGE.healOnActivate !== 0.08) {
  failed += 1;
  console.log(`FAIL  demon rage heal  ${DEMON_RAGE.healOnActivate}`);
} else {
  console.log('ok  demon rage  heals 8% max health');
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
if (
  WITCH.ratings.health !== 64 ||
  WITCH.ratings.damage !== 65 ||
  WITCH.ratings.defense !== 59 ||
  WITCH.ratings.attackSpeed !== 42 ||
  WITCH.ratings.stamina !== 53
) {
  failed += 1;
  console.log(
    `FAIL  witch ratings  hp=${WITCH.ratings.health} dmg=${WITCH.ratings.damage} def=${WITCH.ratings.defense} atk=${WITCH.ratings.attackSpeed} stam=${WITCH.ratings.stamina}`,
  );
} else {
  console.log('ok  witch ratings  health 64 / damage 65 / attack 42 / defense 59');
}
if (WITCH.attackRange !== Math.round(WITCH_LIGHT_RANGE_BASE * 1.15)) {
  failed += 1;
  console.log(`FAIL  witch light range  ${WITCH.attackRange}`);
} else {
  console.log('ok  witch light range  +15%');
}
if (WITCH_HIT_MARKER_RANGE !== Math.round(WITCH_LIGHT_RANGE_BASE * 1.6)) {
  failed += 1;
  console.log(`FAIL  witch hit marker  ${WITCH_HIT_MARKER_RANGE} vs cole-independent`);
} else {
  console.log('ok  witch hit marker  +60% separate from attack range');
}
if (WITCH_HIT_MARKER_LINE <= WITCH_HIT_MARKER_RANGE) {
  failed += 1;
  console.log(`FAIL  witch hit marker line  ${WITCH_HIT_MARKER_LINE} <= ring ${WITCH_HIT_MARKER_RANGE}`);
} else {
  console.log('ok  witch hit marker line  longer than the ring');
}
if (MENDER_HIT_MARKER_LINE <= MENDER.attackRange) {
  failed += 1;
  console.log(`FAIL  mender hit marker line  ${MENDER_HIT_MARKER_LINE}`);
} else {
  console.log('ok  mender hit marker line  longer than pulse range');
}
if (Math.abs(SHADOW_CLAW.damage - 50) > 0.001) {
  failed += 1;
  console.log(`FAIL  shadow claw damage  ${SHADOW_CLAW.damage}`);
} else {
  console.log('ok  shadow claw damage  50');
}
if (Math.abs(SHADOW_DASH.damage - 26) > 0.001) {
  failed += 1;
  console.log(`FAIL  shadow dash damage  ${SHADOW_DASH.damage}`);
} else {
  console.log('ok  shadow dash damage  26');
}
if (DEATH.ratings.damage !== 70) {
  failed += 1;
  console.log(`FAIL  death damage rating  ${DEATH.ratings.damage}`);
} else {
  console.log('ok  death damage  70');
}
if (WITCH_SKELETON.maxHealth !== 150 || WITCH_SKELETON.attackDamage !== 6) {
  failed += 1;
  console.log(`FAIL  witch skeleton  hp=${WITCH_SKELETON.maxHealth} dmg=${WITCH_SKELETON.attackDamage}`);
} else {
  console.log('ok  witch skeleton  150 hp / 6 damage');
}
{
  const combo = new ComboTracker();
  combo.tap(0, 720);
  combo.tap(120, 720);
  const third = combo.preview(240, 720);
  if (third !== 1) {
    failed += 1;
    console.log(`FAIL  combo wrap  third=${third}`);
  } else {
    console.log('ok  light combo  two-hit wrap, no finisher');
  }
}
if (SHADOW.ratings.damage !== 68 || SHADOW.ratings.defense !== 39) {
  failed += 1;
  console.log(`FAIL  shadow ratings  dmg=${SHADOW.ratings.damage} def=${SHADOW.ratings.defense}`);
} else {
  console.log('ok  shadow ratings  damage 68 / defense 39');
}
if (SHADOW_HIT_MARKER_RANGE !== Math.round(SHADOW.attackRange * 2.15) || SHADOW_HIT_MARKER_RANGE <= SHADOW.attackRange * 2) {
  failed += 1;
  console.log(`FAIL  shadow hit marker  ${SHADOW_HIT_MARKER_RANGE} vs attack ${SHADOW.attackRange}`);
} else {
  console.log(`ok  shadow hit marker  ${SHADOW_HIT_MARKER_RANGE} independent of cole`);
}
if (
  ROPE.ratings.damage !== 39 ||
  ROPE.ratings.staminaRegen !== 70 ||
  ROPE.ratings.attackSpeed !== 69
) {
  failed += 1;
  console.log(
    `FAIL  rope ratings  dmg=${ROPE.ratings.damage} regen=${ROPE.ratings.staminaRegen} atk=${ROPE.ratings.attackSpeed}`,
  );
} else {
  console.log('ok  rope ratings  damage 39 / stam regen 70 / attack 69');
}
if (ROPE_SHOT.crippleMs !== 5000) {
  failed += 1;
  console.log(`FAIL  rope light slow  ${ROPE_SHOT.crippleMs}`);
} else {
  console.log('ok  rope light slow  5s');
}
if (Math.round(ROPE_GRAB.damage) !== 34) {
  failed += 1;
  console.log(`FAIL  rope grab damage  ${ROPE_GRAB.damage}`);
} else {
  console.log('ok  rope grab damage  34');
}
if (Math.round(ROPE_PUNCH.damage) !== 29) {
  failed += 1;
  console.log(`FAIL  mega punch damage  ${ROPE_PUNCH.damage}`);
} else {
  console.log('ok  mega punch damage  29');
}
if (ROPE_SPRAY.shotsPerPulse !== 3) {
  failed += 1;
  console.log(`FAIL  rope spray pulse  ${ROPE_SPRAY.shotsPerPulse}`);
} else {
  console.log('ok  rope spray  3 random ropes per pulse');
}
if (
  DEATH.ratings.defense !== 70 ||
  DEATH.ratings.stamina !== 65 ||
  DEATH.ratings.health !== 69 ||
  DEATH.ratings.speed !== 28 ||
  DEATH.ratings.staminaRegen !== 49
) {
  failed += 1;
  console.log(
    `FAIL  death ratings  def=${DEATH.ratings.defense} stam=${DEATH.ratings.stamina} hp=${DEATH.ratings.health} spd=${DEATH.ratings.speed} regen=${DEATH.ratings.staminaRegen}`,
  );
} else {
  console.log('ok  death ratings  health 69 / stamina 65 / regen 49 / speed 28 / damage 70 / defense 70');
}
if (DEATH_ATTACK.pairDelayMs !== 820) {
  failed += 1;
  console.log(`FAIL  death pair delay  ${DEATH_ATTACK.pairDelayMs}`);
} else {
  console.log('ok  death light  locked two-hit burst then 820ms pause');
}
const coleRangeBefore = Math.round(Math.round(Math.round(COLE_CONVERTED_RANGE * 0.75) * 1.15) * 1.17);
if (COLE.attackRange !== Math.round(coleRangeBefore * 1.13)) {
  failed += 1;
  console.log(`FAIL  cole attack radius  ${COLE.attackRange} !== ${Math.round(coleRangeBefore * 1.13)}`);
} else {
  console.log('ok  cole attack radius  +13%');
}
if (Math.round(COLE_BALL.damage) !== 30) {
  failed += 1;
  console.log(`FAIL  electric ball damage  ${COLE_BALL.damage}`);
} else {
  console.log('ok  electric ball damage  30');
}

{
  const blocked = (px: number) => px > 178 && px < 222;
  const steered = steerAround((x, _y, r) => blocked(x + r * 0.2), 150, 200, 1, 0, 34);
  const openSide = Math.abs(steered.y) > 0.35 && !blocked(150 + steered.x * 34);
  if (!openSide) {
    failed += 1;
    console.log(`FAIL  steer around wall  dir=(${steered.x.toFixed(2)},${steered.y.toFixed(2)})`);
  } else {
    console.log(`ok  steer around wall  dir=(${steered.x.toFixed(2)},${steered.y.toFixed(2)})`);
  }
}

{
  const wall = new WallProbe(180, 40);
  const tracker = new StuckTracker();
  const personality = { ...NEUTRAL_PERSONALITY, caution: 0.4, movementPrecision: 0.55 };
  const kit = kitProfileOf('shadow', 'frontliner', 145);
  let x = 150;
  let y = 200;
  let recovered = false;
  let heldY: number | undefined;
  let flipped = false;
  for (let step = 0; step < 18; step += 1) {
    const now = step * 50;
    const desired = { x: 1, y: 0 };
    const steered = wall.steer(x, y, 1, 0);
    const dir = tracker.filter(now, x, y, desired, steered, 180, wall, personality, kit, undefined, 'frontliner');
    if (tracker.recovering) {
      recovered = true;
      if (heldY === undefined) {
        heldY = Math.sign(dir.y || 0.0001);
      } else if (Math.sign(dir.y || 0.0001) !== heldY && step < 10) {
        flipped = true;
      }
      x += dir.x * 9;
      y += dir.y * 9;
    }
  }
  if (!recovered || flipped || Math.abs(y - 200) < 8) {
    failed += 1;
    console.log(`FAIL  stuck recovery  recovered=${recovered} flip=${flipped} y=${y.toFixed(0)}`);
  } else {
    console.log(`ok  stuck recovery  y=${y.toFixed(0)} label=${tracker.label || 'cleared'}`);
  }
}

{
  const wall = new WallProbe(180, 40);
  const tracker = new StuckTracker();
  const personality = { ...NEUTRAL_PERSONALITY };
  const desired = { x: 1, y: 0 };
  tracker.filter(0, 150, 200, desired, { x: 0, y: 0 }, 180, wall, personality, undefined);
  const early = tracker.recovering;
  tracker.filter(80, 150, 200, desired, { x: 0, y: 0 }, 180, wall, personality, undefined);
  if (early || tracker.recovering) {
    failed += 1;
    console.log(`FAIL  stuck ignores short stalls  early=${early} later=${tracker.recovering}`);
  } else {
    console.log('ok  stuck ignores short stalls');
  }
}

{
  const corner = new CornerProbe(180, 180);
  const tracker = new StuckTracker();
  const personality = { ...NEUTRAL_PERSONALITY, caution: 0.35, movementPrecision: 0.5 };
  const kit = kitProfileOf('shadow', 'frontliner', 145);
  let x = 155;
  let y = 155;
  const start = { x, y };
  let recovered = false;
  let held: { x: number; y: number } | undefined;
  let flipped = false;
  for (let step = 0; step < 28; step += 1) {
    const now = step * 50;
    const desired = { x: 1, y: 1 };
    const steered = corner.steer(x, y, 1, 1);
    const dir = tracker.filter(now, x, y, desired, steered, 180, corner, personality, kit, undefined, 'frontliner');
    if (tracker.recovering) {
      recovered = true;
      if (!held) {
        held = { x: Math.sign(dir.x || 0.0001), y: Math.sign(dir.y || 0.0001) };
      } else if (step < 12 && (Math.sign(dir.x || 0.0001) !== held.x || Math.sign(dir.y || 0.0001) !== held.y)) {
        flipped = true;
      }
      x += dir.x * 9;
      y += dir.y * 9;
    }
  }
  const backedOut = x + y < start.x + start.y - 12;
  if (!recovered || flipped || !backedOut) {
    failed += 1;
    console.log(
      `FAIL  corner recovery  recovered=${recovered} flip=${flipped} pos=${x.toFixed(0)},${y.toFixed(0)}`,
    );
  } else {
    console.log(`ok  corner recovery  pos=${x.toFixed(0)},${y.toFixed(0)} label=${tracker.label || 'cleared'}`);
  }
}

{
  const wall = new WallProbe(180, 40);
  const tracker = new StuckTracker();
  const personality = { ...NEUTRAL_PERSONALITY };
  const kit = kitProfileOf('shadow', 'frontliner', 145);
  let escaped = false;
  let x = 190;
  let y = 200;
  for (let step = 0; step < 24; step += 1) {
    const now = step * 50;
    const desired = { x: 1, y: 0 };
    const steered = wall.steer(x, y, 1, 0);
    const dir = tracker.filter(now, x, y, desired, steered, 180, wall, personality, kit);
    x += dir.x * 10;
    y += dir.y * 10;
    if (!wall.blocksMovement(x, y, 8)) {
      escaped = true;
      break;
    }
  }
  if (!escaped) {
    failed += 1;
    console.log(`FAIL  inside-asset escape  x=${x.toFixed(0)} y=${y.toFixed(0)}`);
  } else {
    console.log(`ok  inside-asset escape  x=${x.toFixed(0)} y=${y.toFixed(0)}`);
  }
}

{
  const tracker = new StuckTracker();
  const personality = { ...NEUTRAL_PERSONALITY };
  const desired = { x: 1, y: 0 };
  const mates = [{ x: 168, y: 200 }];
  let recovered = false;
  for (let step = 0; step < 14; step += 1) {
    const now = step * 50;
    tracker.filter(now, 150, 200, desired, { x: 1, y: 0 }, 180, undefined, personality, undefined, mates);
    if (tracker.recovering) {
      recovered = true;
      break;
    }
  }
  const early = new StuckTracker();
  early.filter(0, 150, 200, desired, { x: 1, y: 0 }, 180, undefined, personality, undefined, mates);
  early.filter(80, 150, 200, desired, { x: 1, y: 0 }, 180, undefined, personality, undefined, mates);
  if (!recovered || early.recovering) {
    failed += 1;
    console.log(`FAIL  mate deadlock  recovered=${recovered} early=${early.recovering}`);
  } else {
    console.log('ok  mate deadlock  recovery after a stall, not on contact');
  }
}

{
  const wall = new WallProbe(180, 40);
  const tracker = new StuckTracker();
  const personality = { ...NEUTRAL_PERSONALITY };
  const kit = kitProfileOf('shadow', 'frontliner', 145);
  let earlyDash = false;
  let lateDash = false;
  for (let step = 0; step < 16; step += 1) {
    const now = step * 50;
    tracker.filter(now, 150, 200, { x: 1, y: 0 }, { x: 0, y: 0 }, 180, wall, personality, kit);
    const escape = tracker.dashEscape(now);
    if (escape && now < 520) {
      earlyDash = true;
    }
    if (escape && now >= 520) {
      lateDash = true;
    }
  }
  if (earlyDash || !tracker.recovering || !lateDash) {
    failed += 1;
    console.log(`FAIL  dash waits  early=${earlyDash} recovering=${tracker.recovering} late=${lateDash}`);
  } else {
    console.log('ok  dash waits for a real stall');
  }
}

{
  const generated = generateFromSeed(7, false);
  const query = new MapQuery(generated.layout);
  const wall = generated.layout.obstacles.find(
    (obs) => obs.blocksMovement && obs.collision.w >= 36 && obs.collision.h >= 36,
  );
  if (!wall) {
    failed += 1;
    console.log('FAIL  live map walk  no blocking obstacle');
  } else {
    const tracker = new StuckTracker();
    const personality = { ...NEUTRAL_PERSONALITY, caution: 0.4 };
    const kit = kitProfileOf('cole', 'frontliner', 160);
    let x = wall.collision.x - 28;
    let y = wall.collision.y + wall.collision.h / 2;
    const start = { x, y };
    let flipped = 0;
    let lastSign = 0;
    for (let step = 0; step < 36; step += 1) {
      const now = step * 50;
      const steered = query.steer(x, y, 1, 0);
      const dir = tracker.filter(
        now,
        x,
        y,
        { x: 1, y: 0 },
        steered,
        170,
        query,
        personality,
        kit,
        undefined,
        'frontliner',
      );
      if (tracker.recovering) {
        const sign = Math.sign(dir.y || 0.0001);
        if (lastSign && sign !== lastSign) {
          flipped += 1;
        }
        lastSign = sign;
      }
      x += dir.x * 8.5;
      y += dir.y * 8.5;
    }
    const moved = Math.hypot(x - start.x, y - start.y);
    const slid = Math.abs(y - start.y) > 14;
    const cleared = x > wall.collision.x + wall.collision.w || x < start.x - 10;
    if (flipped > 3 || (!slid && !cleared && moved < 18)) {
      failed += 1;
      console.log(
        `FAIL  live map walk  flip=${flipped} moved=${moved.toFixed(0)} y=${(y - start.y).toFixed(0)}`,
      );
    } else {
      console.log(`ok  live map walk  slid=${(y - start.y).toFixed(0)} moved=${moved.toFixed(0)}`);
    }
  }
}

if (failed > 0) {
  throw new Error(`${failed} tactical scenario(s) failed`);
}
console.log(`\n${results.length} tactical scenarios passed`);
console.log(`${objectiveChecks.length} objective checks passed`);
console.log(`${warScoreChecks.length} war score checks passed`);
console.log(`${scoreboardChecks.length} scoreboard checks passed`);
console.log(`${feedbackChecks.length} combat feedback checks passed`);
console.log(`${draftChecks.length} draft checks passed`);
console.log(`${mapChecks.length} map checks passed`);
