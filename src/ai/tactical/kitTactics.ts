import { defHasAllySupport, type AbilityDef, type AbilityRole, type AbilitySlot, type AbilityTactics } from '../../heroes/abilities/types';
import { scoreSupportAbility } from './supportSense';
import { scoreDemonAbility } from './demonSense';
import { mobilityLockOf } from './fightRead';
import { looksLikeWideHitter } from './spacing';
import type { CombatantView, Situation } from './types';

const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

export const hasRole = (tactics: AbilityTactics | undefined, role: AbilityRole): boolean =>
  Boolean(tactics?.roles.includes(role));

const countInRange = (self: CombatantView, units: CombatantView[], range: number): number => {
  let n = 0;
  for (const unit of units) {
    if (unit.visible && dist(self, unit) <= range) {
      n += 1;
    }
  }
  return n;
};

const nearestOf = (self: CombatantView, units: CombatantView[]): { unit: CombatantView; d: number } | undefined =>
  units.reduce((best, unit) => {
    if (!unit.visible) {
      return best;
    }
    const d = dist(self, unit);
    return !best || d < best.d ? { unit, d } : best;
  }, undefined as { unit: CombatantView; d: number } | undefined);

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export type UltKind = 'transform' | 'heal' | 'attack' | 'defense' | 'utility';

export type UltRead = {
  kind: UltKind;
  score: number;
  reason: string;
  current: number;
  future: number;
  decision: 'use' | 'save' | 'wait' | 'reposition';
};

/**
 * Classify from the existing ability def, not a parallel ult AI.
 * Shadow/Demon Rage are transforms (vulnerable cast). Second Wind is a heal field.
 */
export const classifyUlt = (def: AbilityDef): UltKind => {
  if (def.id === 'shadow-rage' || def.id === 'demon-rage') {
    return 'transform';
  }
  const tactics = def.tactics;
  if (hasRole(tactics, 'heal') || (defHasAllySupport(def) && hasRole(tactics, 'aoe'))) {
    return 'heal';
  }
  if (hasRole(tactics, 'defense') && !hasRole(tactics, 'damage') && !hasRole(tactics, 'burst')) {
    return 'defense';
  }
  if (hasRole(tactics, 'damage') || hasRole(tactics, 'burst') || hasRole(tactics, 'aoe')) {
    return 'attack';
  }
  return 'utility';
};

const stayChanceOf = (self: CombatantView, foes: CombatantView[], range: number): number => {
  const inRange = foes.filter((foe) => foe.visible && dist(self, foe) <= range + 24);
  if (inRange.length === 0) {
    return 0;
  }
  let stay = 0;
  for (const foe of inRange) {
    let chance = 0.32;
    if (foe.attacking || foe.recentlyHit || foe.stunned || (foe.slowLeftMs ?? 0) > 80) {
      chance += 0.28;
    }
    if (foe.blocking) {
      chance += 0.08;
    }
    const speed = Math.hypot(foe.vx, foe.vy);
    if (speed > 70) {
      chance -= 0.22;
    } else if (speed > 40) {
      chance -= 0.1;
    }
    if ((foe.controlLockLeftMs ?? 0) > 80) {
      chance += 0.16;
    }
    stay += clamp(chance, 0.08, 0.92);
  }
  return stay / inRange.length;
};

const allyCastingNear = (self: CombatantView, allies: CombatantView[]): boolean =>
  allies.some(
    (ally) =>
      ally.kind === 'hero' &&
      dist(self, ally) < 230 &&
      ((ally.controlLockLeftMs ?? 0) > 90 || ally.demonForm === 'transforming'),
  );

export type UltGuess = {
  pressure: number;
  likely: boolean;
  unlikely: boolean;
  casting: boolean;
  reason: string;
  x: number;
  y: number;
  radius: number;
};

/**
 * Visible-only guess that an enemy may spend an ultimate near us.
 * Does not read hidden cooldowns or abilityReady — surrounded, windup,
 * and grouping are the tells. Isolated dying enemies look unlikely.
 */
export const guessEnemyUlt = (situation: Situation): UltGuess => {
  const { self, allies, enemies, personality } = situation;
  const heroes = enemies.filter((unit) => unit.kind === 'hero' && unit.visible);
  let best = 0;
  let reason = 'no tell';
  let x = self.x;
  let y = self.y;
  let radius = 160;
  let casting = false;
  for (const enemy of heroes) {
    const ourPress =
      allies.filter((ally) => ally.kind === 'hero' && dist(ally, enemy) < 150).length +
      (dist(self, enemy) < 150 ? 1 : 0);
    const theirFriends = heroes.filter((other) => other !== enemy && dist(other, enemy) < 150).length;
    const d = dist(self, enemy);
    const windup = (enemy.controlLockLeftMs ?? 0) > 90 || enemy.demonForm === 'transforming';
    if (windup) {
      casting = true;
      const p = d < 210 ? 0.84 : 0.42;
      if (p > best) {
        best = p;
        reason = 'enemy windup';
        x = enemy.x;
        y = enemy.y;
        radius = Math.max(150, enemy.attackRange * 1.25);
      }
    }
    const isolatedDying = ourPress <= 1 && theirFriends === 0 && enemy.hpRatio < 0.28;
    if (isolatedDying) {
      continue;
    }
    const surrounded = ourPress >= 2 && enemy.hpRatio > 0.38;
    const groupedFight = theirFriends >= 1 && ourPress >= 1 && d < 200;
    const wide = looksLikeWideHitter(enemy);
    let chance = 0;
    if (surrounded) {
      chance += 0.4 + (wide ? 0.18 : 0.08);
    }
    if (groupedFight && ourPress >= 2) {
      chance += 0.18;
    }
    if (enemy.hpRatio < 0.22) {
      chance *= 0.4;
    }
    if (d > 280) {
      chance *= 0.45;
    }
    chance += (0.5 - personality.reactionQuality) * 0.1;
    chance += personality.caution * 0.04;
    if (chance > best) {
      best = chance;
      reason = surrounded ? 'they look ready to ult' : groupedFight ? 'grouped fight' : 'possible ult';
      x = enemy.x;
      y = enemy.y;
      radius = wide ? enemy.attackRange * 1.28 + 36 : 150;
    }
  }
  return {
    pressure: clamp(best, 0, 1),
    likely: best >= 0.48,
    unlikely: best < 0.22 && !casting,
    casting,
    reason,
    x,
    y,
    radius,
  };
};

const watchingEnemies = (self: CombatantView, enemies: CombatantView[], radius: number): number => {
  let n = 0;
  for (const enemy of enemies) {
    if (enemy.kind !== 'hero' || !enemy.visible) {
      continue;
    }
    const d = dist(self, enemy);
    if (d > radius) {
      continue;
    }
    const distracted = enemy.attacking && enemy.lastAttackerId >= 0 && enemy.lastAttackerId !== self.id;
    if (distracted && d > 110) {
      continue;
    }
    const toSelfX = self.x - enemy.x;
    const toSelfY = self.y - enemy.y;
    const len = Math.hypot(toSelfX, toSelfY) || 1;
    const facing = (enemy.aimX * toSelfX + enemy.aimY * toSelfY) / len;
    if (facing > 0.12 || d < 90) {
      n += 1;
    }
  }
  return n;
};

/**
 * Ult value vs future value. Teamfight grouping used to add (foes-1)*14 plus a
 * "grouped" +16, so every kit crossed the fire threshold together. Scoring is
 * now type-specific: attack ults need stay-probability, transforms need a safe
 * cast, heals need injured allies in radius. Nearby teammate casts do not
 * auto-chain; they only matter as a visible commitment cue.
 */
export const evaluateUltimate = (def: AbilityDef, situation: Situation): UltRead => {
  const tactics = def.tactics;
  const range = Math.max(48, tactics?.range ?? 80);
  const { self, enemies, allies, personality, kit, plan } = situation;
  const kind = classifyUlt(def);
  const enemyHeroes = enemies.filter((unit) => unit.kind === 'hero' && unit.visible);
  const foes = countInRange(self, enemyHeroes, range + 24);
  const nearest = nearestOf(self, enemyHeroes);
  const stay = stayChanceOf(self, enemyHeroes, range);
  const expectedHits = foes * stay;
  const hp = self.hpRatio;
  const conservation = personality.abilityConservation;
  const chaining = allyCastingNear(self, allies);
  const guess = guessEnemyUlt(situation);
  const objUrgent = (situation.objective?.urgency ?? 0) >= 0.62;
  const late = (situation.remainingMs ?? 999_000) <= 40_000;
  let future = 20 + conservation * 16 + (kit?.ultSaveUntilFoes ?? 2) * 2;
  if (late) {
    future -= 16;
  }
  if (objUrgent) {
    future -= 8;
  }
  if (plan?.state === 'opening' || plan?.state === 'patrol' || plan?.state === 'search') {
    future += 10;
  }
  let current = 8;
  let reason = 'not worth it';
  let decision: UltRead['decision'] = 'save';

  if (kind === 'transform') {
    const watchers = watchingEnemies(self, enemyHeroes, 170);
    const cover = Boolean(situation.environment?.cover || situation.environment?.wall || situation.environment?.building);
    const nearestD = nearest?.d ?? 999;
    const distracted = enemyHeroes.some(
      (enemy) => enemy.attacking && enemy.lastAttackerId >= 0 && enemy.lastAttackerId !== self.id,
    );
    current = 10 + personality.aggression * 6;
    if (watchers >= 2 || (watchers >= 1 && nearestD < 130)) {
      current -= 28 + watchers * 8;
      reason = 'unsafe transformation position';
      decision = cover || nearestD > 180 ? 'reposition' : 'save';
    } else if (nearestD < 110 && !distracted) {
      current -= 18;
      reason = 'too close to transform';
      decision = 'reposition';
    } else if ((cover && nearestD > 150) || (distracted && nearestD > 140 && watchers === 0)) {
      current += 26 + personality.opportunism * 8;
      reason = cover ? 'cover + space to transform' : 'enemies occupied, safe to transform';
      decision = 'use';
    } else if (foes >= 2 && nearestD < 150) {
      current -= 12;
      reason = 'mid-pack transform';
      decision = 'save';
    } else if (hp < 0.22 && nearestD < 200) {
      current += 8;
      reason = 'panic transform';
      decision = 'use';
    } else {
      reason = 'wait for safer transform';
      decision = cover ? 'wait' : 'reposition';
    }
    if (chaining && decision === 'use' && current < future + 16) {
      current -= 10;
      reason = 'teammate already committing';
      decision = 'save';
    }
  } else if (kind === 'heal') {
    const injured = allies.filter(
      (ally) => ally.kind === 'hero' && ally.visible !== false && dist(self, ally) <= range + 20 && ally.hpRatio < 0.78,
    );
    const critical = injured.filter((ally) => ally.hpRatio < 0.34 || (ally.recentlyHit && ally.hpRatio < 0.5));
    const healNeed = injured.reduce((sum, ally) => sum + (1 - ally.hpRatio), 0) + (hp < 0.55 ? 1 - hp : 0);
    current = 6 + healNeed * 16 + personality.protectionInstinct * 6;
    if (critical.length >= 2 || (critical.length >= 1 && injured.length >= 2)) {
      current += 18;
      reason = `${critical.length} critical allies in radius`;
      decision = 'use';
    } else if (injured.length >= 3 && healNeed > 1.1) {
      current += 14;
      reason = `${injured.length} injured allies in radius`;
      decision = 'use';
    } else if (critical.length === 1 && injured.length === 1 && critical[0].hpRatio < 0.22) {
      current += 10;
      reason = 'prevent a death';
      decision = 'use';
    } else if (injured.length <= 1 && healNeed < 0.55) {
      current -= 20;
      reason = 'heal value too low';
      decision = 'save';
    } else {
      reason = 'wait for more injured in radius';
      decision = 'wait';
    }
    if (chaining && decision === 'use' && critical.length < 2) {
      current -= 12;
      reason = 'ally already committing, hold heal';
      decision = 'save';
    }
  } else if (kind === 'attack') {
    current = 8 + expectedHits * 16 + (nearest ? (1 - nearest.unit.hpRatio) * 8 : 0);
    if (nearest && (nearest.unit.stunned || mobilityLockOf(nearest.unit) > 0.4)) {
      current += 10;
    }
    const trapped = expectedHits >= 1.6 && stay > 0.55;
    const scatter = foes >= 2 && stay < 0.4;
    const overkill = foes === 1 && nearest && nearest.unit.hpRatio < 0.12 && hp > 0.55;
    if (overkill) {
      current -= 16;
      reason = 'overkill on a sliver';
      decision = 'save';
    } else if (scatter) {
      current -= 14;
      reason = 'enemy dodge probability high';
      decision = 'save';
    } else if (trapped) {
      current += 16;
      reason = `${foes} committed, high hit chance`;
      decision = 'use';
    } else if (foes >= 1 && stay > 0.58 && nearest && nearest.d <= range * 1.05) {
      current += 10;
      reason = 'target locked in range';
      decision = 'use';
    } else if (foes === 0) {
      current -= 24;
      reason = 'no one in radius';
      decision = 'save';
    } else {
      reason = stay < 0.45 ? 'wait for them to commit' : 'mediocre window';
      decision = stay < 0.45 ? 'wait' : 'save';
    }
    if (chaining && decision === 'use' && current < future + 22) {
      current -= 10;
      reason = 'teammate already spending';
      decision = 'save';
    }
  } else {
    const panic = hp < 0.2 && (hasRole(tactics, 'escape') || hasRole(tactics, 'defense'));
    current = 10 + (panic ? 18 : 0) + foes * 4;
    if (panic) {
      reason = 'defensive emergency';
      decision = 'use';
    } else if (foes >= 2 && hp < 0.42) {
      reason = 'space the collapse';
      decision = 'use';
    } else {
      reason = 'save utility';
      decision = 'save';
    }
  }

  const inGuessZone = Math.hypot(self.x - guess.x, self.y - guess.y) < guess.radius + 12;
  if (guess.casting && inGuessZone && kind !== 'heal') {
    current -= 10 + personality.caution * 6;
    if (decision === 'use' && personality.caution >= personality.opportunism) {
      decision = 'reposition';
      reason = 'inside enemy ult windup';
    }
  } else if (guess.casting && !inGuessZone && kind === 'attack' && stay > 0.42) {
    current += 8 + personality.opportunism * 4;
    if (decision !== 'use' && current > future - 2) {
      decision = 'use';
      reason = 'they spent, window is safer';
    }
  } else if (guess.likely && inGuessZone && kind === 'transform') {
    current -= 8;
    if (decision === 'use') {
      decision = 'reposition';
      reason = 'wait out their ult chance';
    }
  } else if (guess.likely && inGuessZone && kind === 'attack') {
    if (personality.opportunism > 0.64 && stay > 0.52 && current > 26) {
      current += 6;
      reason = 'deny their window';
      decision = 'use';
    } else if (decision === 'use' && personality.caution > 0.52) {
      decision = 'wait';
      reason = 'bait their ult first';
      current -= 6;
    }
  }

  if (decision === 'use' && current + 6 < future && hp > 0.24 && !late && kind !== 'heal') {
    decision = 'save';
    reason = `future ${Math.round(future)} > now ${Math.round(current)}`;
  }
  if (decision !== 'use' && current > future + 6 && current > 34 && hp > 0.18) {
    decision = 'use';
    if (reason === 'not worth it' || reason.startsWith('future')) {
      reason = 'window is good enough';
    }
  }
  if (foes === 0 && kind !== 'heal' && kind !== 'transform' && hp > 0.28) {
    current -= 12;
    if (decision === 'use') {
      decision = 'save';
      reason = 'no one in radius';
    }
  }

  let score = current - future * 0.35;
  if (decision === 'use') {
    score += 12;
  } else if (decision === 'wait' || decision === 'reposition') {
    score -= 8;
  } else {
    score -= 18 + conservation * 8;
  }
  return { kind, score, reason, current, future, decision };
};

/**
 * Score one ready kit slot from its tactics tags, kit profile, and the local fight.
 * Returns 0 when the ability should stay in the pocket.
 */
export const scoreKitSlot = (
  def: AbilityDef,
  situation: Situation,
  slot: AbilitySlot,
): number => {
  const tactics = def.tactics;
  if (!tactics) {
    return 0;
  }
  const { self, enemies, allies, personality, kit, plan } = situation;
  const range = Math.max(48, tactics.range);
  const enemyHeroes = enemies.filter((unit) => unit.kind === 'hero');
  const foes = countInRange(self, enemyHeroes, range + 24);
  const minions = countInRange(self, enemies.filter((unit) => unit.kind === 'minion'), range + 24);
  const nearest = nearestOf(self, enemies);
  const hp = self.hpRatio;
  const ultimate = slot === 'ultimate';
  const setup = hasRole(tactics, 'setup') || Boolean(kit?.setupIds.includes(def.id));
  const defensive = hasRole(tactics, 'defense') || hasRole(tactics, 'peel') || Boolean(kit?.defensiveIds.includes(def.id));
  const escape = hasRole(tactics, 'escape') || Boolean(kit?.escapeIds.includes(def.id));
  const allySupport = defHasAllySupport(def);
  const supportDelta = allySupport ? scoreSupportAbility(def, situation, range) : 0;
  let score = 4 + personality.aggression * 3;

  if (allySupport && !setup) {
    score += supportDelta;
  } else if (setup) {
    const fightSoon = nearest && nearest.d < 420 && nearest.d > 90;
    const preparing =
      plan?.state === 'opening' ||
      plan?.state === 'hold' ||
      plan?.state === 'poke' ||
      plan?.state === 'patrol' ||
      plan?.opening === 'stay_back_poke' ||
      plan?.opening === 'defensive_hold';
    if (nearest && nearest.d < 78) {
      score -= 28;
    } else if (preparing || fightSoon) {
      score += 26 + personality.patience * 8;
    } else if (!nearest) {
      score += plan?.state === 'opening' || plan?.state === 'hold' ? 18 : 6;
    }
    if (hp < 0.28 && nearest && nearest.d < 140) {
      score += 8;
    }
    if (nearest && mobilityLockOf(nearest.unit) < 0.22 && fightSoon) {
      const mark = nearest.unit;
      const converters = allies.filter(
        (ally) => ally.kind === 'hero' && dist(ally, mark) < 280 && ally.attackRange < 170,
      ).length;
      if (converters >= 1) {
        score += 10;
      }
    } else if (nearest && mobilityLockOf(nearest.unit) > 0.45) {
      score -= 6;
    }
  } else if (escape || (defensive && !setup)) {
    const nearHeroes = countInRange(self, enemyHeroes, 200);
    const selfThreat =
      (nearest && nearest.d < 130 && nearest.unit.kind === 'hero') ||
      Boolean(situation.projectile?.willHit) ||
      hp < 0.42;
    if (hp < 0.38) {
      score += 22;
    }
    if (hp < 0.22) {
      score += 16;
    }
    if (nearHeroes >= 2) {
      score += 14;
    }
    if (hp > 0.72 && nearHeroes === 0 && !selfThreat) {
      score -= 24;
    }
  }

  if (hasRole(tactics, 'mobility') && !escape && !allySupport) {
    if (nearest && nearest.d > range * 0.4 && nearest.d < range * 1.2 && hp > 0.35) {
      score += 10;
    }
  }

  if (hasRole(tactics, 'damage') || hasRole(tactics, 'burst') || hasRole(tactics, 'finish')) {
    if (nearest && nearest.d <= range * 1.05) {
      score += 12 + (1 - nearest.unit.hpRatio) * 10;
      if (nearest.unit.stunned || nearest.unit.hpRatio < 0.28 || mobilityLockOf(nearest.unit) > 0.35) {
        score += 10;
      }
    } else {
      score -= 10;
    }
  }

  if ((hasRole(tactics, 'aoe') || hasRole(tactics, 'cc') || hasRole(tactics, 'space')) && !ultimate) {
    score += Math.max(0, foes - 1) * 14;
    if (foes + minions >= 3) {
      score += 8;
    }
    if (foes === 0 && minions < 2 && !setup && supportDelta < 8) {
      score -= 16;
    }
  }

  if ((hasRole(tactics, 'peel') || hasRole(tactics, 'initiate')) && !setup && !allySupport) {
    const allyInTrouble = allies.some(
      (ally) =>
        ally.kind === 'hero' &&
        dist(self, ally) < 240 &&
        (ally.hpRatio < 0.4 || (ally.recentlyHit && ally.hpRatio < 0.62) || (ally.attacking && ally.hpRatio < 0.55)),
    );
    if (allyInTrouble && foes >= 1) {
      score += 12;
    }
  }

  if (ultimate) {
    const read = evaluateUltimate(def, situation);
    score += read.score;
    if (plan?.state === 'opening' || plan?.state === 'patrol' || plan?.state === 'search') {
      score -= 10;
    }
    if (hp < 0.12 && !escape && !hasRole(tactics, 'aoe') && read.kind !== 'heal') {
      score -= 12;
    }
  }

  if (!nearest || nearest.d > range * 1.35) {
    const allyInRange =
      allySupport &&
      allies.some((ally) => ally.kind === 'hero' && ally.visible && dist(self, ally) <= range + 24);
    if (!(escape && hp < 0.34) && !setup && !allyInRange) {
      score -= 14;
    }
  }

  score += scoreDemonAbility(def, situation);

  return score;
};
