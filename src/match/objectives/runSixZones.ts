import { ARENA, applyMatchFormat, sixArenaSize } from '../../config/arena';
import {
  nextObjectiveKind,
  nextObjectiveKindFor,
  OBJECTIVE,
  objectiveKindsFor,
  type ObjectiveKind,
} from '../../config/objective';
import { SIX_ZONE_SCORE, WAR_SCORE } from '../../config/score';
import { SeededRNG } from '../../map/seed';
import { ScoreManager } from '../ScoreManager';
import {
  freshSixZone,
  pickSixZoneSite,
  stepSixZone,
  zoneCaptureSource,
  zoneCountdownSec,
  zoneStatusLabel,
  type SixZoneEvent,
  type SixZoneModel,
  type ZoneSiteQuery,
} from './sixZoneLogic';
import type { CaptureOccupancy } from './captureLogic';

export type SixCheck = { name: string; ok: boolean; detail: string };

const check = (name: string, ok: boolean, detail: string): SixCheck => ({ name, ok, detail });

const count = (events: readonly SixZoneEvent[], type: SixZoneEvent['type'], team?: 'alpha' | 'bravo'): number =>
  events.filter((event) => event.type === type && (team === undefined || ('team' in event && event.team === team))).length;

const pump = (
  model: SixZoneModel,
  ms: number,
  occupancy: CaptureOccupancy,
  scoring = true,
  step = 1000,
): { model: SixZoneModel; events: SixZoneEvent[] } => {
  const events: SixZoneEvent[] = [];
  let current = model;
  let left = ms;
  while (left > 0) {
    const dt = Math.min(step, left);
    const next = stepSixZone(current, dt, occupancy, scoring);
    current = next.model;
    events.push(...next.events);
    left -= dt;
  }
  return { model: current, events };
};

const applyScore = (
  score: ScoreManager,
  events: readonly SixZoneEvent[],
  id: string,
  generation: number,
  serial: { n: number },
): void => {
  for (const event of events) {
    if (event.type === 'capture') {
      serial.n += 1;
      score.addTeamScore(event.team, SIX_ZONE_SCORE.capture, 'zone_capture', 0, zoneCaptureSource(id, generation, serial.n));
    } else if (event.type === 'hold') {
      score.addOngoingScore(event.team, SIX_ZONE_SCORE.holdPerSecond, 'zone_hold', 0);
    }
  }
};

const arenaChecks = (): SixCheck[] => {
  applyMatchFormat('3v3');
  const three =
    ARENA.width === 2584 &&
    ARENA.height === 1504 &&
    ARENA.laneY.top === 294 &&
    ARENA.laneY.mid === 752 &&
    ARENA.laneY.bottom === 1210 &&
    ARENA.teamSpawnX.alpha === 258 &&
    ARENA.teamSpawnX.bravo === 2326 &&
    ARENA.minionSpawnX.alpha === 470 &&
    ARENA.minionSpawnX.bravo === 2114;
  applyMatchFormat('6v6');
  const grownW = Math.round(Math.round(2584 * 1.65) * 1.15);
  const grownH = Math.round(Math.round(1504 * 1.65) * 1.15);
  const size = sixArenaSize();
  const laneTop = Math.round(Math.round(294 * 1.65) * 1.15);
  const bravoInset = Math.round(Math.round((2584 - 2326) * 1.65) * 1.15);
  const minionInset = Math.round(Math.round((2584 - 2114) * 1.65) * 1.15);
  const six =
    ARENA.width === grownW &&
    ARENA.height === grownH &&
    ARENA.width === size.width &&
    ARENA.height === size.height &&
    ARENA.width === 4904 &&
    ARENA.height === 2854 &&
    ARENA.laneY.top === laneTop &&
    ARENA.teamSpawnX.alpha === Math.round(Math.round(258 * 1.65) * 1.15) &&
    ARENA.teamSpawnX.bravo === ARENA.width - bravoInset &&
    ARENA.minionSpawnX.bravo === ARENA.width - minionInset;
  applyMatchFormat('3v3');
  const restored = ARENA.width === 2584 && ARENA.height === 1504;
  return [
    check('3v3 arena unchanged', three && restored, `w=${ARENA.width} h=${ARENA.height}`),
    check('6v6 arena is 15% over the previous 6v6 field', six, `${size.width}x${size.height}`),
  ];
};

const rotationChecks = (): SixCheck[] => {
  let consumed = false;
  const opening = nextObjectiveKindFor('3v3', [], () => {
    consumed = true;
    return 0;
  });
  const fairRng = [0.1, 0.4];
  let i = 0;
  const read = (): number => fairRng[i++] ?? 0;
  const viaFormat = nextObjectiveKindFor('3v3', ['capture_zone', 'golden_piggy'], read);
  i = 0;
  const viaLegacy = nextObjectiveKind(['capture_zone', 'golden_piggy'], read);
  const kinds = objectiveKindsFor('6v6');
  const picks: ObjectiveKind[] = [];
  const roll = (): number => (picks.length % 7) / 7;
  for (let n = 0; n < 28; n += 1) {
    picks.push(nextObjectiveKindFor('6v6', picks.slice(-2), roll));
  }
  const noCapture = kinds.length === OBJECTIVE.kinds.length - 1 && !kinds.includes('capture_zone') && picks.every((kind) => kind !== 'capture_zone');
  const stillThere = objectiveKindsFor('3v3').includes('capture_zone') && OBJECTIVE.kinds[0] === 'capture_zone';
  return [
    check('3v3 opening capture is unchanged', opening === 'capture_zone' && !consumed && viaFormat === viaLegacy, `${opening} fair=${viaFormat}`),
    check('6v6 rotation never spawns capture zone', noCapture && stillThere, picks.slice(0, 6).join(',')),
  ];
};

const lifeChecks = (): SixCheck[] => {
  const idle = stepSixZone(freshSixZone(0, 0), 60_000, { alpha: 0, bravo: 0 }, true);
  const expired =
    idle.model.phase === 'cooldown' &&
    idle.model.leftMs === SIX_ZONE_SCORE.cooldownMs &&
    idle.model.secured === null &&
    count(idle.events, 'cooldown') === 1 &&
    count(idle.events, 'capture') === 0 &&
    count(idle.events, 'hold') === 0;
  const cooling = stepSixZone(idle.model, 1_000, { alpha: 1, bravo: 0 }, true);
  const quiet = cooling.events.length === 0 && cooling.model.leftMs === 14_000 && cooling.model.phase === 'cooldown';
  const label = zoneStatusLabel(cooling.model, false) === 'RESPAWNING 14' && zoneCountdownSec(60_000) === 60;
  const back = stepSixZone(cooling.model, 14_000, { alpha: 1, bravo: 1 }, true);
  const respawned = count(back.events, 'respawn') === 1 && count(back.events, 'capture') === 0 && back.model.phase === 'active';
  const frozen = freshSixZone(3, 4);
  const paused = stepSixZone(frozen, 5_000, { alpha: 1, bravo: 0 }, false);
  const held = paused.model === frozen && paused.events.length === 0;
  const other = freshSixZone(8, 9);
  const moved = stepSixZone(other, 1_000, { alpha: 0, bravo: 0 }, true);
  const independent = frozen.leftMs === 60_000 && moved.model.leftMs === 59_000;
  return [
    check('zone lasts 60s then cools down for 15s', expired && quiet && label && respawned, `cool=${idle.model.leftMs} label=${zoneStatusLabel(cooling.model, false)}`),
    check('cooldown and pause award nothing', held && independent, `pausedEvents=${paused.events.length}`),
  ];
};

const scoreChecks = (): SixCheck[] => {
  const serial = { n: 0 };
  const score = new ScoreManager(() => true);
  let model = freshSixZone(0, 0);
  const captured = pump(model, 20_000, { alpha: 1, bravo: 0 });
  model = captured.model;
  applyScore(score, captured.events, 'A', 1, serial);
  const once = count(captured.events, 'capture', 'alpha') === 1 && count(captured.events, 'hold') === 0 && model.secured === 'alpha';
  const held = pump(model, 10_000, { alpha: 1, bravo: 0 });
  model = held.model;
  applyScore(score, held.events, 'A', 1, serial);
  const ten = count(held.events, 'hold', 'alpha') === 10 && count(held.events, 'capture') === 0;
  const fight = pump(model, 5_000, { alpha: 1, bravo: 1 });
  model = fight.model;
  applyScore(score, fight.events, 'A', 1, serial);
  const paused = count(fight.events, 'hold') === 0 && model.secured === 'alpha' && zoneStatusLabel(model, true) === `PAUSED ${zoneCountdownSec(model.leftMs)}`;
  const again = pump(model, 4_000, { alpha: 1, bravo: 0 });
  applyScore(score, again.events, 'A', 1, serial);
  const noSecond = count(again.events, 'capture') === 0 && count(again.events, 'hold', 'alpha') === 4;
  const before = score.kills.alpha;
  score.addTeamScore('alpha', 50, 'zone_capture', 1, zoneCaptureSource('A', 1, serial.n));
  const deduped = score.kills.alpha === before;
  const total = score.kills.alpha === 50 + 10 + 4 && score.objectives.alpha === 1;
  const tel = score.telemetry(60_000);
  const reasons = tel.byReason.zone_capture.alpha === 50 && tel.byReason.zone_hold.alpha === 14;
  score.lock();
  const locked = score.addOngoingScore('alpha', 1, 'zone_hold', 2) === 0 && score.kills.alpha === 64;
  const classic = new ScoreManager(() => true);
  const old = classic.awardObjective('alpha', 'capture_zone', 3) === WAR_SCORE.capture && WAR_SCORE.capture === 100;
  return [
    check('capture pays +50 once and hold pays +1/s', once && ten && paused && noSecond && deduped && total && reasons && locked, `score=${score.kills.alpha} holds=${count(held.events, 'hold')}`),
    check('3v3 capture reward amount stays 100', old, `awarded=${classic.kills.alpha}`),
  ];
};

const ownerChecks = (): SixCheck[] => {
  let model = pump(freshSixZone(0, 0), 20_000, { alpha: 1, bravo: 0 }).model;
  model = { ...model, leftMs: 60_000 };
  const left = pump(model, 6_000, { alpha: 0, bravo: 0 });
  model = left.model;
  const decayed = pump(model, 8_000, { alpha: 0, bravo: 0 });
  model = decayed.model;
  const refilled = pump(model, 12_000, { alpha: 1, bravo: 0 });
  const sameTeam = count(refilled.events, 'capture') === 0 && model.snap.progress > 0 && model.snap.progress < 1 && refilled.model.secured === 'alpha';
  const emptied = pump(refilled.model, 30_000, { alpha: 0, bravo: 0 });
  const neutral = emptied.model.secured === null && emptied.model.snap.progress === 0 && emptied.model.phase === 'active';
  const retake = pump({ ...emptied.model, leftMs: 60_000 }, 20_000, { alpha: 1, bravo: 0 });
  const paidAgain = count(retake.events, 'capture', 'alpha') === 1;
  let bravo = pump(freshSixZone(1, 1), 20_000, { alpha: 1, bravo: 0 }).model;
  bravo = { ...bravo, leftMs: 60_000 };
  const contested = pump(bravo, 1_000, { alpha: 1, bravo: 1 });
  bravo = contested.model;
  const stolen = pump(bravo, 50_000, { alpha: 0, bravo: 1 });
  const captureAt = stolen.events.findIndex((event) => event.type === 'capture' && event.team === 'bravo');
  const beforeTake = stolen.events.slice(0, Math.max(0, captureAt));
  const afterTake = stolen.events.slice(captureAt + 1);
  const switched =
    count(contested.events, 'hold') === 0 &&
    count(stolen.events, 'capture', 'bravo') === 1 &&
    count(stolen.events, 'capture', 'alpha') === 0 &&
    stolen.model.secured === 'bravo' &&
    !beforeTake.some((event) => event.type === 'hold' && event.team === 'bravo') &&
    !afterTake.some((event) => event.type === 'hold' && event.team === 'alpha') &&
    afterTake.some((event) => event.type === 'hold' && event.team === 'bravo');
  return [
    check('same team recapture from a partial decay is not a new +50', sameTeam && neutral && paidAgain, `progress=${model.snap.progress.toFixed(2)} again=${paidAgain}`),
    check('the other team can take the zone', switched, `bravoCaptures=${count(stolen.events, 'capture', 'bravo')} holds=${count(stolen.events, 'hold', 'bravo')}`),
  ];
};

const siteQuery = (): ZoneSiteQuery => ({
  playable: { x: 40, y: 40, w: 4800, h: 2700 },
  spawns: [
    { x: 280, y: 500, radius: 150 },
    { x: 280, y: 1400, radius: 150 },
    { x: 280, y: 2300, radius: 150 },
    { x: 4500, y: 500, radius: 150 },
    { x: 4500, y: 1400, radius: 150 },
    { x: 4500, y: 2300, radius: 150 },
  ],
  blocked: (x, y) => Math.abs(x - 2400) < 70 || (x > 1800 && x < 2100 && y > 1200 && y < 1600),
});

const separated = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

const siteChecks = (): SixCheck[] => {
  const query = siteQuery();
  const radius = OBJECTIVE.capture.radius;
  const minSep = Math.max(radius * 2.6, 520);
  const pick = (seed: number) => {
    const rng = new SeededRNG(seed);
    const next = (): number => rng.next();
    const a = pickSixZoneSite(query, next, radius * 0.18, radius, []);
    const b = pickSixZoneSite(query, next, radius * 0.18, radius, [a]);
    return { a, b };
  };
  const first = pick(1001);
  const again = pick(1001);
  const other = pick(4242);
  const away = (site: { x: number; y: number }): boolean =>
    query.spawns.every((spawn) => separated(site, spawn) >= spawn.radius + 260) &&
    !query.blocked(site.x, site.y, radius * 0.18) &&
    site.x > query.playable.x + 70 &&
    site.y > query.playable.y + 70 &&
    site.x < query.playable.x + query.playable.w - 70 &&
    site.y < query.playable.y + query.playable.h - 70;
  const pairOk = away(first.a) && away(first.b) && separated(first.a, first.b) >= minSep;
  const stable = first.a.x === again.a.x && first.a.y === again.a.y && first.b.x === again.b.x && first.b.y === again.b.y;
  const differs = first.a.x !== other.a.x || first.a.y !== other.a.y || first.b.x !== other.b.x || first.b.y !== other.b.y;
  const rng = new SeededRNG(77);
  const moved = pickSixZoneSite(query, () => rng.next(), radius * 0.18, radius, [first.a, first.b]);
  const relocated = separated(moved, first.a) >= minSep && separated(moved, first.b) >= minSep && away(moved);
  return [
    check('zones spawn apart from spawns and each other', pairOk && stable && differs, `sep=${separated(first.a, first.b).toFixed(0)}`),
    check('respawn chooses a different valid site', relocated, `${moved.x.toFixed(0)},${moved.y.toFixed(0)}`),
  ];
};

export const runSixZoneChecks = (): SixCheck[] => [
  ...arenaChecks(),
  ...rotationChecks(),
  ...lifeChecks(),
  ...scoreChecks(),
  ...ownerChecks(),
  ...siteChecks(),
];

const argv1 = (globalThis as { process?: { argv?: string[] } }).process?.argv?.[1];
if (import.meta.url.includes('runSixZones') && argv1?.includes('runSixZones')) {
  let failed = 0;
  for (const result of runSixZoneChecks()) {
    if (!result.ok) {
      failed += 1;
    }
    console.log(`${result.ok ? 'ok' : 'FAIL'}  ${result.name}  ${result.detail}`);
  }
  if (failed > 0) {
    throw new Error(`${failed} 6v6 zone check(s) failed`);
  }
}
