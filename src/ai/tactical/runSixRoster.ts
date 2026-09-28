import { applyMatchFormat } from '../../config/arena';
import { clearSixZoneFacts, setSixZoneFacts, type SixZoneFact } from '../../match/objectives/sixZoneBoard';
import { applySixRoster, chooseSixRole, clearSixIntents, sixShouldReconsider, type SixBody, type SixIntentPost } from './sixRoster';
import { NEUTRAL_PERSONALITY, type Personality, type ScoredAction, type Situation } from './types';

export type SixAiCheck = { name: string; ok: boolean; detail: string };

const check = (name: string, ok: boolean, detail: string): SixAiCheck => ({ name, ok, detail });

const hero = (id: number, x: number, y: number, team: 'alpha' | 'bravo', extra: Partial<SixBody> = {}): SixBody => ({
  id,
  x,
  y,
  team,
  kind: 'hero',
  role: 'frontliner',
  heroId: 'cole',
  hpRatio: 0.8,
  attackRange: 70,
  visible: true,
  level: 2,
  xpRatio: 0.3,
  ...extra,
});

const zone = (id: 'A' | 'B', x: number, y: number, extra: Partial<SixZoneFact> = {}): SixZoneFact => ({
  id,
  x,
  y,
  radius: 90,
  phase: 'active',
  owner: null,
  secured: null,
  progress: 0,
  contested: false,
  leftMs: 60_000,
  ...extra,
});

const personality = (extra: Partial<Personality>): Personality => ({ ...NEUTRAL_PERSONALITY, ...extra });

const fightAt = (ox: number, oy: number, allies: number, enemies: number): { allies: SixBody[]; enemies: SixBody[] } => {
  const ally: SixBody[] = [];
  const enemy: SixBody[] = [];
  for (let i = 0; i < allies; i += 1) {
    ally.push(hero(100 + i, ox + (i % 3) * 28, oy + Math.floor(i / 3) * 28, 'alpha'));
  }
  for (let i = 0; i < enemies; i += 1) {
    enemy.push(hero(200 + i, ox + 40 + (i % 3) * 28, oy + 10, 'bravo', { hpRatio: 0.7 }));
  }
  return { allies: ally, enemies: enemy };
};

const scenarioHandledFightLeavesZone = (): SixAiCheck => {
  const blob = fightAt(400, 400, 4, 4);
  const self = hero(1, 1800, 1500, 'alpha', { heroId: 'mender', role: 'support', stance: 'support' });
  const choice = chooseSixRole({
    self,
    allies: blob.allies,
    enemies: blob.enemies,
    zones: [zone('A', 400, 400), zone('B', 1900, 1500)],
    personality: personality({ opportunism: 0.7, independence: 0.7, caution: 0.6 }),
  });
  const ok = choice.zoneId === 'B' && choice.job !== 'fight' && choice.fightHandled;
  return check('4v4 fight sends a free hero to the empty zone', ok, choice.debug);
};

const scenarioFiveOnTwo = (): SixAiCheck => {
  const blob = fightAt(500, 500, 5, 2);
  const self = hero(9, 2000, 1600, 'alpha');
  const choice = chooseSixRole({
    self,
    allies: blob.allies,
    enemies: blob.enemies,
    zones: [zone('A', 520, 520, { secured: 'alpha' }), zone('B', 2100, 1600)],
    crate: { x: 1900, y: 1500 },
    personality: personality({ independence: 0.66, opportunism: 0.6 }),
  });
  const ok = choice.job !== 'fight' && (choice.zoneId === 'B' || choice.job === 'farm' || choice.job === 'rotate' || choice.job === 'flank');
  return check('sixth hero skips a 5v2', ok, choice.debug);
};

const scenarioStopCapture = (): SixAiCheck => {
  const self = hero(3, 300, 300, 'alpha');
  const chaser = hero(201, 2400, 2000, 'bravo', { hpRatio: 0.9, vx: 0, vy: 0 });
  const captor = hero(202, 1680, 1480, 'bravo', { vx: 0, vy: 0 });
  const choice = chooseSixRole({
    self,
    allies: [],
    enemies: [chaser, captor],
    zones: [
      zone('A', 2400, 2000),
      zone('B', 1700, 1500, { owner: 'bravo', progress: 0.62 }),
    ],
  });
  const ok = choice.zoneId === 'B' && (choice.job === 'contest' || choice.job === 'rotate') && choice.score > choice.combat;
  return check('enemy capture pulls a hero off a far chase', ok, `${choice.debug} combat=${choice.combat.toFixed(0)}`);
};

const scenarioSplitZones = (): SixAiCheck => {
  const zones = [zone('A', 600, 800), zone('B', 2200, 800)];
  const jobs: string[] = [];
  const intents: SixIntentPost[] = [];
  const allies: SixBody[] = [];
  for (let i = 0; i < 6; i += 1) {
    const self = hero(i + 1, 1400, 800 + i * 10, 'alpha', { heroId: i % 2 === 0 ? 'cole' : 'witch', role: i % 2 === 0 ? 'frontliner' : 'ranged', stance: i % 2 === 0 ? 'melee' : 'ranged' });
    const choice = chooseSixRole({ self, allies: allies.slice(), enemies: [], zones, intents: intents.slice() });
    jobs.push(`${choice.job}:${choice.zoneId ?? '-'}`);
    if (choice.zoneId) {
      intents.push({ id: self.id, job: choice.job === 'rotate' ? 'capture' : choice.job, zoneId: choice.zoneId, at: 0 });
      allies.push(hero(self.id, choice.zoneId === 'A' ? 600 : 2200, 800, 'alpha'));
    }
  }
  const onA = jobs.filter((job) => job.endsWith(':A')).length;
  const onB = jobs.filter((job) => job.endsWith(':B')).length;
  const ok = onA >= 1 && onB >= 1 && onA < 6 && onB < 6;
  return check('open zones split the six', ok, jobs.join(' '));
};

const scenarioDefendSpread = (): SixAiCheck => {
  const self = hero(4, 900, 900, 'alpha', { role: 'ranged', stance: 'ranged', heroId: 'witch' });
  const inside = hero(5, 1020, 1000, 'alpha');
  const choice = chooseSixRole({
    self,
    allies: [inside],
    enemies: [],
    zones: [zone('A', 1000, 1000, { secured: 'alpha', owner: 'alpha', progress: 1 }), zone('B', 2400, 400, { secured: 'bravo' })],
  });
  const spread = choice.zoneId === 'A' ? choice.stand !== 'inside' : choice.zoneId === 'B' || choice.job === 'capture' || choice.job === 'rotate';
  const ok = spread && choice.stand !== 'inside';
  return check('a held zone is guarded off the pin, not stacked', ok, `${choice.job} ${choice.zoneId ?? ''} ${choice.stand}`);
};

const scenarioCrateDuringFight = (): SixAiCheck => {
  const blob = fightAt(300, 300, 4, 3);
  const self = hero(8, 700, 360, 'alpha', { level: 2, xpRatio: 0.4, heroId: 'ninja', role: 'assassin', stance: 'skirmish' });
  const choice = chooseSixRole({
    self,
    allies: blob.allies,
    enemies: blob.enemies,
    zones: [zone('A', 300, 300, { secured: 'alpha', owner: 'alpha', progress: 1 }), zone('B', 2200, 1800, { secured: 'alpha' })],
    crate: { x: 760, y: 400 },
    personality: personality({ opportunism: 0.72, independence: 0.7 }),
  });
  const ok = choice.job === 'farm' && choice.farm > 18;
  return check('a spare hero farms a crate beside a staffed fight', ok, choice.debug);
};

const scenarioLowLevelCrate = (): SixAiCheck => {
  const self = hero(11, 500, 500, 'alpha', { level: 1, xpRatio: 0.82 });
  const choice = chooseSixRole({
    self,
    allies: [hero(12, 1400, 1400, 'alpha')],
    enemies: [],
    zones: [zone('A', 1800, 1800, { secured: 'alpha' }), zone('B', 2200, 400, { secured: 'alpha' })],
    crate: { x: 560, y: 540 },
    personality: personality({ caution: 0.7, opportunism: 0.66 }),
  });
  const ok = choice.job === 'farm' && choice.farm > 40;
  return check('a low-level hero values a safe crate', ok, `${choice.debug} farm=${choice.farm.toFixed(0)}`);
};

const scenarioCrateLosesToDefense = (): SixAiCheck => {
  const self = hero(13, 1000, 1000, 'alpha', { level: 1, xpRatio: 0.9 });
  const captor = hero(210, 1280, 1000, 'bravo', { vx: -40, vy: 0 });
  const choice = chooseSixRole({
    self,
    allies: [],
    enemies: [captor],
    zones: [zone('A', 1500, 1000, { owner: 'bravo', progress: 0.7 }), zone('B', 2400, 2000, { secured: 'alpha' })],
    crate: { x: 1040, y: 1040 },
    personality: personality({ opportunism: 0.8 }),
  });
  const ok = choice.job !== 'farm' && choice.zoneId === 'A';
  return check('critical defense outranks a crate', ok, choice.debug);
};

const scenarioIsolatedKill = (): SixAiCheck => {
  const self = hero(14, 800, 800, 'alpha', { role: 'frontliner', heroId: 'cole', stance: 'melee' });
  const isolated = hero(220, 900, 860, 'bravo', { hpRatio: 0.28 });
  const choice = chooseSixRole({
    self,
    allies: [hero(15, 400, 400, 'alpha'), hero(16, 2100, 1600, 'alpha')],
    enemies: [isolated],
    zones: [zone('A', 400, 400, { secured: 'alpha' }), zone('B', 2100, 1600, { secured: 'alpha' })],
    personality: personality({ aggression: 0.8, opportunism: 0.4, independence: 0.3 }),
  });
  const ok = choice.job === 'fight' && choice.combat > (choice.score === choice.combat ? 20 : choice.score);
  return check('an isolated low target is still worth fighting', ok, choice.debug);
};

const scenarioGiantFight = (): SixAiCheck => {
  const blob = fightAt(900, 900, 3, 3);
  const zones = [zone('A', 400, 400), zone('B', 2000, 1700)];
  const jobs: string[] = [];
  const intents: SixIntentPost[] = [];
  const allies = blob.allies.slice();
  const extras = [
    hero(31, 860, 860, 'alpha', { role: 'frontliner' }),
    hero(32, 1500, 900, 'alpha', { role: 'ranged', stance: 'ranged', heroId: 'witch' }),
    hero(33, 1700, 1600, 'alpha', { heroId: 'ninja', stance: 'skirmish', role: 'assassin' }),
  ];
  for (const self of extras) {
    const choice = chooseSixRole({
      self,
      allies,
      enemies: blob.enemies,
      zones,
      intents,
      personality: personality({ independence: self.id === 33 ? 0.8 : 0.45, opportunism: 0.55, flankTendency: self.id === 33 ? 0.8 : 0.4 }),
    });
    jobs.push(choice.job);
    intents.push({ id: self.id, job: choice.job, zoneId: choice.zoneId, at: 0 });
    if (choice.job === 'fight' || choice.job === 'contest') {
      allies.push(self);
    }
  }
  const fighters = jobs.filter((job) => job === 'fight').length;
  const ok = fighters < jobs.length && jobs.some((job) => job !== 'fight');
  return check('a giant fight does not take every remaining hero', ok, jobs.join(','));
};

const scenarioThreeRosterStaysPut = (): SixAiCheck => {
  applyMatchFormat('3v3');
  clearSixZoneFacts();
  clearSixIntents();
  const situation = {
    kind: 'hero',
    self: { kind: 'hero', id: 1, team: 'alpha', x: 0, y: 0 },
    sixPlan: { job: 'capture', stand: 'inside', x: 1, y: 1, radius: 90, debug: 'stale' },
  } as Situation;
  const rows: ScoredAction[] = [];
  let wrote = 0;
  const count = applySixRoster(rows, 0, situation, (out, n) => {
    wrote += 1;
    out[n] = { action: 'contest_objective', score: 80, reason: 'should not', targetId: -1, allyId: -1 };
    return n + 1;
  });
  const quiet = count === 0 && wrote === 0 && situation.sixPlan === undefined;
  applyMatchFormat('6v6');
  setSixZoneFacts([zone('A', 400, 400), zone('B', 1600, 400)]);
  const live = {
    kind: 'hero',
    self: hero(2, 420, 400, 'alpha'),
    allies: [],
    enemies: [],
    personality: NEUTRAL_PERSONALITY,
    now: 0,
  } as unknown as Situation;
  const sixRows: ScoredAction[] = [];
  const sixCount = applySixRoster(sixRows, 0, live, (out, n, action, score, reason) => {
    out[n] = { action, score, reason, targetId: -1, allyId: -1 };
    return n + 1;
  });
  clearSixZoneFacts();
  clearSixIntents();
  applyMatchFormat('3v3');
  const armed = sixCount === 1 && sixRows[0]?.action === 'contest_objective';
  return check('3v3 scoring skips the roster and 6v6 writes a zone row', quiet && armed, `3v3=${count} 6v6=${sixCount} ${sixRows[0]?.reason ?? ''}`);
};

const scenarioFreeZone = (): SixAiCheck => {
  const blob = fightAt(400, 400, 3, 3);
  const self = hero(40, 1500, 900, 'alpha');
  const choice = chooseSixRole({
    self,
    allies: blob.allies,
    enemies: blob.enemies,
    zones: [zone('A', 400, 400), zone('B', 1620, 900)],
  });
  const ok = choice.zoneId === 'B' && choice.job === 'capture' && choice.state === 'free' && choice.debug.includes('FREE ZONE B') && choice.debug.includes('DECISION: CAPTURE B');
  return check('an empty zone with nobody committed is taken', ok, choice.debug.replaceAll('\n', ' | '));
};

const scenarioFreeBeatsDistantEnemy = (): SixAiCheck => {
  const self = hero(41, 500, 500, 'alpha');
  const choice = chooseSixRole({
    self,
    allies: [hero(42, 1900, 1500, 'alpha')],
    enemies: [hero(241, 2000, 1600, 'bravo')],
    zones: [zone('A', 2100, 1700, { secured: 'alpha' }), zone('B', 560, 620)],
  });
  const ok = choice.zoneId === 'B' && choice.job === 'capture' && choice.score > choice.combat && choice.dist < 200;
  return check('a zone 150px away beats an enemy across the map', ok, choice.debug.replaceAll('\n', ' | '));
};

const scenarioOneCapturer = (): SixAiCheck => {
  const zones = [zone('A', 400, 400, { secured: 'alpha' }), zone('B', 1800, 900)];
  const intents: SixIntentPost[] = [{ id: 1, job: 'capture', zoneId: 'B', at: 0 }];
  const capturer = hero(1, 1800, 900, 'alpha');
  const jobs: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const self = hero(50 + i, 900 + i * 40, 1400, 'alpha');
    const choice = chooseSixRole({
      self,
      allies: [capturer],
      enemies: [hero(260, 300, 300, 'bravo')],
      zones,
      intents,
    });
    jobs.push(`${choice.job}:${choice.zoneId ?? '-'}`);
  }
  const onB = jobs.filter((job) => job.endsWith(':B')).length;
  return check('a safe capturer does not pull the rest of the team', onB === 0, jobs.join(' '));
};

const scenarioThreatenedHelp = (): SixAiCheck => {
  const capturer = hero(1, 1600, 1000, 'alpha');
  const e1 = hero(270, 1900, 1000, 'bravo', { vx: -80, vy: 0 });
  const e2 = hero(271, 1880, 1120, 'bravo', { vx: -70, vy: -20 });
  const local = hero(272, 280, 260, 'bravo', { hpRatio: 0.3 });
  const zones = [zone('A', 200, 200, { secured: 'alpha' }), zone('B', 1600, 1000, { owner: 'alpha', progress: 0.35 })];
  const intents: SixIntentPost[] = [{ id: 1, job: 'capture', zoneId: 'B', at: 0 }];
  const selves = [hero(60, 1300, 1000, 'alpha'), hero(61, 1100, 1300, 'alpha'), hero(62, 200, 240, 'alpha')];
  const choices = selves.map((self, index) =>
    chooseSixRole({
      self,
      allies: [capturer],
      enemies: index === 2 ? [e1, e2, local] : [e1, e2],
      zones,
      intents,
    }),
  );
  const helpers = choices.filter((choice) => choice.zoneId === 'B').length;
  const ok = helpers >= 1 && helpers < 3 && choices[2].zoneId !== 'B';
  return check('an approached capture pulls one teammate, not the far hero', ok, choices.map((choice) => `${choice.job}:${choice.zoneId ?? '-'}`).join(' '));
};

const scenarioLosingCapture = (): SixAiCheck => {
  const capturer = hero(1, 1500, 1000, 'alpha', { hpRatio: 0.42 });
  const enemies = [0, 1, 2].map((i) => hero(280 + i, 1520 + i * 18, 1010, 'bravo'));
  const selves = [hero(70, 1100, 1000, 'alpha'), hero(71, 1200, 1280, 'alpha'), hero(72, 980, 860, 'alpha')];
  const choices = selves.map((self) =>
    chooseSixRole({
      self,
      allies: [capturer],
      enemies,
      zones: [zone('A', 300, 300), zone('B', 1500, 1000, { owner: 'alpha', progress: 0.4 })],
    }),
  );
  const helpers = choices.filter((choice) => choice.zoneId === 'B').length;
  return check('an outnumbered capture becomes a team priority', helpers >= 2, choices.map((choice) => `${choice.job}:${choice.zoneId ?? '-'} ${choice.state}`).join(' '));
};

const scenarioFiveOnOneFreeZone = (): SixAiCheck => {
  const blob = fightAt(400, 400, 5, 1);
  const self = hero(80, 1700, 1200, 'alpha');
  const choice = chooseSixRole({
    self,
    allies: blob.allies,
    enemies: blob.enemies,
    zones: [zone('A', 420, 420, { secured: 'alpha' }), zone('B', 1820, 1200)],
  });
  const ok = choice.zoneId === 'B' && choice.job === 'capture';
  return check('a 5v1 does not get a sixth body while a zone is free', ok, choice.debug.replaceAll('\n', ' | '));
};

const scenarioEmergencyAndFree = (): SixAiCheck => {
  const captor = hero(290, 500, 500, 'bravo');
  const zones = [zone('A', 500, 500, { owner: 'bravo', progress: 0.55 }), zone('B', 1800, 500)];
  const nearA = hero(90, 700, 520, 'alpha');
  const nearB = hero(91, 1660, 520, 'alpha');
  const stop = chooseSixRole({ self: nearA, allies: [], enemies: [captor], zones });
  const take = chooseSixRole({ self: nearB, allies: [nearA], enemies: [captor], zones });
  const ok = stop.zoneId === 'A' && (stop.job === 'contest' || stop.job === 'rotate') && take.zoneId === 'B' && take.job === 'capture';
  return check('one hero stops the enemy zone while another takes the free zone', ok, `${stop.job}:${stop.zoneId} ${take.job}:${take.zoneId}`);
};

const scenarioZoneBeatsCrate = (): SixAiCheck => {
  const self = hero(95, 800, 800, 'alpha', { level: 1, xpRatio: 0.85 });
  const open = chooseSixRole({
    self,
    allies: [],
    enemies: [],
    zones: [zone('A', 2100, 1800, { secured: 'alpha' }), zone('B', 900, 860)],
    crate: { x: 760, y: 820 },
    personality: personality({ caution: 0.7, opportunism: 0.8 }),
  });
  const claimed = chooseSixRole({
    self,
    allies: [hero(96, 900, 860, 'alpha')],
    enemies: [],
    zones: [zone('A', 2100, 1800, { secured: 'alpha' }), zone('B', 900, 860)],
    crate: { x: 760, y: 820 },
    intents: [{ id: 96, job: 'capture', zoneId: 'B', at: 0 }],
    personality: personality({ caution: 0.7, opportunism: 0.8 }),
  });
  const ok = open.zoneId === 'B' && open.job === 'capture' && open.score > open.farm && claimed.job === 'farm';
  return check('a free zone beats a nearby crate until someone is already capturing', ok, `${open.job}:${open.zoneId} farm=${open.farm.toFixed(0)} then ${claimed.job}`);
};

const scenarioFreeClearsAttackRow = (): SixAiCheck => {
  applyMatchFormat('6v6');
  clearSixIntents();
  setSixZoneFacts([zone('B', 500, 500), zone('A', 2200, 1800, { secured: 'alpha' })]);
  const enemy = hero(300, 1800, 1500, 'bravo');
  const live = {
    kind: 'hero',
    self: hero(96, 620, 560, 'alpha'),
    allies: [hero(97, 1700, 1400, 'alpha')],
    enemies: [enemy],
    personality: NEUTRAL_PERSONALITY,
    now: 1,
  } as unknown as Situation;
  const rows: ScoredAction[] = [{ action: 'attack', score: 78, reason: 'take the fight', targetId: 300, allyId: -1 }];
  applySixRoster(rows, 1, live, (out, n, action, score, reason) => {
    out[n] = { action, score, reason, targetId: -1, allyId: -1 };
    return n + 1;
  });
  const attack = rows[0];
  const capture = rows.find((row) => row.reason.startsWith('CAPTURE'));
  clearSixZoneFacts();
  clearSixIntents();
  applyMatchFormat('3v3');
  const ok = Boolean(capture && capture.score >= (attack?.score ?? 0) + 26);
  return check('a free-zone row clears a distant attack score', ok, `attack=${attack?.score.toFixed(0)} capture=${capture?.score.toFixed(0) ?? 'none'}`);
};

const scenarioFreeReconsider = (): SixAiCheck => {
  applyMatchFormat('3v3');
  const ignored = sixShouldReconsider('chase', { x: 400, y: 400, team: 'alpha', attackRange: 70 }, [zone('B', 520, 430)]);
  applyMatchFormat('6v6');
  const pulls = sixShouldReconsider('chase', { x: 400, y: 400, team: 'alpha', attackRange: 70 }, [zone('B', 520, 430)]);
  const engaged = sixShouldReconsider(
    'attack',
    { x: 400, y: 400, team: 'alpha', attackRange: 70 },
    [zone('B', 520, 430)],
    { enemies: [hero(310, 450, 430, 'bravo')] },
  );
  applyMatchFormat('3v3');
  return check('a nearby free zone breaks a chase unless the hero is already in melee', !ignored && pulls && !engaged, `3v3=${ignored} free=${pulls} melee=${engaged}`);
};

const scenarioThreeStaysPut = (): SixAiCheck => {
  applyMatchFormat('3v3');
  const ignored = sixShouldReconsider('chase', { x: 0, y: 0, team: 'alpha' }, [
    zone('A', 100, 100, { owner: 'bravo', progress: 0.8 }),
  ]);
  applyMatchFormat('6v6');
  const pulls = sixShouldReconsider('chase', { x: 0, y: 0, team: 'alpha' }, [
    zone('A', 800, 800, { owner: 'bravo', progress: 0.8 }),
  ]);
  applyMatchFormat('3v3');
  return check('3v3 does not take the 6v6 reconsider', !ignored && pulls, `3v3=${ignored} 6v6=${pulls}`);
};

export const runSixAiChecks = (): SixAiCheck[] => [
  scenarioHandledFightLeavesZone(),
  scenarioFiveOnTwo(),
  scenarioStopCapture(),
  scenarioSplitZones(),
  scenarioDefendSpread(),
  scenarioCrateDuringFight(),
  scenarioLowLevelCrate(),
  scenarioCrateLosesToDefense(),
  scenarioIsolatedKill(),
  scenarioGiantFight(),
  scenarioFreeZone(),
  scenarioFreeBeatsDistantEnemy(),
  scenarioOneCapturer(),
  scenarioThreatenedHelp(),
  scenarioLosingCapture(),
  scenarioFiveOnOneFreeZone(),
  scenarioEmergencyAndFree(),
  scenarioZoneBeatsCrate(),
  scenarioFreeClearsAttackRow(),
  scenarioFreeReconsider(),
  scenarioThreeRosterStaysPut(),
  scenarioThreeStaysPut(),
];

const argv1 = (globalThis as { process?: { argv?: string[] } }).process?.argv?.[1];
if (import.meta.url.includes('runSixRoster') && argv1?.includes('runSixRoster')) {
  let failed = 0;
  for (const result of runSixAiChecks()) {
    if (!result.ok) {
      failed += 1;
    }
    console.log(`${result.ok ? 'ok' : 'FAIL'}  ${result.name}  ${result.detail}`);
  }
  if (failed > 0) {
    throw new Error(`${failed} 6v6 AI check(s) failed`);
  }
}
