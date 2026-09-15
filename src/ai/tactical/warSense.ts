import { MATCH } from '../../config/match';
import { OBJECTIVE_SCORE, WAR_SCORE } from '../../config/score';
import type { CombatantView, Personality, Situation, TacticalAction } from './types';

export type ClockPhase = 'early' | 'mid' | 'late' | 'closing' | 'last_seconds';

export type WarSlice = {
  scoreLead: number;
  lateGame: boolean;
  desperate: boolean;
  comfortable: boolean;
  outnumbered: boolean;
  stance?: string;
  enemyIsolated?: CombatantView;
  allyInDanger?: CombatantView;
};

export type WarRead = {
  clock: ClockPhase;
  remainingMs?: number;
  levelLead: number;
  selfLevel: number;
  xpSoon: boolean;
  closeScore: boolean;
  needSwing: boolean;
  protectLead: boolean;
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

const heroLevel = (unit: CombatantView): number => unit.level ?? 1;

/** Clock phases only when the match clock is on the situation. Tests without it stay mid-game. */
export const clockPhaseOf = (remainingMs?: number): ClockPhase => {
  if (remainingMs === undefined) {
    return 'mid';
  }
  if (remainingMs <= 10_000) {
    return 'last_seconds';
  }
  if (remainingMs <= 20_000) {
    return 'closing';
  }
  if (remainingMs <= 90_000) {
    return 'late';
  }
  if (remainingMs > MATCH.durationMs - 60_000) {
    return 'early';
  }
  return 'mid';
};

const avgHeroLevel = (units: readonly CombatantView[]): number => {
  const heroes = units.filter((unit) => unit.kind === 'hero');
  if (heroes.length === 0) {
    return 1;
  }
  return heroes.reduce((sum, unit) => sum + heroLevel(unit), 0) / heroes.length;
};

/** Score/XP/clock read used by existing bias and evaluation. Cheap: one pass per think. */
export const assessWar = (situation: Situation, team: WarSlice): WarRead => {
  const remainingMs = situation.remainingMs;
  const clock = clockPhaseOf(remainingMs);
  const allyHeroes = [situation.self, ...situation.allies.filter((ally) => ally.kind === 'hero')];
  const enemyHeroes = situation.enemies.filter((enemy) => enemy.kind === 'hero');
  const levelLead = avgHeroLevel(allyHeroes) - avgHeroLevel(enemyHeroes);
  const closeScore = Math.abs(team.scoreLead) < WAR_SCORE.heroKill;
  const lastBreath = clock === 'last_seconds' || clock === 'closing';
  const needSwing =
    team.desperate ||
    (closeScore && (team.lateGame || lastBreath)) ||
    (lastBreath && team.scoreLead < 0);
  const protectLead =
    team.comfortable ||
    ((team.stance === 'winning' || team.stance === 'slightly_winning') && lastBreath);
  const xpSoon = (situation.self.xpRatio ?? 0) >= 0.72 && clock !== 'last_seconds' && clock !== 'closing';
  return {
    clock,
    remainingMs,
    levelLead,
    selfLevel: heroLevel(situation.self),
    xpSoon,
    closeScore,
    needSwing,
    protectLead,
  };
};

const AOE_FARM: ReadonlySet<string> = new Set(['death', 'cole', 'witch', 'ninja']);

export const minionPackSize = (
  anchor: CombatantView,
  enemies: readonly CombatantView[],
  radius = 96,
): number => {
  let n = 0;
  for (const enemy of enemies) {
    if (enemy.kind !== 'minion' || !enemy.visible) {
      continue;
    }
    if (dist(anchor, enemy) <= radius) {
      n += 1;
    }
  }
  return n;
};

export const isAoeFarmer = (heroId: string): boolean => AOE_FARM.has(heroId);

/** Direct war-score on an objective kind. Shrine / rage / meteor stay 0. */
export const objectiveScoreValue = (kind: string | undefined): number =>
  (kind ? OBJECTIVE_SCORE[kind] : undefined) ?? 0;

/**
 * Extra utility on top of the existing biasAction numbers.
 * Personality still owns the mix; this only tilts fight / farm / obj / protect by the clock.
 */
export const warBiasAction = (
  action: TacticalAction,
  score: number,
  team: WarSlice,
  war: WarRead,
  self: CombatantView,
  personality?: Personality,
): number => {
  let next = score;
  const farm = action === 'farm_minions';
  const fight = action === 'attack' || action === 'chase' || action === 'flank';
  const finish = action === 'finish_target';
  const contest = action === 'contest_objective';
  const protect = action === 'protect_ally' || action === 'assist_ally' || action === 'intercept';
  const survive = action === 'retreat' || action === 'escape' || action === 'regroup';
  if (personality) {
    if (protect) {
      next += (personality.protectionInstinct - 0.5) * 12 + (personality.teamwork - 0.5) * 6;
      if (personality.independence > 0.72 && !team.allyInDanger) {
        next -= 12;
      }
    }
    if (farm) {
      next +=
        (personality.independence - 0.5) * 10 +
        (personality.caution - 0.5) * 8 -
        (personality.protectionInstinct - 0.5) * 5;
      if (personality.independence > 0.72 && !team.allyInDanger && !team.outnumbered) {
        next += 8;
      }
    }
    if (contest) {
      next += (personality.opportunism - 0.5) * 14 - (personality.protectionInstinct - 0.5) * 5;
    }
    if (fight) {
      next += (personality.aggression - 0.5) * 5 - (personality.caution - 0.5) * 4;
    }
  }

  if (war.clock === 'early' && farm && !team.allyInDanger) {
    next += 3;
  }
  if (war.xpSoon && farm && !team.outnumbered) {
    next += 5;
  }
  if (war.levelLead <= -1.4) {
    if (fight && !team.enemyIsolated) {
      next -= 5;
    }
    if (finish && team.enemyIsolated) {
      next += 8;
    }
    if (contest && war.needSwing) {
      next += 4;
    }
  }
  if (war.levelLead >= 1.4 && (finish || (fight && !team.outnumbered))) {
    next += 3;
  }

  if (war.clock === 'late' && farm && team.scoreLead < 0) {
    next -= 4;
  }
  if (war.clock === 'closing') {
    if (farm) {
      next -= 10;
    }
    if (contest) {
      next += 6;
    }
    if (finish) {
      next += 6;
    }
  }
  if (war.clock === 'last_seconds') {
    if (farm) {
      next -= 18;
    }
    if (action === 'recover' || action === 'search_for_target' || action === 'advance') {
      next -= 8;
    }
    if (finish || contest) {
      next += 10;
    }
    if (fight && !team.outnumbered) {
      next += 5;
    }
  }

  if (war.closeScore && (war.clock === 'late' || war.clock === 'closing' || war.clock === 'last_seconds')) {
    if (contest || finish) {
      next += 7;
    }
    if (protect && team.allyInDanger) {
      next += 6;
    }
  }
  if (war.needSwing && !team.outnumbered) {
    if (farm) {
      next -= 8;
    }
    if (contest || finish) {
      next += 6;
    }
  }
  if (war.protectLead) {
    if (protect) {
      next += 6;
    }
    if (survive && self.hpRatio < 0.42) {
      next += 5;
    }
    if (fight && team.outnumbered) {
      next -= 4;
    }
    if (action === 'chase' && self.hpRatio < 0.5) {
      next -= 6;
    }
  }
  if (team.allyInDanger && protect) {
    next += 3;
  }
  return clamp(next, -80, 140);
};
