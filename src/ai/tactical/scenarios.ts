import { NEUTRAL_PERSONALITY, type CombatantView, type ScoredAction, type Situation, type TacticalAction } from './types';
import { ensureScoreBuffer, scoreSituation } from './evaluate';
import { kitProfileOf } from './kitProfile';
import { OBJECTIVE } from '../../config/objective';

const buffer = ensureScoreBuffer();

const unit = (partial: Partial<CombatantView> & Pick<CombatantView, 'id' | 'team' | 'x' | 'y'>): CombatantView => ({
  vx: 0,
  vy: 0,
  aimX: partial.team === 'bravo' ? -1 : 1,
  aimY: 0,
  kind: 'hero',
  role: 'frontliner',
  heroId: 'cole',
  hpRatio: 1,
  staminaRatio: 1,
  attackRange: 70,
  moveSpeed: 160,
  defense: 20,
  power: 1,
  attacking: false,
  stunned: false,
  recentlyHit: false,
  canAttack: true,
  lastAttackerId: -1,
  visible: true,
  blocking: false,
  ...partial,
});

const situationOf = (
  self: CombatantView,
  allies: CombatantView[],
  enemies: CombatantView[],
  extra: Partial<Situation> = {},
): Situation => ({
  self,
  allies,
  enemies,
  currentTargetId: -1,
  kind: 'hero',
  personality: NEUTRAL_PERSONALITY,
  escapeOpen: true,
  homeX: 220,
  homeY: 750,
  vision: 540,
  ...extra,
});

export const rankActions = (situation: Situation): ScoredAction[] => {
  const count = scoreSituation(situation, buffer);
  return buffer
    .slice(0, count)
    .map((row) => ({ ...row }))
    .sort((a, b) => b.score - a.score);
};

const best = (rows: ScoredAction[]): TacticalAction => rows[0]?.action ?? 'search_for_target';

const scoreOf = (rows: ScoredAction[], action: TacticalAction, targetId?: number): number => {
  let top = -999;
  for (const row of rows) {
    if (row.action !== action) {
      continue;
    }
    if (targetId !== undefined && row.targetId !== targetId) {
      continue;
    }
    if (row.score > top) {
      top = row.score;
    }
  }
  return top;
};

const among = (rows: ScoredAction[], actions: TacticalAction[], n = 4): boolean =>
  rows.slice(0, n).some((row) => actions.includes(row.action));

export type ScenarioResult = { name: string; ok: boolean; detail: string };

const scenarioA = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 380, y: 750, hpRatio: 0.9, power: 1.1 });
  const allies = [
    unit({ id: 2, team: 'alpha', x: 470, y: 745, attacking: true, power: 1.1 }),
    unit({ id: 3, team: 'alpha', x: 475, y: 760, attacking: true, power: 1 }),
    unit({ id: 4, team: 'alpha', x: 465, y: 752, attacking: true, power: 1.05 }),
  ];
  const enemies = [unit({ id: 10, team: 'bravo', x: 500, y: 750, hpRatio: 0.2, recentlyHit: true, power: 1 })];
  const rows = rankActions(situationOf(self, allies, enemies));
  const attack = scoreOf(rows, 'attack', 10);
  const finish = scoreOf(rows, 'finish_target', 10);
  const leave = Math.max(scoreOf(rows, 'advance'), scoreOf(rows, 'search_for_target'));
  const ok = leave > attack && leave > finish && !['attack', 'finish_target', 'flank'].includes(best(rows));
  return { name: 'A overkill', ok, detail: `best=${best(rows)} leave=${leave.toFixed(1)} attack=${attack.toFixed(1)} finish=${finish.toFixed(1)}` };
};

const scenarioB = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.85 });
  const allies = [unit({ id: 2, team: 'alpha', x: 470, y: 750, hpRatio: 0.55, recentlyHit: true })];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 500, y: 742, attacking: true, lastAttackerId: 2 }),
    unit({ id: 11, team: 'bravo', x: 505, y: 760, attacking: true, lastAttackerId: 2 }),
  ];
  const rows = rankActions(situationOf(self, allies, enemies));
  const ok = among(rows, ['assist_ally', 'attack', 'protect_ally', 'intercept'], 3);
  return { name: 'B outnumbered', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioC = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 360, y: 750 });
  const allies = [
    unit({ id: 2, team: 'alpha', x: 490, y: 748, attacking: true }),
    unit({ id: 3, team: 'alpha', x: 495, y: 760, attacking: true }),
    unit({ id: 4, team: 'alpha', x: 485, y: 752, attacking: true }),
  ];
  const enemies = [unit({ id: 10, team: 'bravo', x: 510, y: 750, hpRatio: 0.08, recentlyHit: true })];
  const rows = rankActions(situationOf(self, allies, enemies));
  const leave = Math.max(scoreOf(rows, 'advance'), scoreOf(rows, 'search_for_target'));
  const pile = Math.max(scoreOf(rows, 'attack', 10), scoreOf(rows, 'finish_target', 10));
  const ok = leave > pile;
  return { name: 'C winning fight', ok, detail: `best=${best(rows)} leave=${leave.toFixed(1)} pile=${pile.toFixed(1)}` };
};

const scenarioD = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.15, staminaRatio: 0.2 });
  const enemies = [unit({ id: 10, team: 'bravo', x: 455, y: 750, hpRatio: 0.92, power: 1.2 })];
  const rows = rankActions(situationOf(self, [], enemies));
  const ok = among(rows, ['retreat', 'escape'], 2) && !['attack', 'chase', 'flank'].includes(best(rows));
  return { name: 'D low HP', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioE = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.15 });
  const enemies = [unit({ id: 10, team: 'bravo', x: 445, y: 750, hpRatio: 0.05, recentlyHit: true, power: 0.8 })];
  const rows = rankActions(situationOf(self, [], enemies, { escapeOpen: true }));
  const finish = scoreOf(rows, 'finish_target', 10);
  const retreat = Math.max(scoreOf(rows, 'retreat'), scoreOf(rows, 'escape'));
  const ok = finish > retreat - 4 && among(rows, ['finish_target', 'attack'], 2);
  return { name: 'E low HP finish', ok, detail: `best=${best(rows)} finish=${finish.toFixed(1)} retreat=${retreat.toFixed(1)}` };
};

const scenarioF = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 420, y: 690, hpRatio: 0.8 });
  const allies = [unit({ id: 2, team: 'alpha', x: 470, y: 750, attacking: true })];
  const enemies = [
    unit({
      id: 10,
      team: 'bravo',
      x: 500,
      y: 750,
      hpRatio: 0.7,
      attacking: true,
      lastAttackerId: 2,
      aimX: -1,
      aimY: 0,
    }),
  ];
  const rows = rankActions(situationOf(self, allies, enemies));
  const flank = scoreOf(rows, 'flank', 10);
  const attack = scoreOf(rows, 'attack', 10);
  const ok = flank > 0 && flank >= attack - 12;
  return { name: 'F flank', ok, detail: `best=${best(rows)} flank=${flank.toFixed(1)} attack=${attack.toFixed(1)}` };
};

const scenarioG = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 600, y: 750, hpRatio: 0.9 });
  const allies = [
    unit({ id: 2, team: 'alpha', x: 330, y: 745, attacking: true }),
    unit({ id: 3, team: 'alpha', x: 340, y: 758, attacking: true }),
    unit({ id: 4, team: 'alpha', x: 325, y: 752, attacking: true }),
    unit({ id: 5, team: 'alpha', x: 860, y: 750, hpRatio: 0.32, recentlyHit: true }),
  ];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 360, y: 750, hpRatio: 0.55, recentlyHit: true }),
    unit({ id: 11, team: 'bravo', x: 350, y: 765, hpRatio: 0.6 }),
    unit({ id: 12, team: 'bravo', x: 890, y: 742, attacking: true, lastAttackerId: 5 }),
    unit({ id: 13, team: 'bravo', x: 895, y: 760, attacking: true, lastAttackerId: 5 }),
  ];
  const rows = rankActions(situationOf(self, allies, enemies));
  const right = Math.max(scoreOf(rows, 'assist_ally', 12), scoreOf(rows, 'attack', 12), scoreOf(rows, 'protect_ally', 12));
  const left = Math.max(scoreOf(rows, 'attack', 10), scoreOf(rows, 'finish_target', 10));
  const ok = right > left;
  return { name: 'G two battles', ok, detail: `best=${best(rows)} right=${right.toFixed(1)} left=${left.toFixed(1)}` };
};

const scenarioH = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 520, y: 640, hpRatio: 0.85 });
  const allies = [
    unit({ id: 2, team: 'alpha', x: 470, y: 750, attacking: true }),
    unit({ id: 3, team: 'alpha', x: 480, y: 760, attacking: true }),
  ];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 500, y: 750, hpRatio: 0.4, recentlyHit: true }),
    unit({ id: 11, team: 'bravo', x: 620, y: 750, vx: -90, vy: 0, aimX: -1, hpRatio: 0.8 }),
  ];
  const rows = rankActions(situationOf(self, allies, enemies));
  const intercept = scoreOf(rows, 'intercept', 11);
  const pile = Math.max(scoreOf(rows, 'attack', 10), scoreOf(rows, 'finish_target', 10));
  const ok = intercept > pile || among(rows, ['intercept'], 3);
  return { name: 'H reinforcement', ok, detail: `best=${best(rows)} intercept=${intercept.toFixed(1)} pile=${pile.toFixed(1)}` };
};

const scenarioI = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.88, power: 1 });
  const enemies = [unit({ id: 10, team: 'bravo', x: 490, y: 750, hpRatio: 0.9, power: 1.02 })];
  const rows = rankActions(situationOf(self, [], enemies));
  const wait = Math.max(scoreOf(rows, 'wait_for_opening'), scoreOf(rows, 'hold_position'), scoreOf(rows, 'reposition'));
  const attack = scoreOf(rows, 'attack', 10);
  const ok = wait > 0 && wait >= attack - 8;
  return { name: 'I standoff', ok, detail: `best=${best(rows)} wait=${wait.toFixed(1)} attack=${attack.toFixed(1)}` };
};

const scenarioJ = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 900, y: 750, hpRatio: 0.7 });
  const enemies = [unit({ id: 10, team: 'bravo', x: 1400, y: 750, hpRatio: 0.55, vx: 140, vy: 0, aimX: 1 })];
  const rows = rankActions(situationOf(self, [], enemies, { currentTargetId: 10 }));
  const chase = scoreOf(rows, 'chase', 10);
  const drop = Math.max(scoreOf(rows, 'advance'), scoreOf(rows, 'search_for_target'), scoreOf(rows, 'retreat'));
  const ok = drop > chase && !['chase'].includes(best(rows));
  return { name: 'J target escapes', ok, detail: `best=${best(rows)} drop=${drop.toFixed(1)} chase=${chase.toFixed(1)}` };
};

const scenarioK = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 280, y: 750, hpRatio: 0.24 });
  const rows = rankActions(situationOf(self, [], []));
  const ok = among(rows, ['recover', 'retreat', 'search_for_target', 'advance'], 2);
  return { name: 'K recover space', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioL = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.5, role: 'tank', defense: 40, power: 1.2 });
  const enemies = [unit({ id: 10, team: 'bravo', x: 470, y: 750, hpRatio: 0.7, power: 1 })];
  const rows = rankActions(situationOf(self, [], enemies));
  const ok = !['retreat', 'escape', 'recover'].includes(best(rows));
  return { name: 'L tank holds', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioM = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 2040, y: 750, hpRatio: 0.82 });
  const rows = rankActions(situationOf(self, [], []));
  const ok = !['advance', 'push_lane'].includes(best(rows)) && among(rows, ['search_for_target', 'farm_minions', 'recover'], 2);
  return { name: 'M far edge hunt', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioN = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 2040, y: 750, hpRatio: 0.7 });
  const enemies = [unit({ id: 20, team: 'bravo', x: 1880, y: 750, kind: 'minion', role: 'minion', hpRatio: 0.8, power: 0.3, attackRange: 44 })];
  const rows = rankActions(situationOf(self, [], enemies));
  const farm = scoreOf(rows, 'farm_minions', 20);
  const advance = scoreOf(rows, 'advance');
  const ok = farm > advance && among(rows, ['farm_minions'], 2);
  return { name: 'N far edge farm', ok, detail: `best=${best(rows)} farm=${farm.toFixed(1)} advance=${advance.toFixed(1)}` };
};

const scenarioO = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 620, y: 750, hpRatio: 0.88 });
  const rows = rankActions(situationOf(self, [], []));
  const advance = scoreOf(rows, 'advance');
  const search = Math.max(scoreOf(rows, 'search_for_target'), scoreOf(rows, 'hold_position'), scoreOf(rows, 'recover'));
  const ok = search >= advance && !['advance', 'push_lane'].includes(best(rows));
  return { name: 'O empty lane no spawn rush', ok, detail: `best=${best(rows)} search=${search.toFixed(1)} advance=${advance.toFixed(1)}` };
};

const scenarioP = (): ScenarioResult => {
  const self = unit({
    id: 1,
    team: 'alpha',
    x: 400,
    y: 750,
    role: 'ranged-tank',
    heroId: 'witch',
    attackRange: 275,
    hpRatio: 0.86,
  });
  const enemies = [unit({ id: 10, team: 'bravo', x: 430, y: 750, attackRange: 70, hpRatio: 0.9 })];
  const kit = kitProfileOf('witch', 'ranged-tank', 275);
  const rows = rankActions(situationOf(self, [], enemies, { kit }));
  const ok = among(rows, ['reposition', 'hold_position', 'retreat', 'wait_for_opening', 'escape'], 3);
  return { name: 'P witch spacing', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioQ = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.55 });
  const allies = [unit({ id: 2, team: 'alpha', x: 980, y: 640, hpRatio: 0.8 })];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 470, y: 740, hpRatio: 0.9 }),
    unit({ id: 11, team: 'bravo', x: 480, y: 770, hpRatio: 0.85 }),
  ];
  const rows = rankActions(situationOf(self, allies, enemies, { isolated: true, allyHeroCount: 1 }));
  const ok = among(rows, ['regroup', 'retreat', 'escape', 'protect_ally'], 3);
  return { name: 'Q isolated regroup', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioR = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 900, y: 640, hpRatio: 0.9 });
  const rows = rankActions(
    situationOf(self, [], [], {
      objective: {
        kind: 'capture_zone',
        x: 980,
        y: 640,
        radius: OBJECTIVE.capture.radius,
        contested: false,
        decaying: false,
        owner: null,
        selfProgress: 0,
        enemyProgress: 0,
        occupyingAllies: 0,
        occupyingEnemies: 0,
        nearbyAllies: 0,
        nearbyEnemies: 0,
        urgency: 0.4,
      },
    }),
  );
  const contest = scoreOf(rows, 'contest_objective');
  const ok = contest > 8 && among(rows, ['contest_objective'], 5);
  return { name: 'R zone is a real option', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} top=${rows.slice(0, 4).map((row) => row.action).join(',')}` };
};

const scenarioS = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 640, hpRatio: 0.1 });
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 520, y: 640, hpRatio: 0.9 }),
    unit({ id: 11, team: 'bravo', x: 560, y: 620, hpRatio: 0.85 }),
    unit({ id: 12, team: 'bravo', x: 580, y: 660, hpRatio: 0.8 }),
  ];
  const rows = rankActions(
    situationOf(self, [], enemies, {
      objective: {
        kind: 'capture_zone',
        x: 1100,
        y: 640,
        radius: OBJECTIVE.capture.radius,
        contested: true,
        decaying: false,
        owner: 'bravo',
        selfProgress: 0,
        enemyProgress: 0.6,
        occupyingAllies: 0,
        occupyingEnemies: 2,
        nearbyAllies: 0,
        nearbyEnemies: 3,
        urgency: 0.7,
      },
    }),
  );
  const ok = !['contest_objective', 'advance', 'attack'].includes(best(rows)) || among(rows, ['retreat', 'escape', 'recover'], 2);
  return { name: 'S low HP does not suicide the zone', ok, detail: `best=${best(rows)} top=${rows.slice(0, 4).map((row) => row.action).join(',')}` };
};

const scenarioT = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 980, y: 640, hpRatio: 0.8, role: 'frontliner' });
  const rows = rankActions(
    situationOf(self, [], [], {
      objective: {
        kind: 'capture_zone',
        x: 1020,
        y: 640,
        radius: OBJECTIVE.capture.radius,
        contested: true,
        decaying: false,
        owner: 'bravo',
        selfProgress: 0.2,
        enemyProgress: 0.9,
        occupyingAllies: 1,
        occupyingEnemies: 1,
        nearbyAllies: 1,
        nearbyEnemies: 1,
        urgency: 0.88,
      },
    }),
  );
  const contest = scoreOf(rows, 'contest_objective');
  const farm = scoreOf(rows, 'farm_minions');
  const ok = contest > 12 && contest >= farm && among(rows, ['contest_objective'], 3);
  return { name: 'T zone near capture is urgent', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} farm=${farm.toFixed(1)}` };
};

const scenarioU = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 980, y: 640, hpRatio: 0.85, role: 'frontliner' });
  const rows = rankActions(
    situationOf(self, [], [], {
      objective: {
        kind: 'golden_piggy',
        x: 1020,
        y: 640,
        radius: OBJECTIVE.piggy.radius,
        contested: false,
        decaying: false,
        owner: 'bravo',
        selfProgress: 0.4,
        enemyProgress: 0.9,
        occupyingAllies: 1,
        occupyingEnemies: 1,
        nearbyAllies: 1,
        nearbyEnemies: 1,
        urgency: 0.86,
      },
    }),
  );
  const contest = scoreOf(rows, 'contest_objective');
  const farm = scoreOf(rows, 'farm_minions');
  const ok = contest > 12 && contest >= farm && among(rows, ['contest_objective'], 3);
  return { name: 'U piggy near break is urgent', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} farm=${farm.toFixed(1)}` };
};

const scenarioV = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 640, hpRatio: 0.18 });
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 980, y: 640, hpRatio: 0.9 }),
    unit({ id: 11, team: 'bravo', x: 1000, y: 620, hpRatio: 0.85 }),
  ];
  const rows = rankActions(
    situationOf(self, [], enemies, {
      objective: {
        kind: 'healing_shrine',
        x: 1020,
        y: 640,
        radius: OBJECTIVE.shrine.radius,
        contested: true,
        decaying: false,
        owner: null,
        selfProgress: 0,
        enemyProgress: 1,
        occupyingAllies: 0,
        occupyingEnemies: 2,
        nearbyAllies: 0,
        nearbyEnemies: 2,
        urgency: 0.5,
      },
    }),
  );
  const ok = !['contest_objective', 'advance', 'attack'].includes(best(rows)) || among(rows, ['retreat', 'escape', 'recover'], 2);
  return { name: 'V low HP does not suicide the shrine', ok, detail: `best=${best(rows)} top=${rows.slice(0, 4).map((row) => row.action).join(',')}` };
};

const scenarioW = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 980, y: 640, hpRatio: 0.86, role: 'frontliner' });
  const rows = rankActions(
    situationOf(self, [], [], {
      objective: {
        kind: 'executioner',
        x: 1020,
        y: 640,
        radius: OBJECTIVE.executioner.radius,
        contested: false,
        decaying: false,
        owner: 'alpha',
        selfProgress: 0.88,
        enemyProgress: 0.4,
        occupyingAllies: 1,
        occupyingEnemies: 0,
        nearbyAllies: 1,
        nearbyEnemies: 0,
        urgency: 0.8,
      },
    }),
  );
  const contest = scoreOf(rows, 'contest_objective');
  const farm = scoreOf(rows, 'farm_minions');
  const ok = contest > 12 && contest >= farm && among(rows, ['contest_objective'], 3);
  return { name: 'W executioner near kill is urgent', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} farm=${farm.toFixed(1)}` };
};

const scenarioX = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 900, y: 640, hpRatio: 0.9, role: 'frontliner' });
  const allies = [unit({ id: 2, team: 'alpha', x: 940, y: 640, hpRatio: 0.7, heroId: 'rope' })];
  const rows = rankActions(
    situationOf(self, allies, [], {
      objective: {
        kind: 'bounty_target',
        x: 940,
        y: 640,
        radius: 40,
        contested: true,
        decaying: false,
        owner: null,
        selfProgress: 1,
        enemyProgress: 1,
        occupyingAllies: 1,
        occupyingEnemies: 1,
        nearbyAllies: 1,
        nearbyEnemies: 1,
        urgency: 0.7,
        allyHeroId: 'rope',
        allyX: 940,
        allyY: 640,
        enemyHeroId: 'cole',
        enemyX: 1300,
        enemyY: 640,
      },
    }),
  );
  const contest = scoreOf(rows, 'contest_objective');
  const ok = contest > 8 && among(rows, ['contest_objective', 'protect_ally', 'assist_ally'], 5);
  return { name: 'X bounty ally is worth covering', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} top=${rows.slice(0, 4).map((row) => row.action).join(',')}` };
};

export const runTacticalScenarios = (): ScenarioResult[] => [
  scenarioA(),
  scenarioB(),
  scenarioC(),
  scenarioD(),
  scenarioE(),
  scenarioF(),
  scenarioG(),
  scenarioH(),
  scenarioI(),
  scenarioJ(),
  scenarioK(),
  scenarioL(),
  scenarioM(),
  scenarioN(),
  scenarioO(),
  scenarioP(),
  scenarioQ(),
  scenarioR(),
  scenarioS(),
  scenarioT(),
  scenarioU(),
  scenarioV(),
  scenarioW(),
  scenarioX(),
];
