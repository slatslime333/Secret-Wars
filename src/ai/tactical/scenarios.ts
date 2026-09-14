import { NEUTRAL_PERSONALITY, type CombatantView, type ScoredAction, type Situation, type TacticalAction } from './types';
import { ensureScoreBuffer, scoreSituation } from './evaluate';
import { kitProfileOf } from './kitProfile';
import { OBJECTIVE } from '../../config/objective';
import { ARENA } from '../../config/arena';
import { assessSupport } from './supportSense';
import { scoreKitSlot } from './kitTactics';
import type { AbilityDef, AbilityTactics } from '../../heroes/abilities/types';

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
  abilityReady: true,
  dashCharges: 2,
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
  const self = unit({ id: 1, team: 'alpha', x: ARENA.width - 80, y: ARENA.laneY.mid, hpRatio: 0.82 });
  const rows = rankActions(situationOf(self, [], []));
  const ok = !['advance', 'push_lane'].includes(best(rows)) && among(rows, ['search_for_target', 'farm_minions', 'recover'], 2);
  return { name: 'M far edge hunt', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioN = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: ARENA.width - 80, y: ARENA.laneY.mid, hpRatio: 0.7 });
  const enemies = [unit({ id: 20, team: 'bravo', x: ARENA.width - 240, y: ARENA.laneY.mid, kind: 'minion', role: 'minion', hpRatio: 0.8, power: 0.3, attackRange: 44 })];
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

const captureAt = (extra: Partial<{
  x: number;
  y: number;
  contested: boolean;
  decaying: boolean;
  owner: 'alpha' | 'bravo' | null;
  selfProgress: number;
  enemyProgress: number;
  occupyingAllies: number;
  occupyingEnemies: number;
  nearbyAllies: number;
  nearbyEnemies: number;
  urgency: number;
}> = {}) => ({
  kind: 'capture_zone' as const,
  x: 1020,
  y: 640,
  radius: OBJECTIVE.capture.radius,
  contested: false,
  decaying: false,
  owner: null as 'alpha' | 'bravo' | null,
  selfProgress: 0,
  enemyProgress: 0,
  occupyingAllies: 0,
  occupyingEnemies: 0,
  nearbyAllies: 0,
  nearbyEnemies: 0,
  urgency: 0.4,
  ...extra,
});

const scenarioY = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 980, y: 640, hpRatio: 0.88 });
  const enemies = [unit({ id: 20, team: 'bravo', x: 1000, y: 660, kind: 'minion', role: 'minion', hpRatio: 0.8, power: 0.3, attackRange: 44 })];
  const rows = rankActions(situationOf(self, [], enemies, { objective: captureAt() }));
  const contest = scoreOf(rows, 'contest_objective');
  const farm = scoreOf(rows, 'farm_minions');
  const ok = contest > farm && among(rows, ['contest_objective'], 2);
  return { name: 'Y free capture beats minion farm', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} farm=${farm.toFixed(1)}` };
};

const scenarioZ = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 900, y: 640, hpRatio: 0.88 });
  const allies = [
    unit({ id: 2, team: 'alpha', x: 470, y: 750, attacking: true, hpRatio: 0.85, power: 1.1 }),
    unit({ id: 3, team: 'alpha', x: 480, y: 760, attacking: true, hpRatio: 0.8, power: 1 }),
  ];
  const enemies = [unit({ id: 10, team: 'bravo', x: 500, y: 750, hpRatio: 0.22, recentlyHit: true })];
  const rows = rankActions(situationOf(self, allies, enemies, { objective: captureAt({ x: 980, nearbyAllies: 0 }) }));
  const contest = scoreOf(rows, 'contest_objective');
  const pile = Math.max(scoreOf(rows, 'attack', 10), scoreOf(rows, 'finish_target', 10), scoreOf(rows, 'assist_ally', 10));
  const ok = contest > pile || among(rows, ['contest_objective'], 2);
  return { name: 'Z handled 2v1 rotates to capture', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} pile=${pile.toFixed(1)}` };
};

const scenarioAA = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 280, y: 750, hpRatio: 0.8, moveSpeed: 140 });
  const rows = rankActions(
    situationOf(self, [], [], {
      objective: captureAt({
        x: 1600,
        y: 640,
        owner: 'bravo',
        enemyProgress: 0.94,
        occupyingEnemies: 2,
        nearbyEnemies: 2,
        contested: false,
        urgency: 0.9,
      }),
    }),
  );
  const contest = scoreOf(rows, 'contest_objective');
  const ok = !['contest_objective'].includes(best(rows)) && (contest < 18 || among(rows, ['search_for_target', 'advance', 'recover', 'farm_minions'], 2));
  return { name: 'AA too late does not dump into capture', ok, detail: `best=${best(rows)} contest=${contest.toFixed(1)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioAB = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 1020, y: 640, hpRatio: 0.85, role: 'frontliner' });
  const enemies = [unit({ id: 10, team: 'bravo', x: 1040, y: 640, hpRatio: 0.7, vx: 40, vy: 0 })];
  const rows = rankActions(
    situationOf(self, [], enemies, {
      objective: captureAt({
        owner: 'alpha',
        selfProgress: 0.55,
        occupyingAllies: 1,
        occupyingEnemies: 1,
        nearbyAllies: 1,
        nearbyEnemies: 1,
        contested: true,
        urgency: 0.7,
      }),
    }),
  );
  const chase = scoreOf(rows, 'chase', 10);
  const keep = Math.max(scoreOf(rows, 'contest_objective'), scoreOf(rows, 'attack', 10));
  const ok = keep >= chase && !['chase'].includes(best(rows));
  return { name: 'AB fight stays on the zone', ok, detail: `best=${best(rows)} keep=${keep.toFixed(1)} chase=${chase.toFixed(1)}` };
};

const scenarioAC = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 900, y: 700, hpRatio: 0.85 });
  const enemies = [unit({ id: 10, team: 'bravo', x: 860, y: 640, vx: 140, vy: 0, aimX: 1, hpRatio: 0.8 })];
  const rows = rankActions(situationOf(self, [], enemies, { objective: captureAt({ x: 1100, y: 640, urgency: 0.5 }) }));
  const intercept = scoreOf(rows, 'intercept', 10);
  const ok = intercept > 8 && among(rows, ['intercept', 'contest_objective'], 4);
  return { name: 'AC intercept enemy running to capture', ok, detail: `best=${best(rows)} intercept=${intercept.toFixed(1)} top=${rows.slice(0, 4).map((row) => row.action).join(',')}` };
};

const scenarioAD = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.7 });
  const allies = [unit({ id: 2, team: 'alpha', x: 980, y: 640, hpRatio: 0.8 })];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 460, y: 740, hpRatio: 0.9 }),
    unit({ id: 11, team: 'bravo', x: 470, y: 770, hpRatio: 0.88 }),
  ];
  const rows = rankActions(
    situationOf(self, allies, enemies, {
      isolated: true,
      allyHeroCount: 1,
      teamScore: { self: 1, enemy: 5 },
      teamMomentum: -0.6,
    }),
  );
  const ok = among(rows, ['regroup', 'retreat', 'escape', 'protect_ally'], 3) && !['chase', 'flank'].includes(best(rows));
  return { name: 'AD losing team avoids a bad 1v2', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioAE = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 500, y: 750, hpRatio: 0.8 });
  const allies = [unit({ id: 2, team: 'alpha', x: 560, y: 750, hpRatio: 0.18, recentlyHit: true })];
  const enemies = [unit({ id: 10, team: 'bravo', x: 590, y: 750, attacking: true, lastAttackerId: 2, vx: -40 })];
  const rows = rankActions(situationOf(self, allies, enemies, { teamScore: { self: 2, enemy: 2 } }));
  const ok = among(rows, ['protect_ally', 'assist_ally', 'attack', 'intercept'], 2);
  return { name: 'AE protect a collapsing ally', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioAF = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, hpRatio: 0.9 });
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 520, y: 740, hpRatio: 0.95 }),
    unit({ id: 11, team: 'bravo', x: 530, y: 760, hpRatio: 0.9 }),
    unit({ id: 12, team: 'bravo', x: 510, y: 780, hpRatio: 0.88 }),
  ];
  const rows = rankActions(
    situationOf(self, [], enemies, {
      teamScore: { self: 6, enemy: 1 },
      teamMomentum: 0.7,
    }),
  );
  const ok = among(rows, ['retreat', 'escape', 'reposition', 'wait_for_opening', 'hold_position'], 3);
  return { name: 'AF winning still refuses a 1v3', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioAG = (): ScenarioResult => {
  const self = unit({
    id: 1,
    team: 'alpha',
    x: 400,
    y: 750,
    heroId: 'shadow',
    role: 'frontliner',
    attackRange: 145,
    hpRatio: 0.88,
    staminaRatio: 0.12,
    abilityReady: false,
    dashCharges: 0,
    canAttack: false,
  });
  const enemies = [unit({ id: 10, team: 'bravo', x: 460, y: 750, hpRatio: 0.9, attackRange: 70 })];
  const kit = kitProfileOf('shadow', 'frontliner', 145, {
    staminaRatio: 0.12,
    abilityReady: false,
    dashCharges: 0,
  });
  const rows = rankActions(situationOf(self, [], enemies, { kit }));
  const ok =
    among(rows, ['recover', 'reposition', 'retreat', 'escape', 'wait_for_opening', 'hold_position'], 2) &&
    !['attack', 'chase', 'flank', 'finish_target'].includes(best(rows));
  return {
    name: 'AG dry shadow does not overcommit',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}`,
  };
};

const scenarioAH = (): ScenarioResult => {
  const self = unit({
    id: 1,
    team: 'alpha',
    x: 400,
    y: 750,
    heroId: 'rope',
    role: 'support',
    attackRange: 248,
    hpRatio: 0.9,
    staminaRatio: 1,
    abilityReady: false,
    dashCharges: 2,
  });
  const enemies = [unit({ id: 10, team: 'bravo', x: 470, y: 750, hpRatio: 0.9, attackRange: 70 })];
  const kit = kitProfileOf('rope', 'support', 248, { staminaRatio: 1, abilityReady: false, dashCharges: 2 });
  const rows = rankActions(situationOf(self, [], enemies, { kit }));
  const ok = among(rows, ['reposition', 'hold_position', 'wait_for_opening', 'retreat'], 3);
  return {
    name: 'AH disarmed rope keeps distance',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}`,
  };
};

const scenarioAI = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, staminaRatio: 0.08, hpRatio: 0.82, attackRange: 70 });
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 450, y: 750, hpRatio: 0.06, recentlyHit: true, power: 0.7 }),
  ];
  const rows = rankActions(situationOf(self, [], enemies));
  const ok = among(rows, ['finish_target', 'attack'], 3) && best(rows) !== 'retreat' && best(rows) !== 'escape';
  return {
    name: 'AI low stamina still finishes',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}`,
  };
};

const scenarioAJ = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, staminaRatio: 0.06, hpRatio: 0.78, attackRange: 70 });
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 460, y: 750, hpRatio: 0.92, attacking: true, attackRange: 70 }),
  ];
  const rows = rankActions(situationOf(self, [], enemies));
  const ok = among(rows, ['retreat', 'reposition', 'wait_for_opening', 'recover', 'hold_position'], 4);
  return {
    name: 'AJ low stamina eases off a healthy foe',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 4).map((row) => row.action).join(',')}`,
  };
};

const scenarioAK = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'frontliner', heroId: 'cole' });
  const allies = [
    unit({ id: 2, team: 'alpha', x: 410, y: 752, role: 'frontliner', heroId: 'ninja' }),
    unit({ id: 3, team: 'alpha', x: 406, y: 744, role: 'support', heroId: 'rope' }),
  ];
  const enemies = [
    unit({
      id: 10,
      team: 'bravo',
      x: 520,
      y: 750,
      heroId: 'witch',
      role: 'ranged-tank',
      attackRange: 220,
      attacking: true,
    }),
  ];
  const rows = rankActions(situationOf(self, allies, enemies));
  const ok = among(rows, ['reposition', 'retreat', 'hold_position', 'wait_for_opening'], 4);
  return {
    name: 'AK packed vs witch prefers spread',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 4).map((row) => row.action).join(',')}`,
  };
};

const scenarioAL = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, staminaRatio: 0.9, hpRatio: 0.8 });
  const enemies = [
    unit({
      id: 10,
      team: 'bravo',
      x: 500,
      y: 750,
      hpRatio: 0.42,
      attacking: false,
      recentlyHit: false,
      vx: 90,
      aimX: 1,
    }),
  ];
  const rows = rankActions(situationOf(self, [], enemies, { homeX: 220 }));
  const ok = among(rows, ['attack', 'chase', 'intercept', 'flank'], 3);
  return {
    name: 'AL visible retreat gets pressured',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}`,
  };
};

const scenarioAM = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750 });
  const visible = {
    id: 10,
    team: 'bravo' as const,
    x: 500,
    y: 750,
    attacking: false,
    recentlyHit: false,
    vx: 0,
    vy: 0,
    blocking: false,
  };
  const full = rankActions(
    situationOf(self, [], [unit({ ...visible, staminaRatio: 1, canAttack: true, abilityReady: true, dashCharges: 2 })]),
  );
  const empty = rankActions(
    situationOf(self, [], [unit({ ...visible, staminaRatio: 0, canAttack: false, abilityReady: false, dashCharges: 0 })]),
  );
  const ok = best(full) === best(empty);
  return {
    name: 'AM hidden enemy meters do not change the call',
    ok,
    detail: `full=${best(full)} empty=${best(empty)}`,
  };
};

const scenarioAN = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, staminaRatio: 0.38, hpRatio: 0.76, attackRange: 70 });
  const enemies = [unit({ id: 10, team: 'bravo', x: 448, y: 750, hpRatio: 0.52, recentlyHit: true, attackRange: 70 })];
  const rows = rankActions(situationOf(self, [], enemies));
  const ok = among(rows, ['attack', 'finish_target'], 2) && !['recover', 'wait_for_opening'].includes(best(rows));
  return {
    name: 'AN melee with medium stamina keeps swinging',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}`,
  };
};

const scenarioAO = (): ScenarioResult => {
  const self = unit({
    id: 1,
    team: 'alpha',
    x: 400,
    y: 750,
    heroId: 'shadow',
    role: 'frontliner',
    attackRange: 145,
    hpRatio: 0.8,
    staminaRatio: 0.48,
  });
  const enemies = [unit({ id: 10, team: 'bravo', x: 470, y: 750, hpRatio: 0.4, recentlyHit: true, attackRange: 70 })];
  const kit = kitProfileOf('shadow', 'frontliner', 145, { staminaRatio: 0.48, abilityReady: true, dashCharges: 2 });
  const rows = rankActions(situationOf(self, [], enemies, { kit }));
  const ok = among(rows, ['attack', 'finish_target', 'chase'], 2) && best(rows) !== 'wait_for_opening';
  return {
    name: 'AO shadow in melee prefers pressure',
    ok,
    detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}`,
  };
};

const mockAbility = (id: string, slot: AbilityDef['slot'], tactics: AbilityTactics): AbilityDef => ({
  id,
  name: id,
  slot,
  cooldownMs: 8000,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: '',
  accent: 0,
  tactics,
  canActivate: () => true,
  activate: () => undefined,
});

const menderKit = kitProfileOf('mender', 'support', 240);
const witchKit = kitProfileOf('witch', 'ranged-tank', 220);

const menderSupport = (self: CombatantView, allies: CombatantView[], enemies: CombatantView[]): Situation =>
  situationOf(self, allies, enemies, { hasAllySupport: true, kit: menderKit });

const scenarioAP = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'support', heroId: 'mender', hpRatio: 0.92, attackRange: 240 });
  const allies = [
    unit({ id: 2, team: 'alpha', x: 430, y: 748, hpRatio: 0.96, attacking: true }),
    unit({ id: 3, team: 'alpha', x: 424, y: 760, hpRatio: 0.94, attacking: true }),
  ];
  const enemies = [unit({ id: 10, team: 'bravo', x: 560, y: 750, hpRatio: 0.7 })];
  const rows = rankActions(menderSupport(self, allies, enemies));
  const ok = among(rows, ['attack', 'assist_ally', 'hold_position', 'reposition'], 3) && best(rows) !== 'protect_ally';
  return { name: 'AP mender healthy team attacks', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioAQ = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 420, y: 750, role: 'support', heroId: 'mender', hpRatio: 0.8, attackRange: 240 });
  const allies = [unit({ id: 2, team: 'alpha', x: 500, y: 750, hpRatio: 0.16, recentlyHit: true, attacking: true })];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 530, y: 742, attacking: true, lastAttackerId: 2 }),
    unit({ id: 11, team: 'bravo', x: 535, y: 760, attacking: true, lastAttackerId: 2 }),
  ];
  const rows = rankActions(menderSupport(self, allies, enemies));
  const ok = among(rows, ['protect_ally', 'assist_ally'], 2);
  return { name: 'AQ mender saves critical ally', ok, detail: `best=${best(rows)} top=${rows.slice(0, 3).map((row) => row.action).join(',')}` };
};

const scenarioAR = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'support', heroId: 'mender', hpRatio: 0.85, attackRange: 240 });
  const hiding = unit({ id: 2, team: 'alpha', x: 250, y: 900, hpRatio: 0.22 });
  const fighting = unit({ id: 3, team: 'alpha', x: 480, y: 750, hpRatio: 0.4, recentlyHit: true, attacking: true });
  const enemies = [unit({ id: 10, team: 'bravo', x: 510, y: 748, attacking: true, lastAttackerId: 3 })];
  const sit = menderSupport(self, [hiding, fighting], enemies);
  const read = assessSupport(sit);
  const ok = read.ally?.id === 3;
  return { name: 'AR mender picks fighting ally over lowest HP', ok, detail: `ally=${read.ally?.id ?? -1} need=${read.need.toFixed(1)} mode=${read.mode}` };
};

const scenarioAS = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'support', heroId: 'mender', hpRatio: 0.55, attackRange: 240 });
  const allies = [unit({ id: 2, team: 'alpha', x: 470, y: 750, hpRatio: 0.24, recentlyHit: true, attacking: true })];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 500, y: 750, attacking: true, lastAttackerId: 2 }),
    unit({ id: 20, team: 'bravo', x: 390, y: 820, kind: 'minion', role: 'minion', heroId: 'minion', hpRatio: 1, power: 0.3 }),
  ];
  const rows = rankActions(menderSupport(self, allies, enemies));
  const farm = scoreOf(rows, 'farm_minions');
  const cover = Math.max(scoreOf(rows, 'protect_ally'), scoreOf(rows, 'assist_ally'));
  const ok = cover > farm;
  return { name: 'AS mender will not farm over a needy ally', ok, detail: `cover=${cover.toFixed(1)} farm=${farm.toFixed(1)} best=${best(rows)}` };
};

const scenarioAT = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'support', heroId: 'mender', hpRatio: 0.9, attackRange: 240 });
  const allies = [unit({ id: 2, team: 'alpha', x: 460, y: 750, hpRatio: 0.94 })];
  const enemies = [unit({ id: 10, team: 'bravo', x: 620, y: 750, hpRatio: 0.8 })];
  const angel = mockAbility('mender-guardian-angel', 'ability1', { roles: ['defense', 'peel', 'shield'], range: 260 });
  const score = scoreKitSlot(angel, menderSupport(self, allies, enemies), 'ability1');
  const ok = score < 18;
  return { name: 'AT mender holds shield on chip HP idle ally', ok, detail: `angel=${score.toFixed(1)}` };
};

const scenarioAU = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'ranged-tank', heroId: 'witch', hpRatio: 0.8, attackRange: 220 });
  const fighting = unit({ id: 2, team: 'alpha', x: 470, y: 750, hpRatio: 0.62, recentlyHit: true, attacking: true });
  const idle = unit({ id: 3, team: 'alpha', x: 430, y: 900, hpRatio: 1 });
  const foes = [unit({ id: 10, team: 'bravo', x: 500, y: 748, attacking: true, lastAttackerId: 2 })];
  const hex = mockAbility('witch-hex', 'ability2', {
    roles: ['defense', 'peel', 'shield', 'buff'],
    range: 220,
    includesSelf: true,
  });
  const fightScore = scoreKitSlot(hex, situationOf(self, [fighting], foes, { hasAllySupport: true, kit: witchKit }), 'ability2');
  const idleScore = scoreKitSlot(hex, situationOf(self, [idle], [], { hasAllySupport: true, kit: witchKit }), 'ability2');
  const ok = fightScore > idleScore + 12 && idleScore < 12;
  return { name: 'AU witch hex helps a fighting ally not an idle one', ok, detail: `fight=${fightScore.toFixed(1)} idle=${idleScore.toFixed(1)}` };
};

const scenarioAV = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'support', heroId: 'mender', hpRatio: 0.14, attackRange: 240 });
  const allies = [unit({ id: 2, team: 'alpha', x: 720, y: 750, hpRatio: 0.18, recentlyHit: true })];
  const enemies = [
    unit({ id: 10, team: 'bravo', x: 480, y: 750, attacking: true }),
    unit({ id: 11, team: 'bravo', x: 560, y: 742, attacking: true }),
    unit({ id: 12, team: 'bravo', x: 620, y: 760, attacking: true }),
  ];
  const sit = menderSupport(self, allies, enemies);
  const read = assessSupport(sit);
  const rows = rankActions(sit);
  const ok = read.need < 28 && !['chase', 'flank'].includes(best(rows));
  return { name: 'AV fragile mender will not suicide a corridor save', ok, detail: `need=${read.need.toFixed(1)} best=${best(rows)} mode=${read.mode}` };
};

const scenarioAW = (): ScenarioResult => {
  const self = unit({ id: 1, team: 'alpha', x: 400, y: 750, role: 'support', heroId: 'mender', hpRatio: 0.82, attackRange: 240 });
  const allies = [unit({ id: 2, team: 'alpha', x: 470, y: 750, hpRatio: 0.58, recentlyHit: true, attacking: true })];
  const enemies = [unit({ id: 10, team: 'bravo', x: 530, y: 750, hpRatio: 0.7, attacking: true, lastAttackerId: 2 })];
  const rows = rankActions(menderSupport(self, allies, enemies));
  const attack = scoreOf(rows, 'attack');
  const cover = Math.max(scoreOf(rows, 'assist_ally'), scoreOf(rows, 'protect_ally'));
  const ok = attack > 8 && cover > 8;
  return { name: 'AW mender mixes fire and peel on moderate injury', ok, detail: `attack=${attack.toFixed(1)} cover=${cover.toFixed(1)} best=${best(rows)}` };
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
  scenarioY(),
  scenarioZ(),
  scenarioAA(),
  scenarioAB(),
  scenarioAC(),
  scenarioAD(),
  scenarioAE(),
  scenarioAF(),
  scenarioAG(),
  scenarioAH(),
  scenarioAI(),
  scenarioAJ(),
  scenarioAK(),
  scenarioAL(),
  scenarioAM(),
  scenarioAN(),
  scenarioAO(),
  scenarioAP(),
  scenarioAQ(),
  scenarioAR(),
  scenarioAS(),
  scenarioAT(),
  scenarioAU(),
  scenarioAV(),
  scenarioAW(),
];
