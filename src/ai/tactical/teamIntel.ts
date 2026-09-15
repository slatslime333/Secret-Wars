import { MATCH } from '../../config/match';
import { WAR_SCORE } from '../../config/score';
import type { CombatantView, Personality, Situation, TacticalAction } from './types';

export type TeamStance = 'winning' | 'slightly_winning' | 'even' | 'slightly_losing' | 'losing_badly';

export type TeamIntel = {
  stance: TeamStance;
  momentum: number;
  scoreLead: number;
  remainingMs: number;
  lateGame: boolean;
  desperate: boolean;
  comfortable: boolean;
  aliveAllies: number;
  localAllies: number;
  localEnemies: number;
  outnumbered: boolean;
  numbersAdvantage: boolean;
  allyInDanger?: CombatantView;
  enemyIsolated?: CombatantView;
  fightHandled: boolean;
  snowballing: boolean;
  underPressure: boolean;
  regrouping: boolean;
  riskDelta: number;
  aggDelta: number;
  tendency: string;
  debug: string;
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

const powerOf = (unit: CombatantView): number => {
  const hp = 0.32 + 0.68 * unit.hpRatio;
  return unit.power * hp * (unit.stunned ? 0.38 : 1);
};

export const assessTeam = (situation: Situation, handledNearby = false): TeamIntel => {
  const { self, allies, enemies, personality } = situation;
  const allyHeroes = allies.filter((ally) => ally.kind === 'hero');
  const enemyHeroes = enemies.filter((enemy) => enemy.kind === 'hero');
  const visibleEnemies = enemyHeroes.filter((enemy) => enemy.visible);
  let localAllies = 0;
  let localEnemies = 0;
  let allyPower = 0;
  let enemyPower = 0;
  let weak: CombatantView | undefined;
  for (const ally of allyHeroes) {
    const d = dist(self, ally);
    if (d < 230) {
      localAllies += 1;
      allyPower += powerOf(ally);
    }
    if (ally.hpRatio < 0.34 && (ally.recentlyHit || ally.attacking || d < 280)) {
      if (!weak || ally.hpRatio < weak.hpRatio) {
        weak = ally;
      }
    }
  }
  for (const enemy of visibleEnemies) {
    if (dist(self, enemy) < 230) {
      localEnemies += 1;
      enemyPower += powerOf(enemy);
    }
  }
  let isolated: CombatantView | undefined;
  for (const enemy of visibleEnemies) {
    const guards = visibleEnemies.filter((other) => other !== enemy && dist(other, enemy) < 160).length;
    if (guards === 0 && (enemy.hpRatio < 0.55 || dist(self, enemy) < 260)) {
      if (!isolated || enemy.hpRatio < isolated.hpRatio) {
        isolated = enemy;
      }
    }
  }

  const scoreLead = (situation.teamScore?.self ?? 0) - (situation.teamScore?.enemy ?? 0);
  const killLead = scoreLead / WAR_SCORE.heroKill;
  let momentum = situation.teamMomentum ?? 0;
  if (situation.now && situation.teamScore) {
    const age = situation.now - (situation.teamScore.lastKillAt ?? 0);
    if (age > 8000) {
      momentum *= 0.45;
    } else if (age > 4000) {
      momentum *= 0.7;
    }
  }
  const fieldTilt = clamp((allyPower - enemyPower) * 0.18 + (localAllies - localEnemies) * 0.08, -0.35, 0.35);
  const blended = clamp(killLead * 0.18 + momentum * 0.55 + fieldTilt, -1, 1);

  let stance: TeamStance = 'even';
  if (blended <= -0.55 || killLead <= -2.5) {
    stance = 'losing_badly';
  } else if (blended <= -0.22 || killLead <= -1.25) {
    stance = 'slightly_losing';
  } else if (blended >= 0.55 || killLead >= 2.5) {
    stance = 'winning';
  } else if (blended >= 0.22 || killLead >= 1.25) {
    stance = 'slightly_winning';
  }

  const remainingMs = situation.remainingMs ?? MATCH.durationMs;
  const lateGame = remainingMs <= WAR_SCORE.finalMinuteMs;
  const lastHalfMinute = remainingMs <= 30_000;
  const desperate =
    lateGame && (stance === 'losing_badly' || (stance === 'slightly_losing' && lastHalfMinute));
  const comfortable = lateGame && (stance === 'winning' || (stance === 'slightly_winning' && lastHalfMinute));

  const outnumbered = localEnemies >= localAllies + 2 || (localEnemies >= 2 && localAllies === 0);
  const numbersAdvantage = localAllies >= localEnemies + 1 && localAllies >= 1;
  const snowballing = (stance === 'winning' || stance === 'slightly_winning') && momentum > 0.12 && !outnumbered;
  const underPressure = stance === 'losing_badly' || (outnumbered && self.hpRatio < 0.55);
  const regrouping = Boolean(situation.isolated) && allyHeroes.length > 0 && (underPressure || personality.teamwork > 0.55);

  let riskDelta = 0;
  let aggDelta = 0;
  if (stance === 'losing_badly') {
    riskDelta += 0.1;
    aggDelta -= 0.08;
  } else if (stance === 'slightly_losing') {
    riskDelta += 0.05;
    aggDelta -= 0.04;
  } else if (stance === 'winning') {
    riskDelta -= 0.06;
    aggDelta += 0.07;
  } else if (stance === 'slightly_winning') {
    riskDelta -= 0.03;
    aggDelta += 0.04;
  }
  if (outnumbered) {
    riskDelta += 0.08;
    aggDelta -= 0.06;
  }
  if (numbersAdvantage && self.hpRatio > 0.4) {
    aggDelta += 0.05;
    riskDelta -= 0.03;
  }
  if (outnumbered && localEnemies >= 3) {
    riskDelta += 0.1;
    aggDelta -= 0.1;
  }

  const tendency = underPressure
    ? 'PLAYING SAFER'
    : snowballing
      ? 'AGGRESSIVE PRESSURE'
      : regrouping
        ? 'REGROUPING'
        : numbersAdvantage
          ? 'NUMBERS ADVANTAGE'
          : outnumbered
            ? 'OUTNUMBERED'
            : 'EVEN';

  const stanceLabel =
    stance === 'losing_badly'
      ? 'TEAM LOSING'
      : stance === 'slightly_losing'
        ? 'TEAM BEHIND'
        : stance === 'winning'
          ? 'TEAM AHEAD'
          : stance === 'slightly_winning'
            ? 'TEAM UP'
            : 'TEAM EVEN';

  return {
    stance,
    momentum,
    scoreLead,
    remainingMs,
    lateGame,
    desperate,
    comfortable,
    aliveAllies: allyHeroes.length,
    localAllies,
    localEnemies,
    outnumbered,
    numbersAdvantage,
    allyInDanger: weak,
    enemyIsolated: isolated,
    fightHandled: handledNearby,
    snowballing,
    underPressure,
    regrouping,
    riskDelta,
    aggDelta,
    tendency,
    debug: `${stanceLabel} → ${tendency}`,
  };
};

export const biasAction = (
  action: TacticalAction,
  score: number,
  team: TeamIntel,
  personality: Personality,
  self: CombatantView,
): number => {
  let next = score;
  const losing = team.stance === 'losing_badly' || team.stance === 'slightly_losing';
  const ahead = team.stance === 'winning' || team.stance === 'slightly_winning';
  if (losing) {
    if (action === 'attack' || action === 'chase' || action === 'flank') {
      next -= team.outnumbered ? (team.stance === 'losing_badly' ? 11 : 6) : 3;
    }
    if (action === 'regroup' || action === 'protect_ally') {
      next += 7 + personality.teamwork * 4;
    }
    if (action === 'assist_ally' && team.allyInDanger) {
      next += 6 + personality.protectionInstinct * 4;
    }
    if (action === 'contest_objective' && team.underPressure) {
      next -= 4;
    }
  }
  if (ahead && !team.outnumbered) {
    if (action === 'attack' || action === 'finish_target' || action === 'intercept') {
      next += team.snowballing ? 7 : 4;
    }
    if (action === 'contest_objective') {
      next += 4 + personality.aggression * 3;
    }
    if (action === 'retreat' && self.hpRatio > 0.42 && !team.allyInDanger) {
      next -= 5;
    }
  }
  if (team.outnumbered && team.localEnemies >= 3 && (action === 'attack' || action === 'chase' || action === 'flank' || action === 'assist_ally')) {
    next -= 18;
  }
  if (team.fightHandled && (action === 'attack' || action === 'assist_ally' || action === 'finish_target')) {
    next -= 7;
  }
  if (team.fightHandled && action === 'contest_objective') {
    next += 10 + personality.opportunism * 4;
  }
  if (team.allyInDanger && (action === 'protect_ally' || action === 'assist_ally' || action === 'intercept')) {
    next += 5;
  }
  if (team.enemyIsolated && team.snowballing && (action === 'attack' || action === 'chase' || action === 'finish_target')) {
    next += 5;
  }
  if (team.regrouping && action === 'regroup') {
    next += 6;
  }
  if (team.desperate && !team.outnumbered) {
    if (action === 'farm_minions') {
      next -= 10;
    }
    if (action === 'contest_objective') {
      next += 8;
    }
    if (action === 'attack' || action === 'chase' || action === 'finish_target') {
      next += 5;
    }
  }
  if (team.comfortable) {
    if (action === 'farm_minions') {
      next -= 4;
    }
    if (action === 'contest_objective') {
      next += 6;
    }
    if (action === 'protect_ally' || action === 'regroup') {
      next += 4;
    }
    if ((action === 'attack' || action === 'chase' || action === 'finish_target') && !team.outnumbered) {
      next += 2;
    }
  }
  if (team.lateGame && Math.abs(team.scoreLead) < WAR_SCORE.heroKill && action === 'contest_objective') {
    next += 6;
  }
  return next;
};
