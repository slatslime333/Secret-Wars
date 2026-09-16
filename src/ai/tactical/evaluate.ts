import { ARENA, atFarEdge } from '../../config/arena';
import { MATCH } from '../../config/match';
import { TACTIC } from './constants';
import { isRangedLike, isRopeDisarmed, isShadowDry } from './kitProfile';
import { assessObjective, isZoneObjective } from './objectiveIntel';
import type { ObjectiveIntel } from './objectiveIntel';
import {
  biasFightAction,
  canStrikeOutsidePocket,
  chaseQualityCost,
  futurePositionCost,
  lifeTradeCost,
  matesInPocket,
  opportunityOf,
  peelWeight,
  pocketRadius,
  readFightShape,
  reserveGap,
  setupPending,
  threatZoneCost,
} from './fightRead';
import { clusterRiskOf, occupancyOf } from './spacing';
import { assessTeam, biasAction, type TeamIntel } from './teamIntel';
import { assessWar, isAoeFarmer, minionPackSize, objectiveScoreValue, warBiasAction } from './warSense';
import { applyDemonBias } from './demonSense';
import { applyEnvBias } from './envSense';
import { assessSupport } from './supportSense';
import { pickHealMinion } from './retreat';
import type {
  CombatantView,
  GamePlan,
  Personality,
  ScoredAction,
  Situation,
  TacticalAction,
  ThreatLevel,
} from './types';

const MAX_SCORED = 64;

export const threatFromRisk = (risk: number): ThreatLevel => {
  if (risk >= 0.78) {
    return 'extreme';
  }
  if (risk >= 0.54) {
    return 'high';
  }
  if (risk >= 0.3) {
    return 'medium';
  }
  return 'low';
};

export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Own stamina only. 0 = comfortable, 1 = empty. Never a hard retreat switch. */
const ownStaminaStrain = (self: CombatantView): number => {
  const r = self.staminaRatio;
  if (r >= 0.48) {
    return 0;
  }
  if (r >= 0.32) {
    return ((0.48 - r) / 0.16) * 0.28;
  }
  if (r >= 0.18) {
    return 0.28 + ((0.32 - r) / 0.14) * 0.32;
  }
  if (r >= 0.08) {
    return 0.6 + ((0.18 - r) / 0.1) * 0.25;
  }
  return 0.92;
};

const effectivePower = (unit: CombatantView): number => {
  const hp = 0.32 + 0.68 * unit.hpRatio;
  const stun = unit.stunned ? 0.38 : 1;
  const crit = unit.hpRatio < TACTIC.criticalHp ? 0.45 : 1;
  return unit.power * hp * stun * crit;
};

const isRangedOf = (unit: CombatantView, stance?: Situation['kit']): boolean =>
  isRangedLike(unit.role, unit.attackRange, stance?.stance);

const engageRange = (a: CombatantView, b: CombatantView): number =>
  Math.max(a.attackRange, b.attackRange, 72) + TACTIC.engagePad;

export const engagedWith = (a: CombatantView, b: CombatantView): boolean => {
  const d = dist(a, b);
  if (d <= engageRange(a, b)) {
    return true;
  }
  if ((a.attacking || b.attacking || a.recentlyHit || b.recentlyHit) && d < 168) {
    return true;
  }
  return false;
};

type FightPress = {
  allies: CombatantView[];
  enemies: CombatantView[];
  allyPower: number;
  enemyPower: number;
};

const pushUnique = (list: CombatantView[], unit: CombatantView): void => {
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === unit) {
      return;
    }
  }
  list.push(unit);
};

/** Allies occupying this fight in a way that another body would be redundant. */
export const pressOnEnemy = (enemy: CombatantView, allies: CombatantView[]): FightPress => {
  const on: CombatantView[] = [];
  let allyPower = 0;
  const pocket = enemy.attackRange * 0.9 + 10;
  for (const ally of allies) {
    const d = dist(ally, enemy);
    const poke = canStrikeOutsidePocket(ally, enemy);
    const inPocket =
      ally.kind === 'hero' &&
      d <= pocket &&
      (ally.attacking || ally.recentlyHit || d <= enemy.attackRange * 0.72);
    const closeSwing =
      (ally.attacking || ally.recentlyHit) && d < Math.min(190, Math.max(90, ally.attackRange * 0.9));
    const meleeEngage = !poke && engagedWith(ally, enemy);
    if (meleeEngage || closeSwing || inPocket) {
      on.push(ally);
      allyPower += effectivePower(ally) * (inPocket && !engagedWith(ally, enemy) && !ally.attacking ? 0.82 : 1);
    }
  }
  return { allies: on, enemies: [enemy], allyPower, enemyPower: effectivePower(enemy) };
};

export const protectorsOf = (enemy: CombatantView, enemies: CombatantView[]): CombatantView[] => {
  const extra: CombatantView[] = [];
  for (const other of enemies) {
    if (other === enemy) {
      continue;
    }
    if (dist(other, enemy) < 150) {
      extra.push(other);
    }
  }
  return extra;
};

const isolation = (enemy: CombatantView, enemies: CombatantView[]): number => {
  const extra = protectorsOf(enemy, enemies);
  if (extra.length === 0) {
    return 1;
  }
  if (extra.length === 1 && extra[0].hpRatio < 0.35) {
    return 0.55;
  }
  return clamp(1 - extra.length * 0.38, 0, 1);
};

const inboundOnEnemy = (enemy: CombatantView, allies: CombatantView[], already: CombatantView[]): number => {
  let n = 0;
  for (const ally of allies) {
    if (ally.kind !== 'hero') {
      continue;
    }
    let seen = false;
    for (let i = 0; i < already.length; i += 1) {
      if (already[i] === ally) {
        seen = true;
        break;
      }
    }
    if (seen) {
      continue;
    }
    const d = dist(ally, enemy);
    if (d < 240 && movingToward(ally, enemy.x, enemy.y)) {
      n += 1;
    }
  }
  return n;
};

const overkillWeight = (enemy: CombatantView, allies: CombatantView[], enemies: CombatantView[]): number => {
  const press = pressOnEnemy(enemy, allies);
  const guards = protectorsOf(enemy, enemies);
  let theirPower = press.enemyPower;
  for (const guard of guards) {
    theirPower += effectivePower(guard) * 0.7;
  }
  const inbound = inboundOnEnemy(enemy, allies, press.allies);
  const n = press.allies.length + inbound * 0.55;
  if (n <= 0) {
    return 0;
  }
  const winning = press.allyPower > theirPower * 1.15;
  if (n >= 3 && enemy.hpRatio < 0.55) {
    return 1;
  }
  if (n >= 2 && enemy.hpRatio < 0.28 && winning) {
    return 0.95;
  }
  if (n >= 2 && winning && enemy.hpRatio < 0.5) {
    return 0.82;
  }
  if (n >= 1 && enemy.hpRatio < 0.14 && winning) {
    return 0.72;
  }
  if (n >= TACTIC.overkillAllies) {
    return 0.7;
  }
  if (n >= 1 && winning && enemy.hpRatio < 0.72) {
    return 0.38 + n * 0.12;
  }
  return n * 0.22;
};

const localRisk = (self: CombatantView, allies: CombatantView[], enemies: CombatantView[], personality: Personality): number => {
  let nearAllies = 0;
  let nearEnemies = 0;
  let allyPower = 0;
  let enemyPower = 0;
  let sides = 0;
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  for (const ally of allies) {
    if (dist(self, ally) < 210) {
      nearAllies += 1;
      allyPower += effectivePower(ally);
    }
  }
  for (const enemy of enemies) {
    const d = dist(self, enemy);
    if (d < 210) {
      nearEnemies += 1;
      enemyPower += effectivePower(enemy);
      if (enemy.x < self.x - 12) {
        left = true;
      }
      if (enemy.x > self.x + 12) {
        right = true;
      }
      if (enemy.y < self.y - 12) {
        up = true;
      }
      if (enemy.y > self.y + 12) {
        down = true;
      }
    }
  }
  if (left) {
    sides += 1;
  }
  if (right) {
    sides += 1;
  }
  if (up) {
    sides += 1;
  }
  if (down) {
    sides += 1;
  }
  let risk = 0;
  const gap = enemyPower - allyPower - effectivePower(self) * 0.35;
  if (gap > 0.55) {
    risk += 0.28;
  }
  if (nearEnemies >= nearAllies + 2) {
    risk += 0.22;
  } else if (nearEnemies > nearAllies) {
    risk += 0.12;
  }
  if (self.hpRatio < 0.28) {
    risk += 0.22;
  }
  if (self.hpRatio < TACTIC.criticalHp) {
    risk += 0.18;
  }
  if ((self.role === 'tank' || self.role === 'frontliner') && !(self.heroId === 'demon' && self.demonForm !== 'big') && self.hpRatio >= 0.42) {
    risk -= 0.14;
  } else if ((self.role === 'tank' || self.role === 'frontliner') && !(self.heroId === 'demon' && self.demonForm !== 'big') && self.hpRatio >= 0.3) {
    risk -= 0.06;
  }
  if ((self.role === 'disruptor' || self.role === 'assassin') && self.hpRatio < 0.38 && nearEnemies > 0) {
    risk += 0.08;
  }
  risk += ownStaminaStrain(self) * 0.12;
  if (sides >= 3) {
    risk += 0.16;
  }
  if (nearEnemies >= 3 && nearAllies === 0) {
    risk += 0.16;
  }
  risk += (0.5 - personality.bravery) * 0.12;
  risk += (personality.caution - 0.5) * 0.1;
  return clamp(risk, 0, 1);
};

type Cluster = {
  x: number;
  y: number;
  allies: CombatantView[];
  enemies: CombatantView[];
  allyPower: number;
  enemyPower: number;
  urgency: number;
  handled: boolean;
};

const buildClusters = (self: CombatantView, allies: CombatantView[], enemies: CombatantView[]): Cluster[] => {
  const units: CombatantView[] = [self, ...allies, ...enemies];
  const n = units.length;
  if (n === 0) {
    return [];
  }
  const parent = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    parent[i] = i;
  }
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const join = (a: number, b: number): void => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) {
      parent[pa] = pb;
    }
  };
  const radius = TACTIC.clusterRadius;
  const radiusSq = radius * radius;
  for (let i = 0; i < n; i += 1) {
    const a = units[i];
    const aHot = a.attacking || a.recentlyHit || a.stunned;
    for (let j = i + 1; j < n; j += 1) {
      const b = units[j];
      if (dist2(a.x, a.y, b.x, b.y) > radiusSq) {
        continue;
      }
      const opposed = a.team !== b.team;
      const bHot = b.attacking || b.recentlyHit || b.stunned;
      if (opposed || aHot || bHot) {
        join(i, j);
      }
    }
  }
  const groups = new Map<number, CombatantView[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    const list = groups.get(root);
    if (list) {
      list.push(units[i]);
    } else {
      groups.set(root, [units[i]]);
    }
  }
  const clusters: Cluster[] = [];
  for (const group of groups.values()) {
    const cAllies: CombatantView[] = [];
    const cEnemies: CombatantView[] = [];
    let x = 0;
    let y = 0;
    for (const unit of group) {
      x += unit.x;
      y += unit.y;
      if (unit.team === self.team) {
        if (unit !== self) {
          cAllies.push(unit);
        }
      } else {
        cEnemies.push(unit);
      }
    }
    const cx = x / group.length;
    const cy = y / group.length;
    if (cEnemies.length === 0) {
      continue;
    }
    const fighting = cEnemies.some((enemy) => enemy.attacking || enemy.recentlyHit) || cAllies.length > 0;
    const toCluster = Math.hypot(self.x - cx, self.y - cy);
    if (!fighting && toCluster > 240) {
      continue;
    }
    let allyPower = effectivePower(self) * (toCluster < 200 ? 0.25 : 0);
    let enemyPower = 0;
    let allyHp = 0;
    for (const ally of cAllies) {
      allyPower += effectivePower(ally);
      allyHp += ally.hpRatio;
    }
    if (cAllies.length > 0) {
      allyHp /= cAllies.length;
    } else {
      allyHp = 1;
    }
    for (const enemy of cEnemies) {
      enemyPower += effectivePower(enemy);
    }
    const selfIn = toCluster < 220 ? 1 : 0;
    const countGap = cEnemies.length - (cAllies.length + selfIn);
    let urgency = 8;
    if (cEnemies.length > cAllies.length) {
      urgency += 28 * (cEnemies.length - Math.max(1, cAllies.length));
    }
    urgency += (1 - allyHp) * 22;
    if (enemyPower > allyPower * 1.05) {
      urgency += 24;
    }
    const avgEnemyHp = cEnemies.reduce((sum, enemy) => sum + enemy.hpRatio, 0) / cEnemies.length;
    const handled = cAllies.length >= 2 && cEnemies.length <= 1 && avgEnemyHp < 0.55 && allyPower > enemyPower;
    if (handled) {
      urgency -= 42;
    }
    if (cAllies.length >= 2 && cEnemies.length <= 1) {
      urgency -= 16 + Math.max(0, cAllies.length - 1) * 10;
    }
    if (cAllies.length >= 3 && cEnemies.length <= 1) {
      urgency -= 18;
    }
    urgency += countGap * 6;
    clusters.push({
      x: cx,
      y: cy,
      allies: cAllies,
      enemies: cEnemies,
      allyPower,
      enemyPower,
      urgency: Math.max(0, urgency),
      handled,
    });
  }
  return clusters;
};

const movingToward = (from: CombatantView, toX: number, toY: number): boolean => {
  const speed = Math.hypot(from.vx, from.vy);
  if (speed < 18) {
    return false;
  }
  const dx = toX - from.x;
  const dy = toY - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const dot = (from.vx * dx + from.vy * dy) / (speed * len);
  return dot > 0.35;
};

const retreatingFrom = (enemy: CombatantView, self: CombatantView, homeX: number): boolean => {
  const away = movingToward(enemy, homeX > ARENA.width / 2 ? ARENA.teamSpawnX.bravo : ARENA.teamSpawnX.alpha, enemy.y) || movingToward(enemy, enemy.x + (enemy.x - self.x), enemy.y + (enemy.y - self.y));
  const speed = Math.hypot(enemy.vx, enemy.vy);
  if (speed < 20) {
    return false;
  }
  const dx = enemy.x - self.x;
  const dy = enemy.y - self.y;
  const len = Math.hypot(dx, dy) || 1;
  const closing = (enemy.vx * dx + enemy.vy * dy) / (speed * len);
  return away || closing < -0.25;
};

/**
 * Visible-only guess that a foe is not committing. Caps below 1.
 * Must not read enemy stamina, canAttack, cooldowns, or ability flags.
 */
const inferredLull = (enemy: CombatantView, self: CombatantView, homeX: number): number => {
  if (!enemy.visible || enemy.kind === 'minion' || enemy.stunned) {
    return 0;
  }
  if (enemy.attacking || enemy.recentlyHit) {
    return 0;
  }
  let chance = 0;
  const d = dist(self, enemy);
  const speed = Math.hypot(enemy.vx, enemy.vy);
  const backing = retreatingFrom(enemy, self, homeX);
  const closing = movingToward(enemy, self.x, self.y);
  if (backing) {
    chance += 0.32;
  }
  if (enemy.blocking) {
    chance += 0.18;
  }
  if (!closing && speed < 28 && d < self.attackRange * 1.85) {
    chance += 0.22;
  }
  if (!enemy.attacking && d <= enemy.attackRange * 1.2 && speed < 36 && !closing) {
    chance += 0.16;
  }
  return clamp(chance, 0, 0.72);
};

const threatensAlly = (enemy: CombatantView, allies: CombatantView[]): CombatantView | undefined => {
  let best: CombatantView | undefined;
  let bestD = 9999;
  for (const ally of allies) {
    if (!engagedWith(enemy, ally) && dist(enemy, ally) > 170) {
      continue;
    }
    const d = dist(enemy, ally);
    if (d < bestD) {
      best = ally;
      bestD = d;
    }
  }
  return best;
};

const standoff = (self: CombatantView, enemy: CombatantView, allies: CombatantView[], enemies: CombatantView[]): boolean => {
  if (self.hpRatio < 0.55 || enemy.hpRatio < 0.48) {
    return false;
  }
  const nearA = allies.filter((ally) => dist(self, ally) < 200).length;
  const nearE = enemies.filter((other) => dist(self, other) < 200).length;
  if (nearE >= nearA + 2) {
    return false;
  }
  const powerGap = Math.abs(effectivePower(self) - effectivePower(enemy));
  return powerGap < 0.55 && nearE <= nearA + 1;
};

const write = (
  out: ScoredAction[],
  count: number,
  action: TacticalAction,
  score: number,
  reason: string,
  targetId = -1,
  allyId = -1,
): number => {
  if (score < 3 || count >= out.length) {
    return count;
  }
  const slot = out[count];
  slot.action = action;
  slot.score = score;
  slot.reason = reason;
  slot.targetId = targetId;
  slot.allyId = allyId;
  return count + 1;
};

const createSlot = (): ScoredAction => ({
  action: 'search_for_target',
  score: 0,
  targetId: -1,
  allyId: -1,
  reason: '',
});

export const ensureScoreBuffer = (buffer?: ScoredAction[]): ScoredAction[] => {
  if (buffer && buffer.length >= MAX_SCORED) {
    return buffer;
  }
  const out: ScoredAction[] = buffer ? buffer.slice() : [];
  while (out.length < MAX_SCORED) {
    out.push(createSlot());
  }
  return out;
};

export const riskOfSituation = (situation: Situation): number => {
  let risk = localRisk(situation.self, situation.allies, situation.enemies, situation.personality);
  if (!situation.escapeOpen) {
    risk += 0.14;
  }
  return clamp(risk, 0, 1);
};

/**
 * Fill `out` with scored actions. Deterministic — callers add noise when picking.
 * Returns the number of valid entries written.
 *
 * Convergence used to come from three existing loops, not a missing brain:
 * 1. Attack starts at 36, so a visible enemy beats farm/objectives unless
 *    already overkilled. Seeing a foe was effectively "go fight".
 * 2. Assist/protect scored "go to the ally" while dests were the same radial
 *    point on the enemy (or the ally's feet). Teammate help = stand on them.
 * 3. clusterRiskOf was 0 without a wide hitter, so occupancy never cost.
 * Clustering now has a cost, cold joins must beat current work, and dests
 * pick unique stands. Large fights still happen when several CPUs independently
 * score the same conflict high (objective threat, collapsing ally, isolation).
 */
export const scoreSituation = (situation: Situation, out: ScoredAction[]): number => {
  const { self, allies, enemies, personality, kind } = situation;
  const clusters = buildClusters(self, allies, enemies);
  let urgent: Cluster | undefined;
  let handledNearby = false;
  for (const cluster of clusters) {
    if (!urgent || cluster.urgency > urgent.urgency) {
      urgent = cluster;
    }
    if (cluster.handled && Math.hypot(cluster.x - self.x, cluster.y - self.y) < 260) {
      handledNearby = true;
    }
  }
  const team = assessTeam(situation, handledNearby);
  const war = assessWar(situation, team);
  const risk = clamp(riskOfSituation(situation) + team.riskDelta, 0, 1);
  const objIntel = kind === 'hero' ? assessObjective(situation, { handledNearby, risk }) : undefined;

  const ranged = isRangedOf(self, situation.kit);
  const front =
    (self.role === 'frontliner' || self.role === 'tank') &&
    !(self.heroId === 'demon' && self.demonForm !== 'big');
  const support = self.role === 'support' || self.role === 'disruptor' || Boolean(situation.kit?.wantsProtect);
  const kit = situation.kit;
  const plan = situation.plan;
  const clusterRisk = clusterRiskOf(self, allies, enemies);
  const occupancy = occupancyOf(self, allies);
  const strain = ownStaminaStrain(self);
  const recovering = (situation.staminaTrend ?? 0) > 0.012 && self.staminaRatio < 0.62;
  const reserve = reserveGap(self);
  const fight = readFightShape({
    self,
    allies,
    enemies,
    clusterRisk,
    handledNearby,
    escapeOpen: situation.escapeOpen,
    strain,
  });
  const allyDanger = allies.some(
    (ally) => ally.kind === 'hero' && ally.hpRatio < 0.32 && (ally.recentlyHit || ally.attacking),
  );
  const visibleHeroes =
    situation.visibleHeroes ?? enemies.filter((enemy) => enemy.kind === 'hero' && enemy.visible).length;
  const allyHeroes = situation.allyHeroCount ?? allies.filter((ally) => ally.kind === 'hero').length;
  let count = 0;
  const tune = (action: TacticalAction, score: number): number =>
    warBiasAction(
      action,
      biasFightAction(action, biasAction(action, score, team, personality, self), fight, personality, self),
      team,
      war,
      self,
      personality,
    );

  const persist = (enemy: CombatantView, score: number): number =>
    enemy.id === situation.currentTargetId
      ? score + personality.persistence * 9 + personality.targetFixation * 4
      : score + personality.opportunism * 2;

  const ghostMul = (enemy: CombatantView): number => (enemy.visible ? 1 : TACTIC.ghostScoreMul);

  for (const enemy of enemies) {
    const d = dist(self, enemy);
    const iso = isolation(enemy, enemies);
    const pile = overkillWeight(enemy, allies, enemies);
    const press = pressOnEnemy(enemy, allies);
    const pocketMates = matesInPocket(enemy, allies);
    const selfInPocket = d <= pocketRadius(enemy) * 0.92;
    const meleeStay = selfInPocket && !canStrikeOutsidePocket(self, enemy) && pocketMates <= 1;
    const pileUse = meleeStay ? pile * 0.42 : pile;
    const victim = threatensAlly(enemy, allies);
    const distracted = Boolean(victim) || (enemy.attacking && enemy.lastAttackerId >= 0 && enemy.lastAttackerId !== self.id);
    const finishable = enemy.hpRatio <= TACTIC.finishHp && iso > 0.4;
    const stand = standoff(self, enemy, allies, enemies);
    const fleeing = retreatingFrom(enemy, self, situation.homeX);
    const range = self.attackRange;
    const vis = ghostMul(enemy);

    let attack = 36 - (d / situation.vision) * 34 + (1 - enemy.hpRatio) * 12 + iso * 12;
    attack -= pileUse * 58;
    attack -= risk * 20;
    attack += (self.hpRatio - 0.32) * 10;
    const alreadyHot = self.attacking || self.recentlyHit || d <= range * 1.14;
    const othersOn = press.allies.length + inboundOnEnemy(enemy, allies, press.allies) * 0.55;
    const coldJoin = !alreadyHot && othersOn >= 1 && !finishable && !(victim && victim.hpRatio < 0.38);
    if (coldJoin) {
      attack -= 10 + othersOn * (7 + personality.independence * 8);
      attack -= occupancy * (8 + personality.independence * 10);
    }
    if (!alreadyHot && !finishable && !victim) {
      if (d > range * 1.7) {
        attack -= 8 + personality.independence * 6;
      }
      if (occupancy > 0.28) {
        attack -= occupancy * (10 + personality.independence * 8);
      }
    } else {
      attack -= occupancy * (alreadyHot ? 2 : 6);
    }
    if (pileUse < 0.45) {
      if (victim) {
        attack += 12 + (1 - victim.hpRatio) * 10;
      }
      if (distracted) {
        attack += 8;
      }
    } else if (pileUse > 0.7) {
      attack -= 14;
    }
    if (stand) {
      attack -= 18;
    }
    if (ranged && d < range * 0.42) {
      attack -= 9;
    }
    if (!ranged && d < range * 1.25 && pileUse < 0.5) {
      attack += 7;
    }
    if (front && pileUse < 0.5) {
      attack += 4;
    }
    if (support && d < range * 1.2) {
      attack -= 6;
    }
    attack += (personality.aggression - 0.5) * 14;
    attack += (personality.riskTolerance - 0.5) * 6;
    if (kit?.stance === 'ranged' && d < (kit.comfortMin || range * 0.55)) {
      attack -= 14;
    }
    if (kind === 'minion' && pileUse < 0.5) {
      attack += 4;
    }
    if (enemy.kind === 'minion') {
      const pack = minionPackSize(enemy, enemies);
      const heroNearMinion = enemies.some(
        (other) => other.kind === 'hero' && other.visible && dist(other, enemy) < 210,
      );
      if (pack >= 3 && !heroNearMinion) {
        attack -= 12 + (isAoeFarmer(self.heroId) ? 6 : 0);
      } else if (pack <= 1 && d > 220) {
        attack -= 14;
      }
    }
    if (self.hpRatio < personality.retreatHp && pileUse < 0.4 && !finishable) {
      const poke =
        d > self.attackRange * 0.55 && d <= self.attackRange * 1.2 && risk < 0.6 && self.attackRange > 120;
      if (poke) {
        attack += 10;
      } else {
        attack -= 14;
      }
    }
    if (fleeing && d > range * 2.2) {
      attack -= 16;
    }
    if (d > range * 3.2) {
      attack -= 12;
    }
    if (enemy.blocking) {
      attack -= 16 + personality.caution * 10;
      attack += personality.aggression * 5;
    }
    const lull = inferredLull(enemy, self, situation.homeX);
    const inStrike = d <= range * 1.14;
    const zone = threatZoneCost(self, enemy, allies, kit, d);
    const zoneUse = meleeStay ? zone * 0.35 : zone;
    const future = futurePositionCost({
      self,
      enemy,
      zone: zoneUse,
      strain,
      clusterRisk,
      escapeOpen: situation.escapeOpen,
      finishable,
      isolation: iso,
    });
    const spent = reserve * (finishable || victim ? 0.25 : 1);
    const trade = lifeTradeCost({
      self,
      finishable,
      isolation: iso,
      victim,
      enemyKind: enemy.kind,
    });
    const opening = opportunityOf({
      self,
      enemy,
      allies,
      enemies,
      kit,
      isolation: iso,
      pile: pileUse,
      zone: zoneUse,
      distance: d,
      escapeOpen: situation.escapeOpen,
    });
    const pending = setupPending({ self, enemy, allies, kit, distance: d });
    if (!finishable && !victim) {
      const cheapStrain = inStrike && (enemy.hpRatio < 0.4 || enemy.recentlyHit || enemy.stunned || (enemy.slowLeftMs ?? 0) > 80);
      const strainMul = cheapStrain ? 3 + personality.caution * 3 : 12 + personality.caution * 8;
      attack -= strain * strainMul;
      attack -= clusterRisk * (meleeStay ? 2 : inStrike && cheapStrain ? 3 : 8);
    } else {
      attack -= strain * 2;
      attack -= clusterRisk * (meleeStay ? 1 : 3);
    }
    attack -= zoneUse * (inStrike ? 16 + personality.caution * 8 : 10 + personality.caution * 6);
    attack -= future * 18;
    attack -= spent * (10 + personality.abilityConservation * 6);
    attack -= trade * 28;
    attack += opening.payoff * (16 + personality.opportunism * 10);
    if (opening.value > 0.3 && opening.risk > 0.52 && !finishable && !victim) {
      attack -= opening.risk * (6 + personality.caution * 8);
    }
    attack -= pending * Math.max(0, 16 + personality.patience * 12 - personality.opportunism * 14);
    if (pocketMates >= 1 && d <= range * 1.35 && !meleeStay) {
      attack -= 6 + pocketMates * 5;
    }
    if (inStrike && pileUse < 0.55) {
      const commitBonus =
        strain > 0.7 && enemy.hpRatio > 0.32 ? 2 : 8 + (kit?.pressureBias ?? personality.aggression) * 8;
      attack += commitBonus;
      if (meleeStay) {
        attack += 10;
      }
      if (enemy.recentlyHit || enemy.stunned || opening.locked > 0.35) {
        attack += 8;
      }
      if (self.heroId === 'shadow' && !isShadowDry(self.heroId, self) && (strain < 0.72 || enemy.hpRatio < 0.3)) {
        attack += 10;
      }
    }
    if (lull > 0.28) {
      if (strain < 0.48 && self.hpRatio > 0.26) {
        attack += lull * 9;
      } else {
        attack -= lull * 5;
      }
      if (clusterRisk > 0.35) {
        attack -= 5;
      }
    }
    if (isShadowDry(self.heroId, self) && enemy.kind === 'hero') {
      attack -= 26 + personality.caution * 8;
    }
    if (isRopeDisarmed(self.heroId, self) && d < range * 0.72) {
      attack -= 14;
    }
    if (objIntel && enemy.kind === 'hero') {
      const enemyOnObj = Math.hypot(enemy.x - objIntel.x, enemy.y - objIntel.y) < objIntel.radius + 90;
      if (isZoneObjective(objIntel.kind) && objIntel.inside && !enemyOnObj) {
        attack -= 12;
      }
      if (objIntel.free && handledNearby) {
        attack -= 10;
      }
      if (objIntel.play === 'defend_objective' && enemyOnObj) {
        attack += 10;
      }
      if (!alreadyHot && (objIntel.free || objIntel.urgency >= 0.58) && !enemyOnObj) {
        attack -= 8 + objIntel.urgency * 8 + personality.opportunism * 4;
      }
    }
    if (enemy.kind === 'hero') {
      if (war.clock === 'last_seconds' || war.clock === 'closing') {
        attack += 4;
        if (enemy.hpRatio < 0.4) {
          attack += 5;
        }
      }
      if (war.levelLead <= -1.4 && enemy.hpRatio > 0.72 && iso < 0.4 && !finishable) {
        attack -= 8;
      }
      if (war.levelLead <= -1.4 && iso > 0.55 && enemy.hpRatio < 0.35) {
        attack += 9;
      }
    }
    const attackWhy =
      pileUse > 0.7
        ? 'already handled'
        : coldJoin
          ? 'fight already staffed'
          : occupancy > 0.42
            ? 'clustered'
            : zoneUse > 0.55
              ? 'bad range to trade'
              : pending > 0.4
                ? 'wait the setup'
                : opening.payoff > 0.35
                  ? 'take the opening'
                  : enemy.blocking
                    ? 'shield up'
                    : victim
                      ? 'press the threat'
                      : !alreadyHot && d > range * 1.7
                        ? 'visible, not worth the walk'
                        : 'take the fight';
    count = write(out, count, 'attack', tune('attack', persist(enemy, attack * vis)), attackWhy, enemy.id);

    if (enemy.hpRatio <= TACTIC.finishHp) {
      let finish = 26 + (TACTIC.finishHp - enemy.hpRatio) * 90 + iso * 18;
      finish -= pile * 50;
      finish -= (d / situation.vision) * 18;
      if (self.hpRatio < 0.22 && iso > 0.7 && enemy.hpRatio < 0.1 && situation.escapeOpen && pile < 0.4) {
        finish += 30;
      } else if (self.hpRatio < 0.2 && iso < 0.45) {
        finish -= 22;
      }
      if (protectorsOf(enemy, enemies).length > 0 && enemy.hpRatio > 0.08) {
        finish -= 16;
      }
      if (iso > 0.55 && enemy.hpRatio < 0.3 && war.levelLead <= -1) {
        finish += 10;
      }
      if (war.clock === 'last_seconds') {
        finish += 8;
      }
      finish += personality.aggression * 6;
      if (isShadowDry(self.heroId, self)) {
        finish -= 18;
      }
      finish -= strain * 4;
      finish -= future * 8;
      finish += opening.payoff * 8;
      if (opening.risk > 0.6 && iso < 0.45) {
        finish -= 8;
      }
      finish -= zone * (canStrikeOutsidePocket(self, enemy) ? 10 : 3);
      if (!inStrike) {
        finish -=
          chaseQualityCost({
            self,
            enemy,
            allies,
            enemies,
            homeX: situation.homeX,
            pile,
            strain,
            zone,
            escapeOpen: situation.escapeOpen,
          }) * 20;
      }
      if (strain > 0.7 && enemy.hpRatio > 0.08) {
        finish -= 8;
      }
      count = write(out, count, 'finish_target', tune('finish_target', persist(enemy, finish * vis)), pile > 0.7 ? 'already handled' : 'finishable', enemy.id);
    }

    if ((distracted || press.allies.length >= 1) && self.hpRatio > 0.22 && pile < 0.75) {
      const facing = enemy.aimX * (self.x - enemy.x) + enemy.aimY * (self.y - enemy.y);
      let flank = 16 + iso * 8;
      if (distracted) {
        flank += 18;
      }
      if (facing > 0) {
        flank += 7;
      }
      if (risk > 0.55) {
        flank -= 14;
      }
      flank -= pile * 12;
      flank += personality.flankTendency * 18;
      if (kit?.wantsFlank) {
        flank += 6;
      }
      if (pocketMates >= 1 && !meleeStay) {
        flank += 8 + personality.flankTendency * 6;
      }
      if (meleeStay) {
        flank -= 10;
      }
      if (zone > 0.4 && !canStrikeOutsidePocket(self, enemy)) {
        flank += 6;
      }
      if (isShadowDry(self.heroId, self) && enemy.kind === 'hero') {
        flank -= 16;
      }
      flank -= strain * 10;
      flank -= clusterRisk * 4;
      if (ranged) {
        flank -= 4;
      }
      if (ranged && d >= (kit?.comfortMin ?? range * 0.55) && d <= range * 1.15) {
        flank -= 12;
      }
      if (kind === 'minion' && ranged) {
        flank -= 8;
      }
      if (support) {
        flank += 8;
      }
      if (occupancy > 0.28 || pocketMates >= 1) {
        flank += 6 + occupancy * 8 + personality.flankTendency * 4;
      }
      if (opening.payoff > 0.2 && pileUse > 0.32) {
        flank += opening.payoff * 10 + personality.flankTendency * 4;
      }
      if (pending > 0.4) {
        flank -= pending * 6;
      }
      count = write(out, count, 'flank', tune('flank', persist(enemy, flank * vis)), 'better angle', enemy.id);
    }

    if (fleeing) {
      let chase = 22 + (1 - enemy.hpRatio) * 16 - (d / situation.vision) * 32;
      chase -= pile * 24;
      chase -= risk * 16;
      chase -=
        chaseQualityCost({
          self,
          enemy,
          allies,
          enemies,
          homeX: situation.homeX,
          pile,
          strain,
          zone,
          escapeOpen: situation.escapeOpen,
        }) * 22;
      chase -= spent * 8;
      chase -= trade * 16;
      if (d > situation.vision * 0.72) {
        chase -= 18;
      }
      if (self.hpRatio < 0.28) {
        chase -= 16;
      }
      if (self.hpRatio < 0.34 && enemy.hpRatio > 0.4) {
        chase -= 12;
      }
      chase += personality.aggression * 8 + personality.persistence * 6;
      if (isShadowDry(self.heroId, self) && enemy.kind === 'hero') {
        chase -= 20;
      }
      if (isRopeDisarmed(self.heroId, self)) {
        chase -= 12;
      }
      chase -= strain * (14 + personality.caution * 6);
      chase -= clusterRisk * 6;
      if (lull > 0.28 && enemy.hpRatio < 0.45 && strain < 0.4) {
        chase += lull * 10;
      } else if (lull > 0.28 && strain > 0.45) {
        chase -= lull * 10;
      }
      if (strain > 0.55 && enemy.hpRatio > 0.22) {
        chase -= 10;
      }
      if (opening.locked > 0.35 && opening.risk < 0.48) {
        chase += opening.payoff * 8;
      } else if (opening.life < 0.12 && fleeing) {
        chase -= 6;
      }
      if (objIntel && isZoneObjective(objIntel.kind) && objIntel.inside) {
        const enemyOnObj = Math.hypot(enemy.x - objIntel.x, enemy.y - objIntel.y) < objIntel.radius + 80;
        if (!enemyOnObj) {
          chase -= 24;
        }
      }
      count = write(out, count, 'chase', tune('chase', persist(enemy, chase * vis)), 'pursue', enemy.id);
    }

    const incomingAlly = allies.find((ally) => movingToward(enemy, ally.x, ally.y) && dist(enemy, ally) < 420 && !engagedWith(enemy, ally));
    const incomingSelf = movingToward(enemy, self.x, self.y) && d < 460 && d > range * 1.1;
    const incomingObj =
      Boolean(objIntel) &&
      enemy.kind === 'hero' &&
      enemy.visible &&
      movingToward(enemy, objIntel!.x, objIntel!.y) &&
      Math.hypot(enemy.x - objIntel!.x, enemy.y - objIntel!.y) > objIntel!.radius &&
      Math.hypot(enemy.x - objIntel!.x, enemy.y - objIntel!.y) < 540;
    if (incomingAlly || incomingSelf || incomingObj) {
      let intercept = 24 + (incomingAlly ? 14 : incomingObj ? 12 : 6) - (d / situation.vision) * 16;
      intercept -= pile * 8;
      intercept -= strain * 6;
      if (handledNearby && incomingAlly) {
        intercept += 12;
      }
      if (press.allies.length >= 2 && pile > 0.5) {
        intercept += 16;
      }
      intercept += personality.assistTendency * 8;
      if (opening.locked > 0.28 || fleeing) {
        intercept += 6 + opening.payoff * 8;
        if (kit && !kit.wantsFlank && (kit.stance === 'melee' || self.role === 'tank')) {
          intercept += 8;
        }
      }
      if (incomingObj && objIntel) {
        intercept += 10 + objIntel.urgency * 12;
        const toObj = Math.hypot(objIntel.x - enemy.x, objIntel.y - enemy.y) || 1;
        const cutX = enemy.x + ((objIntel.x - enemy.x) / toObj) * Math.min(180, toObj * 0.45);
        const cutY = enemy.y + ((objIntel.y - enemy.y) / toObj) * Math.min(180, toObj * 0.45);
        const toCut = Math.hypot(cutX - self.x, cutY - self.y);
        if (toCut + 40 < objIntel.dist) {
          intercept += 10;
        }
        if (objIntel.alliesHandling || objIntel.inside) {
          intercept += 6;
        }
      }
      count = write(
        out,
        count,
        'intercept',
        tune('intercept', intercept * vis),
        incomingObj ? 'cut off objective run' : incomingAlly ? 'cut off reinforcement' : 'meet the approach',
        enemy.id,
        incomingAlly?.id ?? -1,
      );
    }

    if (pending > 0.28 && !inStrike) {
      let wait = 24 + pending * 22 + personality.patience * 8 - personality.opportunism * 8;
      if (kit?.wantsInitiate) {
        wait += 4;
      }
      wait -= opening.payoff * 14;
      count = write(out, count, 'wait_for_opening', tune('wait_for_opening', wait * vis), 'wait for the setup', enemy.id);
      count = write(out, count, 'hold_position', tune('hold_position', (wait - 4) * vis), 'hold for the setup', enemy.id);
    }

    const cutoff =
      Boolean(kit) &&
      !kit!.wantsFlank &&
      (kit!.stance === 'melee' || self.role === 'tank' || kit!.wantsProtect) &&
      (fleeing || opening.locked > 0.28) &&
      d < self.attackRange * 2.15 &&
      d > self.attackRange * 0.45 &&
      pileUse < 0.7;
    if (cutoff && (opening.payoff > 0.18 || fleeing)) {
      let hold = 12 + opening.payoff * 10 + personality.patience * 6;
      const nearestMate = allies.reduce((best, ally) => {
        if (ally.kind !== 'hero') {
          return best;
        }
        const gap = dist(self, ally);
        return gap < best ? gap : best;
      }, 9999);
      if (nearestMate > 140) {
        hold += 4;
      }
      count = write(out, count, 'hold_position', tune('hold_position', hold * vis), 'hold the cut', enemy.id);
      if (!incomingAlly && !incomingSelf && !incomingObj) {
        count = write(out, count, 'intercept', tune('intercept', (hold + 2) * vis), 'cut the retreat', enemy.id);
      }
    }

    if (pileUse > 0.52 && !meleeStay && opening.payoff > 0.18 && kit?.wantsFlank) {
      count = write(
        out,
        count,
        'reposition',
        tune('reposition', 10 + opening.payoff * 8 + personality.flankTendency * 6),
        'take another angle',
        enemy.id,
      );
    }

    if (situation.currentTargetId >= 0 && enemy.id !== situation.currentTargetId && pile < 0.45) {
      const current = enemies.find((item) => item.id === situation.currentTargetId);
      if (current) {
        const currentPile = overkillWeight(current, allies, enemies);
        const better = attack + 8 > 40 && (iso > isolation(current, enemies) + 0.25 || currentPile > pile + 0.35 || Boolean(victim));
        if (better) {
          count = write(out, count, 'switch_target', (attack + 6) * vis, 'better target', enemy.id);
        }
      }
    }
  }

  for (const ally of allies) {
    const foes: CombatantView[] = [];
    for (const enemy of enemies) {
      if (engagedWith(ally, enemy) || (enemy.lastAttackerId === ally.id && dist(ally, enemy) < 200)) {
        pushUnique(foes, enemy);
      }
    }
    if (foes.length === 0) {
      continue;
    }
    let foePower = 0;
    let allyHelp = 0;
    let helpPower = effectivePower(ally);
    for (const foe of foes) {
      foePower += effectivePower(foe);
    }
    for (const other of allies) {
      if (other === ally) {
        continue;
      }
      if (foes.some((foe) => engagedWith(other, foe) || dist(other, ally) < 130)) {
        allyHelp += 1;
        helpPower += effectivePower(other);
      }
    }
    const d = dist(self, ally);
    const inboundHelp = allies.filter(
      (other) =>
        other !== ally &&
        other.kind === 'hero' &&
        movingToward(other, ally.x, ally.y) &&
        dist(other, ally) < 300 &&
        dist(other, ally) > 70,
    ).length;
    const canSwing = helpPower + effectivePower(self) > foePower * 0.72;
    let assist = 14 + (foes.length - allyHelp) * 20 + (1 - ally.hpRatio) * 20;
    assist -= (d / situation.vision) * 28;
    if (allyHelp >= 2 && helpPower > foePower * 1.2) {
      assist -= 26;
    }
    if (allyHelp >= 1 && ally.hpRatio > 0.42 && helpPower > foePower * 0.95) {
      assist -= 12 + personality.independence * 16;
    }
    if (inboundHelp >= 1 && ally.hpRatio > 0.36) {
      assist -= inboundHelp * (8 + personality.independence * 8);
    }
    assist -= occupancy * (6 + personality.independence * 6);
    if (d < 96 && occupancy > 0.28) {
      assist -= 14 + occupancy * 12;
    }
    if (d > situation.vision * 0.52 && ally.hpRatio > 0.4) {
      assist -= 8 + personality.independence * 8;
    }
    if (foes.length >= 2 && allyHelp === 0) {
      assist += 18;
    }
    if (self.hpRatio < 0.2 && !canSwing) {
      assist -= 16;
    }
    if (canSwing && foes.length > allyHelp) {
      assist += 12;
    }
    assist += (personality.assistTendency - 0.4) * 16;
    assist += (personality.protectionInstinct - 0.5) * 10;
    const peel = peelWeight(self, ally, foes, kit);
    assist += peel * 10;
    if (support) {
      assist += 6;
    }
    if (self.hpRatio < 0.34 && d > self.attackRange * 0.5 && d < self.attackRange * 1.35) {
      assist += 10;
    }
    const focus = foes.reduce((best, foe) => (foe.hpRatio < best.hpRatio ? foe : best), foes[0]);
    count = write(out, count, 'assist_ally', tune('assist_ally', assist), foes.length > allyHelp + 1 ? 'outnumbered ally' : 'help the fight', focus.id, ally.id);

    const pursuers = foes.filter((foe) => movingToward(foe, ally.x, ally.y) || engagedWith(foe, ally));
    if ((ally.hpRatio < 0.34 && pursuers.length > 0) || (peel > 0.42 && pursuers.length > 0)) {
      let protect = 18 + (1 - ally.hpRatio) * 28 - (d / situation.vision) * 20;
      protect += pursuers.length * 6;
      protect += personality.assistTendency * 8;
      protect += peel * 12;
      if (self.hpRatio < 0.18) {
        protect -= 12;
      }
      const piled = allies.filter((other) => other !== ally && dist(other, ally) < 86).length;
      if (piled >= 1) {
        protect -= 10 * piled;
      }
      protect -= occupancy * 8;
      if (ally.hpRatio > 0.48 && allyHelp >= 1) {
        protect -= 10 + personality.independence * 8;
      }
      count = write(out, count, 'protect_ally', tune('protect_ally', protect), 'cover retreat', pursuers[0].id, ally.id);
    }
  }

  if (urgent && urgent.urgency > 34 && urgent.allies.length > 0 && urgent.allies.length <= urgent.enemies.length) {
    const focus = urgent.enemies[0];
    const already = urgent.allies.some((ally) => ally.id === self.id);
    if (!already && dist(self, { ...self, x: urgent.x, y: urgent.y }) < situation.vision * 1.15) {
      let extra = 10 + urgent.urgency * 0.35 - (Math.hypot(urgent.x - self.x, urgent.y - self.y) / situation.vision) * 12;
      extra -= occupancy * (10 + personality.independence * 12);
      extra -= personality.independence * 8;
      if (urgent.allies.length >= 2) {
        extra -= 10;
      }
      count = write(out, count, 'assist_ally', tune('assist_ally', extra), 'urgent fight', focus?.id ?? -1, urgent.allies[0]?.id ?? -1);
    }
  }

  let disengage = risk * 48 + (personality.caution - 0.35) * 14;
  if (self.hpRatio < personality.retreatHp) {
    disengage += 16;
  }
  if (self.hpRatio < TACTIC.criticalHp) {
    disengage += 14;
  }
  const bestFinish = enemies.some((enemy) => enemy.hpRatio < 0.1 && isolation(enemy, enemies) > 0.7 && dist(self, enemy) < self.attackRange * 1.6);
  if (bestFinish && situation.escapeOpen) {
    disengage -= 18;
  }
  if (handledNearby && self.hpRatio < 0.4) {
    disengage += 6;
  }
  disengage -= personality.aggression * 8;
  disengage += (personality.retreatWillingness - 0.5) * 10;
  if (team.outnumbered && team.localEnemies >= 2) {
    disengage += 10;
  }
  if (team.outnumbered && team.localEnemies >= 3) {
    disengage += 12;
  }
  if ((self.role === 'tank' || self.role === 'frontliner') && !(self.heroId === 'demon' && self.demonForm !== 'big') && self.hpRatio > 0.4 && !(team.outnumbered && team.localEnemies >= 3)) {
    disengage -= 14;
  }
  disengage += strain * (8 + personality.retreatWillingness * 8);
  if (strain > 0.7 && !bestFinish && !allyDanger) {
    disengage += 8;
  }
  if (recovering && risk < 0.45 && !self.recentlyHit) {
    disengage -= 6;
  }
  if (!self.recentlyHit && self.hpRatio > personality.retreatHp + 0.14 && risk < 0.48) {
    disengage -= 8;
  }
  if (fight === 'unfavorable' && !bestFinish && self.hpRatio > 0.28) {
    disengage += 8 + personality.caution * 6;
  }
  if (objIntel && objIntel.urgency >= 0.7 && !self.attacking && occupancy > 0.28) {
    disengage += 6;
  }
  const disengageWhy = fight === 'collapse' || risk >= 0.7 ? 'bad fight' : fight === 'unfavorable' ? 'poor trade' : occupancy > 0.45 ? 'reset spacing' : 'reset';
  count = write(out, count, 'retreat', tune('retreat', disengage), disengageWhy);
  if (risk >= 0.7 || fight === 'collapse' || (self.hpRatio < TACTIC.criticalHp && risk >= 0.45) || (team.outnumbered && team.localEnemies >= 3 && self.hpRatio < 0.85)) {
    count = write(out, count, 'escape', tune('escape', disengage + 8 + (self.recentlyHit ? 6 : 0) + (fight === 'collapse' ? 6 : 0)), 'survive');
  }

  if (kind === 'hero' && self.hpRatio < TACTIC.recoverHp) {
    const closeHero = enemies.some((enemy) => enemy.kind === 'hero' && enemy.visible && dist(self, enemy) < 180);
    let recover = 10 + (1 - self.hpRatio) * 24;
    if (!closeHero) {
      recover += 20;
    } else {
      recover -= 16;
    }
    if (self.hpRatio < TACTIC.criticalHp && !closeHero) {
      recover += 12;
    }
    count = write(out, count, 'recover', recover, closeHero ? 'need space first' : 'recover');
  }

  if (kind === 'hero' && isShadowDry(self.heroId, self)) {
    const closeHero = enemies.some((enemy) => enemy.kind === 'hero' && enemy.visible && dist(self, enemy) < 240);
    if (closeHero) {
      let recover = 24 + (1 - self.staminaRatio) * 16 + personality.caution * 8;
      recover += (1 - self.hpRatio) * 6;
      count = write(out, count, 'recover', recover, 'no kit left');
      count = write(out, count, 'reposition', recover - 2, 'disengage dry');
    }
  }

  if (kind === 'hero' && strain > 0.58 && !allyDanger) {
    const closeHero = enemies.some((enemy) => enemy.kind === 'hero' && enemy.visible && dist(self, enemy) < 170);
    const finishNear = enemies.some(
      (enemy) => enemy.hpRatio < 0.12 && dist(self, enemy) < self.attackRange * 1.5,
    );
    const meleeCommit = enemies.some(
      (enemy) =>
        dist(self, enemy) <= self.attackRange * 1.12 &&
        (enemy.hpRatio < 0.34 || enemy.recentlyHit || enemy.stunned || (kit?.stance === 'melee' && strain < 0.78)),
    );
    if (!finishNear && !meleeCommit) {
      let recover = 6 + strain * 16 + personality.caution * 6;
      if (!closeHero) {
        recover += 10;
      } else {
        recover -= 8;
      }
      if (recovering) {
        recover += 4;
      }
      count = write(out, count, 'recover', recover, 'breathe');
      count = write(out, count, 'reposition', recover - 1, 'reset stamina');
      count = write(out, count, 'wait_for_opening', recover - 2, 'wait the bar out');
    }
  }

  const stuckAtEdge = atFarEdge(self.team, self.x);
  const healPick = kind === 'hero' ? pickHealMinion(situation) : undefined;
  const farmTarget = healPick?.minion;
  let nearestMinion: CombatantView | undefined = farmTarget;
  let minionGap = farmTarget ? dist(self, farmTarget) : 1e9;
  if (!nearestMinion) {
    for (const enemy of enemies) {
      if (enemy.kind !== 'minion' || !enemy.visible) {
        continue;
      }
      const d = dist(self, enemy);
      if (d < minionGap) {
        nearestMinion = enemy;
        minionGap = d;
      }
    }
  }
    if (nearestMinion && (kind === 'hero' || stuckAtEdge)) {
    const cluster = nearestMinion;
    const heroThreat = enemies.some(
      (enemy) => enemy.kind === 'hero' && enemy.visible && dist(enemy, cluster) < 210,
    );
    const selfPressed = enemies.some(
      (enemy) => enemy.kind === 'hero' && enemy.visible && dist(self, enemy) < self.attackRange * 1.45 + 36,
    );
    let farmScore = 12 + (handledNearby ? 8 : 0) - (minionGap / situation.vision) * 10;
    if (healPick) {
      farmScore += Math.min(22, healPick.score * 0.28);
    }
    if (self.hpRatio > 0.12 && self.hpRatio < 0.72 && !heroThreat) {
      farmScore += 16;
    }
    if (self.hpRatio < 0.42 && healPick && !heroThreat && !selfPressed) {
      farmScore += 12 + (1 - self.hpRatio) * 20;
    }
    if (self.staminaRatio < 0.3 && !heroThreat) {
      farmScore += 10 + personality.caution * 6;
    }
    if (heroThreat) {
      farmScore -= 16;
    }
    if (!selfPressed && !self.recentlyHit) {
      farmScore += 6 + personality.independence * 8;
      if (heroThreat) {
        farmScore += 8;
      }
    }
    if (selfPressed && self.hpRatio < 0.34) {
      farmScore -= 18;
    }
    if (self.hpRatio < 0.14 && heroThreat) {
      farmScore -= 10;
    }
    if (stuckAtEdge) {
      farmScore += 18;
    }
    const packSize = minionPackSize(cluster, enemies);
    if (objIntel && objIntel.free && objIntel.canArriveInTime && self.hpRatio > 0.26 && !stuckAtEdge) {
      const dump = 8 + personality.opportunism * 18 + objIntel.urgency * (6 + personality.opportunism * 8);
      farmScore -= packSize >= 3 && !heroThreat ? dump * (0.35 + personality.opportunism * 0.55) : dump;
    } else if (objIntel && objIntel.urgency >= 0.72 && objIntel.canArriveInTime && !objIntel.tooLate) {
      farmScore -= 14;
    } else if (objIntel && objIntel.alliesHandling) {
      farmScore += 4;
    }
    if (packSize >= 3) {
      farmScore += 10 + packSize + (isAoeFarmer(self.heroId) ? 8 : 3);
      if (!heroThreat && !selfPressed) {
        farmScore += 8;
      }
    } else if (packSize <= 1 && minionGap > 240) {
      farmScore -= 16;
    }
    if (self.recentlyHit && (heroThreat || selfPressed)) {
      farmScore -= 12;
    }
    const underleveled = (self.level ?? 1) < 3 || ((self.level ?? 1) <= 4 && (self.xpRatio ?? 0) > 0.7);
    if (underleveled && !heroThreat && !selfPressed) {
      farmScore += 6;
    }
    if ((self.level ?? 1) >= 5 && packSize <= 2 && minionGap > 160) {
      farmScore -= 8;
    }
    if (nearestMinion.power > self.power * 1.2) {
      farmScore -= 8;
    }
    if (minionGap > situation.vision * 0.68) {
      farmScore -= 12;
    }
    if (war.xpSoon && packSize >= 2 && !heroThreat) {
      farmScore += 6;
    }
    if (war.clock === 'early' && !heroThreat && !objIntel) {
      farmScore += 4;
    }
    if (war.clock === 'last_seconds') {
      farmScore -= 16;
    } else if (war.clock === 'closing' && team.scoreLead < 0) {
      farmScore -= 10;
    }
    const remainingMs = situation.remainingMs;
    if (remainingMs !== undefined && remainingMs > MATCH.durationMs - 60_000) {
      farmScore += 4;
    }
    const lead = (situation.teamScore?.self ?? 0) - (situation.teamScore?.enemy ?? 0);
    if (remainingMs !== undefined && remainingMs <= 30_000 && lead < 0) {
      farmScore -= 10;
    }
    count = write(
      out,
      count,
      'farm_minions',
      tune('farm_minions', farmScore),
      objIntel?.free && !stuckAtEdge
        ? 'objective beats farm'
        : heroThreat
          ? 'minions are hot'
          : healPick && self.hpRatio < 0.42
            ? 'safe minion heal'
            : stuckAtEdge
              ? 'farm instead of the wall'
              : 'farm and recover',
      nearestMinion.id,
    );
  }

  const standEnemy = enemies.find((enemy) => standoff(self, enemy, allies, enemies) && dist(self, enemy) < self.attackRange * 2.1);
  if (standEnemy) {
    const d = dist(self, standEnemy);
    const inStrike = d <= self.attackRange * 1.12;
    let wait = 20 + personality.caution * 10;
    if (self.hpRatio > 0.6 && standEnemy.hpRatio > 0.55) {
      wait += 12;
    }
    if (d < standEnemy.attackRange * 1.05 && !self.canAttack) {
      wait += 6;
    }
    wait -= personality.aggression * 8;
    wait += strain * 10;
    wait += clusterRisk * 6;
    if (inferredLull(standEnemy, self, situation.homeX) > 0.3 && strain > 0.4) {
      wait += 6;
    }
    if (standEnemy.blocking) {
      wait += 14 + personality.patience * 8;
    }
    if (inStrike && !ranged) {
      wait -= 16 + (kit?.pressureBias ?? 0.5) * 10;
    }
    if (!inStrike || ranged || wait > 14) {
      count = write(out, count, 'wait_for_opening', wait, standEnemy.blocking ? 'wait out the shield' : 'size them up', standEnemy.id);
      count = write(out, count, 'hold_position', wait - 3, 'hold range', standEnemy.id);
    }
    let repo = 16 + (ranged ? 8 : 0);
    if (d < self.attackRange * 0.5 && ranged) {
      repo += 10;
    }
    count = write(out, count, 'reposition', repo, 'better spot', standEnemy.id);
  } else if (ranged && enemies.some((enemy) => dist(self, enemy) < self.attackRange * 0.5)) {
    count = write(out, count, 'reposition', 18 + personality.caution * 6, 'make space', enemies[0]?.id ?? -1);
  } else if (support && enemies.some((enemy) => dist(self, enemy) < self.attackRange * 1.15)) {
    let repo = 16 + personality.flankTendency * 8;
    if (isRopeDisarmed(self.heroId, self)) {
      repo += 10;
    }
    count = write(out, count, 'reposition', repo, "don't trade", enemies[0]?.id ?? -1);
  }

  if (kind === 'hero' && (clusterRisk > 0.24 || occupancy > 0.32)) {
    count = write(
      out,
      count,
      'reposition',
      tune('reposition', 10 + clusterRisk * 20 + occupancy * 14 + personality.caution * 6 + personality.independence * 6),
      occupancy > 0.36 ? 'break the stack' : 'break the stack',
      enemies[0]?.id ?? -1,
    );
  }
  const localHeroes = enemies.filter(
    (enemy) => enemy.kind === 'hero' && enemy.visible && dist(self, enemy) < 210,
  ).length;
  if (kind === 'hero' && localHeroes >= 3 && occupancy > 0.2) {
    count = write(
      out,
      count,
      'reposition',
      tune('reposition', 12 + occupancy * 10 + personality.caution * 8),
      'predicted ult zone',
      enemies[0]?.id ?? -1,
    );
  }

  if (kind === 'hero') {
    let worstZone = 0;
    let zoneFoe: CombatantView | undefined;
    for (const enemy of enemies) {
      if (enemy.kind !== 'hero' || !enemy.visible) {
        continue;
      }
      const z = threatZoneCost(self, enemy, allies, kit, dist(self, enemy));
      if (z > worstZone) {
        worstZone = z;
        zoneFoe = enemy;
      }
    }
    if (zoneFoe && worstZone > 0.42) {
      const keepRange = canStrikeOutsidePocket(self, zoneFoe);
      let wait = 8 + worstZone * 16 + personality.caution * 6;
      if (keepRange) {
        wait += 8;
      }
      if (fight === 'even' || fight === 'unfavorable') {
        wait += 6;
      }
      if (self.role === 'tank' || self.role === 'frontliner') {
        wait -= 8;
      }
      wait -= personality.aggression * 5;
      count = write(out, count, 'wait_for_opening', tune('wait_for_opening', wait), 'hold a better range', zoneFoe.id);
      count = write(
        out,
        count,
        'reposition',
        tune('reposition', wait + (keepRange ? 6 : 2)),
        keepRange ? 'stay outside their range' : 'take a better angle',
        zoneFoe.id,
      );
    }
  }

  const farm = handledNearby || (urgent?.handled ?? false) || enemies.length === 0;
  const lane = kind === 'minion' ? 34 : 20;
  let push = lane + (farm ? 22 : 0);
  if (enemies.length === 0) {
    push += kind === 'minion' ? 10 : 2;
  }
  if (kind === 'hero' && visibleHeroes === 0) {
    push -= 26;
    if (situation.lastSurvivor) {
      push -= 12;
    }
  }
  if (plan && plan.state === 'opening' && plan.opening !== 'rush_center' && plan.opening !== 'controlled_advance') {
    push -= 14;
  }
  if (risk > 0.5) {
    push -= 8;
  }
  if (stuckAtEdge) {
    push -= 36;
  }
  if (kind === 'minion') {
    count = write(
      out,
      count,
      'push_lane',
      push,
      stuckAtEdge ? 'already at the end' : farm ? 'lane is open' : 'keep pressure',
    );
  } else {
    count = write(
      out,
      count,
      'advance',
      push - 2,
      stuckAtEdge ? 'already at the end' : farm ? 'look elsewhere' : 'move up',
    );
  }
  if (enemies.length === 0) {
    const hunt = 28 + (kind === 'hero' ? 10 : 0) + (stuckAtEdge ? 20 : 0);
    count = write(
      out,
      count,
      'search_for_target',
      hunt,
      stuckAtEdge ? 'hunt another lane' : 'no one in sight',
    );
  } else if (farm && kind === 'hero') {
    count = write(
      out,
      count,
      'search_for_target',
      22 + (stuckAtEdge ? 10 : 0),
      stuckAtEdge ? 'hunt another lane' : 'fight is handled',
    );
  }

  if (kind === 'hero' && situation.isolated && allyHeroes > 0 && !situation.lastSurvivor) {
    let regroup = 20 + personality.teamwork * 16 + personality.caution * 8;
    if (self.hpRatio < 0.5) {
      regroup += 10;
    }
    if (visibleHeroes >= 2) {
      regroup += 8;
    }
    const buddy = allies
      .filter((ally) => ally.kind === 'hero')
      .reduce((best, ally) => {
        const d = dist(self, ally);
        return !best || d < best.d ? { ally, d } : best;
      }, undefined as { ally: CombatantView; d: number } | undefined);
    count = write(out, count, 'regroup', tune('regroup', regroup), 'find spacing with the team', -1, buddy?.ally.id ?? -1);
  }

  if (situation.lastSurvivor) {
    count = write(out, count, 'recover', 22 + (1 - self.hpRatio) * 10, 'last alive, stall');
    count = write(out, count, 'hold_position', 16 + personality.patience * 8, 'last alive, wait');
  }

  if (situation.projectile?.willHit) {
    count = write(out, count, 'reposition', 40 + personality.reactionQuality * 8, 'dodge shot');
    count = write(out, count, 'escape', 24 + (self.hpRatio < 0.35 ? 8 : 0), 'shot incoming');
  }

  const hazard = nearestIncomingHazard(situation, self);
  if (hazard) {
    const panic = 38 + personality.reactionQuality * 10 + (self.hpRatio < 0.4 ? 8 : 0);
    count = write(out, count, 'reposition', panic, 'dodge meteor');
    count = write(out, count, 'escape', 22 + (self.hpRatio < 0.35 ? 8 : 0), 'meteor incoming');
  }

  if (kind === 'hero' && objIntel) {
    count = scoreObjective(out, count, situation, objIntel, team, risk, ranged, front, support, tune);
  }

  if (kind === 'hero') {
    count = applySupportBias(out, count, situation, tune);
    count = applyDemonBias(out, count, situation, write);
    count = applyEnvBias(out, count, situation, write);
  }

  if (plan && kind === 'hero') {
    count = applyPlanBias(out, count, plan, visibleHeroes, personality);
  }

  return count;
};

const applySupportBias = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  tune: (action: TacticalAction, score: number) => number,
): number => {
  if (!situation.hasAllySupport) {
    return count;
  }
  const read = assessSupport(situation);
  const ally = read.ally;
  for (let i = 0; i < count; i += 1) {
    const row = out[i];
    if (read.need > 14 && row.action === 'farm_minions') {
      row.score -= 18 + read.need * 0.35;
    }
    if (read.mode === 'save' && (row.action === 'chase' || row.action === 'flank' || row.action === 'farm_minions')) {
      row.score -= 16;
    }
    if (read.mode === 'attack' && read.need < 8 && row.action === 'protect_ally') {
      row.score -= 10;
    }
    if (read.mode === 'save' && situation.self.hpRatio < 0.18 && (row.action === 'attack' || row.action === 'finish_target')) {
      row.score -= 8;
    }
  }
  if (!ally) {
    return count;
  }
  const nearestFoe = situation.enemies.reduce((best, enemy) => {
    if (!enemy.visible) {
      return best;
    }
    const d = dist(situation.self, enemy);
    return !best || d < best.d ? { enemy, d } : best;
  }, undefined as { enemy: CombatantView; d: number } | undefined);
  const foeId = nearestFoe?.enemy.id ?? -1;
  if (read.mode === 'attack') {
    if (nearestFoe && nearestFoe.d < situation.self.attackRange * 1.25) {
      count = write(out, count, 'attack', tune('attack', 12 + situation.personality.aggression * 6), 'stable team poke', foeId, ally.id);
    }
    return count;
  }
  if (read.mode === 'mix') {
    count = write(
      out,
      count,
      'assist_ally',
      tune('assist_ally', 18 + read.need * 0.45 + situation.personality.protectionInstinct * 6),
      read.reason,
      foeId,
      ally.id,
    );
    count = write(
      out,
      count,
      'attack',
      tune('attack', 14 + situation.personality.aggression * 8),
      'keep firing',
      foeId,
      ally.id,
    );
    return count;
  }
  const protect = 22 + read.need * 0.7 + situation.personality.protectionInstinct * 10;
  count = write(out, count, 'protect_ally', tune('protect_ally', protect), read.reason, foeId, ally.id);
  if (read.mode === 'support') {
    count = write(out, count, 'assist_ally', tune('assist_ally', protect - 6), 'stay with the fight', foeId, ally.id);
  }
  return count;
};

const scoreObjective = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  intel: ObjectiveIntel,
  team: TeamIntel,
  risk: number,
  ranged: boolean,
  front: boolean,
  support: boolean,
  tune: (action: TacticalAction, score: number) => number,
): number => {
  const obj = situation.objective;
  if (!obj) {
    return count;
  }
  const { self, personality, allies, enemies } = situation;
  const d = intel.dist;
  const between = enemies.filter((enemy) => {
    if (enemy.kind !== 'hero' || !enemy.visible) {
      return false;
    }
    const toObjX = intel.x - self.x;
    const toObjY = intel.y - self.y;
    const span = Math.hypot(toObjX, toObjY) || 1;
    const t = ((enemy.x - self.x) * toObjX + (enemy.y - self.y) * toObjY) / (span * span);
    if (t <= 0.08 || t >= 0.92) {
      return false;
    }
    const px = self.x + toObjX * t;
    const py = self.y + toObjY * t;
    return Math.hypot(enemy.x - px, enemy.y - py) < 70;
  }).length;

  let contest = 18 + intel.urgency * 28 - (d / Math.max(180, situation.vision)) * 12;
  contest += (personality.aggression - 0.5) * 10;
  contest += (personality.opportunism - 0.5) * 10;
  contest -= (personality.caution - 0.5) * 8;
  contest -= risk * 18;
  contest -= intel.risk * 10;
  if (self.hpRatio < personality.retreatHp) {
    contest -= 18;
  }
  if (self.hpRatio < TACTIC.criticalHp) {
    contest -= 16;
  }
  contest -= ownStaminaStrain(self) * 8;
  if (situation.isolated && intel.occAllies === 0 && intel.dangerous) {
    contest -= 12 + personality.caution * 8;
  }
  if (between >= 2 && self.hpRatio < 0.45) {
    contest -= 14;
  }
  if (between >= 3 && self.hpRatio < 0.28) {
    contest -= 20;
  }
  if (intel.tooLate) {
    contest -= 28;
  }
  if (intel.dangerous && personality.caution > 0.55) {
    contest -= 10 + (1 - personality.bravery) * 8;
  } else if (intel.dangerous && personality.aggression > 0.62) {
    contest -= 4;
  }
  if (intel.free && intel.canArriveInTime && self.hpRatio > 0.26) {
    contest += 22 + personality.opportunism * 8;
  }
  if (intel.alliesHandling && !intel.inside && intel.alliesCloser >= 1) {
    contest -= 16 + personality.teamwork * 6 - personality.independence * 4;
  }
  if (intel.alliesCloser >= 2 && intel.contested) {
    contest -= 10;
  } else if (intel.alliesCloser >= 1 && !intel.contested && !intel.inside && intel.family !== 'bounty') {
    contest -= 8 + personality.independence * 4;
  }
  if (intel.inside && intel.family === 'capture') {
    contest += 10;
    if (intel.occEnemies > 0) {
      contest += 8;
    }
  }
  if (intel.play === 'too_late' || intel.play === 'hold_back') {
    contest -= 12;
  }

  if (intel.family === 'capture') {
    if (front) {
      contest += 8;
    }
    if (ranged && d < obj.radius * 0.28 && intel.occEnemies > 0) {
      contest -= 4;
    }
    if (support && intel.occAllies > 0) {
      contest += 6 + personality.protectionInstinct * 5;
    }
    if (intel.decaying && obj.owner === self.team) {
      contest += 12;
    }
    if (intel.enemyCapturing && intel.canArriveInTime) {
      contest += 10 + intel.enemyProgress * 16;
    }
    if (intel.selfCapturing && intel.selfProgress >= 0.55) {
      contest += 12;
    }
    if (intel.contested && personality.aggression > 0.6) {
      contest += 8;
    }
    if (intel.contested && personality.caution > 0.65 && intel.occEnemies > intel.occAllies + (intel.inside ? 1 : 0)) {
      contest -= 8;
    }
  } else if (intel.family === 'destroy') {
    if (intel.selfProgress >= 0.75 && self.hpRatio > 0.22) {
      contest += 16;
    }
    if (intel.enemyProgress >= 0.75 && intel.canArriveInTime) {
      contest += 14 + personality.aggression * 6;
    }
    if (intel.play === 'defend_objective') {
      contest += 14;
    }
    if (intel.play === 'pressure_defenders') {
      contest += 8;
    }
    if (intel.play === 'attack_objective' && intel.free) {
      contest += 14;
    }
    if (ranged) {
      contest += 3;
    }
    if (obj.kind === 'executioner' && d < obj.radius + 50 && self.hpRatio < 0.35) {
      contest -= 12;
    }
    if (obj.kind === 'executioner' && isShadowDry(self.heroId, self)) {
      contest -= 16;
    }
    if (intel.occEnemies >= 2 && self.hpRatio < 0.4 && personality.caution > 0.55) {
      contest -= 8;
    }
    if (d > 420 && intel.selfProgress < 0.2 && intel.enemyProgress < 0.35 && self.hpRatio < 0.5) {
      contest -= 10;
    }
  } else if (intel.family === 'bounty') {
    const selfMarked =
      obj.allyX !== undefined && Math.hypot(obj.allyX - self.x, (obj.allyY ?? self.y) - self.y) < 40;
    const huntD =
      obj.enemyX !== undefined ? Math.hypot(obj.enemyX - self.x, (obj.enemyY ?? self.y) - self.y) : d;
    const allyD =
      obj.allyX !== undefined ? Math.hypot(obj.allyX - self.x, (obj.allyY ?? self.y) - self.y) : 999;
    const hunt = enemies.find(
      (enemy) =>
        enemy.kind === 'hero' &&
        enemy.visible &&
        obj.enemyX !== undefined &&
        Math.hypot(enemy.x - obj.enemyX, enemy.y - (obj.enemyY ?? enemy.y)) < 48,
    );
    const isolatedHunt = hunt ? isolation(hunt, enemies) : 0;
    contest -= 4;
    if (selfMarked) {
      contest -= 8 + personality.caution * 10;
      if (hunt && isolatedHunt > 0.6 && self.hpRatio > 0.45) {
        contest += 10 + personality.aggression * 8;
      }
      if (self.hpRatio < 0.38) {
        contest -= 14;
      }
    } else if (obj.allyX !== undefined) {
      contest += 6 + personality.protectionInstinct * 10 - allyD / 420;
      if (self.hpRatio < 0.32) {
        contest -= 12;
      }
    }
    if (hunt && isolatedHunt > 0.55 && self.hpRatio > 0.4) {
      contest += 12 + personality.opportunism * 8;
    }
    if (hunt && !isolatedHunt && huntD < 220 && personality.caution > 0.6) {
      contest -= 8;
    }
    contest -= (huntD / Math.max(180, situation.vision)) * 6;
  } else if (intel.family === 'shrine') {
    const tanky = front || self.role === 'ranged-tank';
    if (self.hpRatio < 0.62) {
      contest += 10 + (1 - self.hpRatio) * 16;
    }
    if (self.hpRatio > 0.82) {
      contest -= 10;
    }
    if (tanky) {
      contest += 6;
    }
    if (ranged && d < obj.radius * 0.4) {
      contest -= 5;
    }
    if (support && intel.occAllies > 0) {
      contest += 7 + personality.protectionInstinct * 5;
    }
    if (intel.contested && self.hpRatio < 0.4 && personality.caution > 0.55) {
      contest -= 14;
    }
    if (intel.contested && tanky && self.hpRatio > 0.45) {
      contest += 8;
    }
    if (intel.occEnemies >= intel.occAllies + 2 && self.hpRatio < 0.5) {
      contest -= 12;
    }
  } else if (intel.family === 'banner') {
    const timeLeft = obj.remainingMs ?? 12_000;
    contest += 8 + (1 - Math.min(1, timeLeft / 20_000)) * 16;
    if (front) {
      contest += 8;
    }
    if (support && obj.allyX !== undefined) {
      contest += 8 + personality.protectionInstinct * 6;
    }
    if (intel.play === 'guard_banner') {
      contest += 12 + personality.protectionInstinct * 8;
    }
    if (intel.play === 'hunt_banner' && self.hpRatio > 0.38) {
      contest += 10 + personality.opportunism * 8;
      if (self.heroId === 'shadow' || self.heroId === 'ninja' || self.heroId === 'demon') {
        contest += 4;
      }
    }
    if (intel.play === 'claim_banner' && intel.free) {
      contest += 14;
    }
    if (intel.play === 'hold_back') {
      contest -= 10;
    }
    if (ranged && intel.inside) {
      contest -= 4;
    }
  } else if (intel.family === 'rage') {
    contest -= 6;
    if (self.hpRatio < 0.4) {
      contest -= 16;
    }
    if (front && self.hpRatio > 0.45) {
      contest += 10 + personality.aggression * 6;
    }
    if ((self.heroId === 'death' || self.heroId === 'shadow' || self.heroId === 'demon' || self.heroId === 'ninja') && self.hpRatio > 0.42) {
      contest += 6;
    }
    if (ranged && d < obj.radius * 0.35) {
      contest -= 5;
    }
    if (intel.play === 'hold_back') {
      contest -= 12;
    }
  } else if (intel.family === 'hazard') {
    contest -= 22;
    if (intel.play === 'dodge_hazard') {
      contest -= 8;
    }
  }
  if (situation.lastSurvivor && intel.occEnemies >= 2) {
    contest -= 14;
  }
  if (team.fightHandled && intel.free) {
    contest += 8;
  }
  const pts = objectiveScoreValue(obj.kind);
  if (pts > 0) {
    contest += Math.min(10, pts / 16);
  }
  const left = situation.remainingMs;
  if (left !== undefined && intel.travelMs > left + 400 && !intel.inside) {
    contest -= 22;
  }
  if (team.comfortable && intel.dangerous) {
    contest -= 10;
  }
  if (team.desperate && pts >= 100) {
    contest += 8;
  }
  if (intel.family === 'shrine' && (self.hpRatio < 0.45 || team.allyInDanger)) {
    contest += 6;
  }
  const focus = intel.focus ?? enemies.find(
    (enemy) =>
      enemy.kind === 'hero' &&
      enemy.visible &&
      (obj.enemyX !== undefined
        ? Math.hypot(enemy.x - obj.enemyX, enemy.y - (obj.enemyY ?? enemy.y)) < 56
        : Math.hypot(enemy.x - obj.x, enemy.y - obj.y) < obj.radius + 80),
  );
  const ally = intel.ally ?? allies.find(
    (friend) =>
      friend.kind === 'hero' &&
      (obj.allyX !== undefined
        ? Math.hypot(friend.x - obj.allyX, friend.y - (obj.allyY ?? friend.y)) < 56
        : Math.hypot(friend.x - obj.x, friend.y - obj.y) < obj.radius + 90),
  );
  return write(
    out,
    count,
    'contest_objective',
    tune('contest_objective', contest),
    intel.reason,
    focus?.id ?? -1,
    ally?.id ?? -1,
  );
};

const applyPlanBias = (
  out: ScoredAction[],
  count: number,
  plan: GamePlan,
  visibleHeroes: number,
  personality: Personality,
): number => {
  const openingHold =
    plan.opening === 'hold_near_spawn' ||
    plan.opening === 'defensive_hold' ||
    plan.opening === 'wait_for_team' ||
    plan.opening === 'stay_back_poke';
  const openingFlank =
    plan.opening === 'flank_left' || plan.opening === 'flank_right' || plan.opening === 'wide_rotation';
  const openingAlly = plan.opening === 'move_to_ally' || plan.opening === 'wait_for_team';
  if (plan.state === 'opening' && visibleHeroes === 0) {
    if (plan.opening === 'rush_center') {
      count = write(out, count, 'advance', 18 + personality.aggression * 8, 'opening rush');
    } else if (openingHold) {
      count = write(out, count, 'hold_position', 24 + personality.patience * 8, 'opening hold');
      count = write(out, count, 'search_for_target', 12, 'watch the field');
    } else if (openingFlank) {
      count = write(out, count, 'advance', 16 + personality.flankTendency * 8, 'opening flank path');
    } else if (openingAlly) {
      count = write(out, count, 'regroup', 22 + personality.teamwork * 10, 'opening with team');
    } else if (plan.opening === 'advance_behind_minions') {
      count = write(out, count, 'farm_minions', 16, 'opening behind minions');
      count = write(out, count, 'advance', 12, 'opening with the wave');
    } else {
      count = write(out, count, 'search_for_target', 16, 'opening scout');
      count = write(out, count, 'advance', 10, 'opening move');
    }
  }
  if (plan.state === 'regroup') {
    count = write(out, count, 'regroup', 26, plan.reason);
  }
  if (plan.state === 'patrol' || plan.state === 'search') {
    count = write(out, count, 'search_for_target', 18, plan.reason);
    count = write(out, count, 'hold_position', 10 + personality.patience * 6, 'hold a useful spot');
  }
  if (plan.state === 'poke' || plan.state === 'hold') {
    count = write(out, count, 'hold_position', 14, 'plan hold');
    count = write(out, count, 'reposition', 12, 'plan spacing');
  }
  if (plan.state === 'protect' || plan.state === 'support') {
    count = write(out, count, 'protect_ally', 16 + personality.protectionInstinct * 8, plan.reason);
  }
  if (plan.state === 'reposition') {
    count = write(out, count, 'reposition', 22, plan.reason);
  }
  return count;
};

const nearestIncomingHazard = (
  situation: Situation,
  self: CombatantView,
): { dist: number; radius: number } | undefined => {
  const hazards = situation.objective?.hazards;
  if (!hazards || hazards.length === 0) {
    return undefined;
  }
  let best: { dist: number; radius: number } | undefined;
  for (const zone of hazards) {
    const d = Math.hypot(self.x - zone.x, self.y - zone.y);
    if (d > zone.radius + 22) {
      continue;
    }
    if (!best || d < best.dist) {
      best = { dist: d, radius: zone.radius };
    }
  }
  return best;
};

export const pickScoredAction = (
  scored: ScoredAction[],
  count: number,
  rng: () => number,
): ScoredAction | undefined => {
  if (count <= 0) {
    return undefined;
  }
  let max = scored[0].score;
  for (let i = 1; i < count; i += 1) {
    if (scored[i].score > max) {
      max = scored[i].score;
    }
  }
  const band = rng() < 0.1 ? 26 : 13;
  let total = 0;
  const weights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const keep = scored[i].score >= max - band;
    const w = keep ? Math.max(0.01, scored[i].score - (max - band) + 3) : 0;
    weights[i] = w;
    total += w;
  }
  if (total <= 0) {
    return scored[0];
  }
  let roll = rng() * total;
  for (let i = 0; i < count; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return scored[i];
    }
  }
  return scored[0];
};

export const byId = (units: CombatantView[], id: number): CombatantView | undefined => {
  if (id < 0) {
    return undefined;
  }
  for (const unit of units) {
    if (unit.id === id) {
      return unit;
    }
  }
  return undefined;
};
