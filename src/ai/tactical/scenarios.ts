import { NEUTRAL_PERSONALITY, type CombatantView, type ScoredAction, type Situation, type TacticalAction } from './types';
import { ensureScoreBuffer, scoreSituation } from './evaluate';

const buffer = ensureScoreBuffer();

const unit = (partial: Partial<CombatantView> & Pick<CombatantView, 'id' | 'team' | 'x' | 'y'>): CombatantView => ({
  vx: 0,
  vy: 0,
  aimX: partial.team === 'bravo' ? -1 : 1,
  aimY: 0,
  kind: 'hero',
  role: 'frontliner',
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
];
