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
