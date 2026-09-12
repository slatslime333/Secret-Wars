import { TACTIC } from './constants';
import type {
  CombatantView,
  Personality,
  ScoredAction,
  Situation,
  TacticalAction,
  ThreatLevel,
} from './types';

const MAX_SCORED = 48;

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

const effectivePower = (unit: CombatantView): number => {
  const hp = 0.32 + 0.68 * unit.hpRatio;
  const stun = unit.stunned ? 0.38 : 1;
  const crit = unit.hpRatio < TACTIC.criticalHp ? 0.45 : 1;
  return unit.power * hp * stun * crit;
};

const isRangedOf = (unit: CombatantView): boolean =>
  unit.role === 'ranged' || (unit.kind === 'minion' && unit.attackRange > 80);

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

/** Allies already handling this enemy — bodies in the fight, not just nearby. */
export const pressOnEnemy = (enemy: CombatantView, allies: CombatantView[]): FightPress => {
  const on: CombatantView[] = [];
  let allyPower = 0;
  for (const ally of allies) {
    if (engagedWith(ally, enemy) || (ally.attacking && dist(ally, enemy) < 190)) {
      on.push(ally);
      allyPower += effectivePower(ally);
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

const overkillWeight = (enemy: CombatantView, allies: CombatantView[], enemies: CombatantView[]): number => {
  const press = pressOnEnemy(enemy, allies);
  const guards = protectorsOf(enemy, enemies);
  let theirPower = press.enemyPower;
  for (const guard of guards) {
    theirPower += effectivePower(guard) * 0.7;
  }
  const n = press.allies.length;
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
    return 0.55;
  }
  return n * 0.16;
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
  if (self.staminaRatio < 0.18) {
    risk += 0.1;
  }
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
    const handled = cAllies.length >= 2 && cEnemies.length <= 1 && avgEnemyHp < 0.5 && allyPower > enemyPower;
    if (handled) {
      urgency -= 34;
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
  const away = movingToward(enemy, homeX > 1100 ? 1980 : 220, enemy.y) || movingToward(enemy, enemy.x + (enemy.x - self.x), enemy.y + (enemy.y - self.y));
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
 */
export const scoreSituation = (situation: Situation, out: ScoredAction[]): number => {
  const { self, allies, enemies, personality, kind } = situation;
  const risk = riskOfSituation(situation);
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

  const ranged = isRangedOf(self);
  const front = self.role === 'frontliner' || self.role === 'tank';
  const support = self.role === 'support';
  let count = 0;

  const persist = (enemy: CombatantView, score: number): number =>
    enemy.id === situation.currentTargetId ? score + personality.persistence * 9 : score;

  const ghostMul = (enemy: CombatantView): number => (enemy.visible ? 1 : TACTIC.ghostScoreMul);

  for (const enemy of enemies) {
    const d = dist(self, enemy);
    const iso = isolation(enemy, enemies);
    const pile = overkillWeight(enemy, allies, enemies);
    const press = pressOnEnemy(enemy, allies);
    const victim = threatensAlly(enemy, allies);
    const distracted = Boolean(victim) || (enemy.attacking && enemy.lastAttackerId >= 0 && enemy.lastAttackerId !== self.id);
    const finishable = enemy.hpRatio <= TACTIC.finishHp && iso > 0.4;
    const stand = standoff(self, enemy, allies, enemies);
    const fleeing = retreatingFrom(enemy, self, situation.homeX);
    const range = self.attackRange;
    const vis = ghostMul(enemy);

    let attack = 36 - (d / situation.vision) * 34 + (1 - enemy.hpRatio) * 12 + iso * 12;
    attack -= pile * 58;
    attack -= risk * 20;
    attack += (self.hpRatio - 0.32) * 10;
    if (pile < 0.45) {
      if (victim) {
        attack += 12 + (1 - victim.hpRatio) * 10;
      }
      if (distracted) {
        attack += 8;
      }
    } else if (pile > 0.7) {
      attack -= 14;
    }
    if (stand) {
      attack -= 18;
    }
    if (ranged && d < range * 0.42) {
      attack -= 9;
    }
    if (!ranged && d < range * 1.25 && pile < 0.5) {
      attack += 7;
    }
    if (front && pile < 0.5) {
      attack += 4;
    }
    attack += (personality.aggression - 0.5) * 10;
    if (kind === 'minion' && pile < 0.5) {
      attack += 4;
    }
    if (self.hpRatio < personality.retreatHp && pile < 0.4 && !finishable) {
      attack -= 14;
    }
    if (fleeing && d > range * 2.2) {
      attack -= 16;
    }
    if (d > range * 3.2) {
      attack -= 12;
    }
    count = write(out, count, 'attack', persist(enemy, attack * vis), pile > 0.7 ? 'already handled' : victim ? 'press the threat' : 'take the fight', enemy.id);

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
      finish += personality.aggression * 6;
      count = write(out, count, 'finish_target', persist(enemy, finish * vis), pile > 0.7 ? 'already handled' : 'finishable', enemy.id);
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
      flank -= pile * 28;
      flank += personality.flankTendency * 16;
      if (ranged) {
        flank -= 4;
      }
      if (kind === 'minion' && ranged) {
        flank -= 8;
      }
      count = write(out, count, 'flank', persist(enemy, flank * vis), 'better angle', enemy.id);
    }

    if (fleeing) {
      let chase = 22 + (1 - enemy.hpRatio) * 16 - (d / situation.vision) * 32;
      chase -= pile * 24;
      chase -= risk * 16;
      if (d > situation.vision * 0.72) {
        chase -= 18;
      }
      if (self.hpRatio < 0.28) {
        chase -= 16;
      }
      chase += personality.aggression * 8 + personality.persistence * 6;
      count = write(out, count, 'chase', persist(enemy, chase * vis), 'pursue', enemy.id);
    }

    const incomingAlly = allies.find((ally) => movingToward(enemy, ally.x, ally.y) && dist(enemy, ally) < 420 && !engagedWith(enemy, ally));
    const incomingSelf = movingToward(enemy, self.x, self.y) && d < 460 && d > range * 1.1;
    if (incomingAlly || incomingSelf) {
      let intercept = 24 + (incomingAlly ? 14 : 6) - (d / situation.vision) * 16;
      intercept -= pile * 8;
      if (handledNearby && incomingAlly) {
        intercept += 12;
      }
      if (press.allies.length >= 2 && pile > 0.5) {
        intercept += 16;
      }
      intercept += personality.assistTendency * 8;
      count = write(
        out,
        count,
        'intercept',
        intercept * vis,
        incomingAlly ? 'cut off reinforcement' : 'meet the approach',
        enemy.id,
        incomingAlly?.id ?? -1,
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
    const canSwing = helpPower + effectivePower(self) > foePower * 0.72;
    let assist = 14 + (foes.length - allyHelp) * 20 + (1 - ally.hpRatio) * 20;
    assist -= (d / situation.vision) * 28;
    if (allyHelp >= 2 && helpPower > foePower * 1.2) {
      assist -= 26;
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
    if (support) {
      assist += 6;
    }
    const focus = foes.reduce((best, foe) => (foe.hpRatio < best.hpRatio ? foe : best), foes[0]);
    count = write(out, count, 'assist_ally', assist, foes.length > allyHelp + 1 ? 'outnumbered ally' : 'help the fight', focus.id, ally.id);

    const pursuers = foes.filter((foe) => movingToward(foe, ally.x, ally.y) || engagedWith(foe, ally));
    if (ally.hpRatio < 0.34 && pursuers.length > 0) {
      let protect = 18 + (1 - ally.hpRatio) * 28 - (d / situation.vision) * 20;
      protect += pursuers.length * 6;
      protect += personality.assistTendency * 8;
      if (self.hpRatio < 0.18) {
        protect -= 12;
      }
      count = write(out, count, 'protect_ally', protect, 'cover retreat', pursuers[0].id, ally.id);
    }
  }

  if (urgent && urgent.urgency > 28 && urgent.allies.length <= urgent.enemies.length) {
    const focus = urgent.enemies[0];
    const already = urgent.allies.some((ally) => ally.id === self.id);
    if (!already && dist(self, { ...self, x: urgent.x, y: urgent.y }) < situation.vision * 1.15) {
      const extra = 10 + urgent.urgency * 0.35 - (Math.hypot(urgent.x - self.x, urgent.y - self.y) / situation.vision) * 12;
      count = write(out, count, 'assist_ally', extra, 'urgent fight', focus?.id ?? -1, urgent.allies[0]?.id ?? -1);
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
  count = write(out, count, 'retreat', disengage, risk >= 0.54 ? 'bad fight' : 'reset');
  if (risk >= 0.7 || (self.hpRatio < TACTIC.criticalHp && risk >= 0.45)) {
    count = write(out, count, 'escape', disengage + 8 + (self.recentlyHit ? 6 : 0), 'survive');
  }

  const standEnemy = enemies.find((enemy) => standoff(self, enemy, allies, enemies) && dist(self, enemy) < self.attackRange * 2.1);
  if (standEnemy) {
    const d = dist(self, standEnemy);
    let wait = 20 + personality.caution * 10;
    if (self.hpRatio > 0.6 && standEnemy.hpRatio > 0.55) {
      wait += 12;
    }
    if (d < standEnemy.attackRange * 1.05 && !self.canAttack) {
      wait += 6;
    }
    wait -= personality.aggression * 8;
    count = write(out, count, 'wait_for_opening', wait, 'size them up', standEnemy.id);
    count = write(out, count, 'hold_position', wait - 3, 'hold range', standEnemy.id);
    let repo = 16 + (ranged ? 8 : 0);
    if (d < self.attackRange * 0.5 && ranged) {
      repo += 10;
    }
    count = write(out, count, 'reposition', repo, 'better spot', standEnemy.id);
  } else if (ranged && enemies.some((enemy) => dist(self, enemy) < self.attackRange * 0.5)) {
    count = write(out, count, 'reposition', 18 + personality.caution * 6, 'make space', enemies[0]?.id ?? -1);
  }

  const farm = handledNearby || (urgent?.handled ?? false) || enemies.length === 0;
  const lane = kind === 'minion' ? 34 : 20;
  let push = lane + (farm ? 22 : 0);
  if (enemies.length === 0) {
    push += 10;
  }
  if (risk > 0.5) {
    push -= 8;
  }
  if (kind === 'minion') {
    count = write(out, count, 'push_lane', push, farm ? 'lane is open' : 'keep pressure');
  } else {
    count = write(out, count, 'advance', push - 2, farm ? 'look elsewhere' : 'move up');
  }
  if (enemies.length === 0) {
    count = write(out, count, 'search_for_target', 28 + (kind === 'hero' ? 6 : 0), 'no one in sight');
  } else if (farm && kind === 'hero') {
    count = write(out, count, 'search_for_target', 22, 'fight is handled');
  }

  return count;
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
