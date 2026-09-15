import type { AbilityDef } from '../../heroes/abilities/types';
import type { NinjaBody } from '../../heroes/NinjaBody';
import type { CombatantView, Situation, SupportMode } from './types';

export type SupportPurpose = 'heal' | 'shield' | 'buff';

export type SupportRead = {
  mode: SupportMode;
  ally?: CombatantView;
  need: number;
  reason: string;
};

const dist = (a: CombatantView, b: CombatantView): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * CPU Mender Pulse aim. Mix mode splits fire; save/support stay on the needy ally.
 */
export const menderPulseHealTarget = (
  situation: Situation,
  ally: NinjaBody | undefined,
): NinjaBody | undefined => {
  if (situation.self.heroId !== 'mender' || !ally || ally.down || !ally.isPresent) {
    return undefined;
  }
  if (ally.stats.role === 'minion') {
    return undefined;
  }
  const mode = situation.supportMode ?? 'attack';
  if (mode === 'attack') {
    return undefined;
  }
  const hp = ally.health / Math.max(1, ally.stats.maxHealth);
  const stam = ally.stamina / Math.max(1, ally.stats.maxStamina);
  const recentlyHit = ally.lastEnemyHitAt > (situation.now ?? 0) - 1400;
  if (mode === 'save') {
    return hp < 0.96 || stam < 0.78 || recentlyHit ? ally : undefined;
  }
  if (mode === 'support') {
    return hp < 0.9 || stam < 0.58 || recentlyHit ? ally : undefined;
  }
  const needsHeal = hp < 0.9 || stam < 0.55 || recentlyHit;
  if (!needsHeal) {
    return undefined;
  }
  if (hp < 0.55 || stam < 0.22) {
    return ally;
  }
  const tick = Math.floor((situation.now ?? 0) / 640);
  return tick % 2 === 0 ? ally : undefined;
};

export const purposesOf = (def: AbilityDef): SupportPurpose[] => {
  const roles = def.tactics?.roles ?? [];
  const out: SupportPurpose[] = [];
  if (roles.includes('heal')) {
    out.push('heal');
  }
  if (roles.includes('shield')) {
    out.push('shield');
  }
  if (roles.includes('buff')) {
    out.push('buff');
  }
  return out;
};

const threatsNear = (ally: CombatantView, enemies: CombatantView[]): number => {
  let n = 0;
  for (const enemy of enemies) {
    if (!enemy.visible || enemy.kind !== 'hero') {
      continue;
    }
    const d = dist(ally, enemy);
    const pressing = enemy.attacking || enemy.lastAttackerId === ally.id || enemy.recentlyHit;
    if (d <= 112 || (d <= 156 && pressing)) {
      n += 1;
    }
  }
  return n;
};

const alliesNear = (ally: CombatantView, allies: CombatantView[], radius: number): number => {
  let n = 0;
  for (const other of allies) {
    if (other === ally || other.kind !== 'hero' || !other.visible) {
      continue;
    }
    if (dist(ally, other) <= radius) {
      n += 1;
    }
  }
  return n;
};

const corridorThreat = (self: CombatantView, ally: CombatantView, enemies: CombatantView[]): number => {
  const toX = ally.x - self.x;
  const toY = ally.y - self.y;
  const span = Math.hypot(toX, toY) || 1;
  let n = 0;
  for (const enemy of enemies) {
    if (!enemy.visible || enemy.kind !== 'hero') {
      continue;
    }
    const t = ((enemy.x - self.x) * toX + (enemy.y - self.y) * toY) / (span * span);
    if (t <= 0.08 || t >= 0.92) {
      continue;
    }
    const px = self.x + toX * t;
    const py = self.y + toY * t;
    if (Math.hypot(enemy.x - px, enemy.y - py) < 64) {
      n += 1;
    }
  }
  return n;
};

/**
 * How much an ally would actually benefit from a heal / shield / buff.
 * Lowest HP is only one input — fighting, focus, and waste all matter.
 */
export const scoreAllyNeed = (
  self: CombatantView,
  ally: CombatantView,
  situation: Situation,
  purpose: SupportPurpose,
): number => {
  if (ally.kind !== 'hero' || !ally.visible) {
    return 0;
  }
  const missing = 1 - ally.hpRatio;
  const nearbyFoes = threatsNear(ally, situation.enemies);
  const focused = situation.enemies.some(
    (enemy) =>
      enemy.visible &&
      enemy.kind === 'hero' &&
      (enemy.lastAttackerId === ally.id || (enemy.attacking && dist(enemy, ally) < 170)),
  );
  const idleFull = ally.hpRatio > 0.9 && !ally.recentlyHit && !ally.attacking && nearbyFoes === 0 && !ally.stunned;
  if (purpose === 'heal' && missing < 0.08 && !ally.recentlyHit && nearbyFoes === 0) {
    return 0;
  }
  if (purpose === 'buff' && !ally.attacking && nearbyFoes === 0 && !focused) {
    return idleFull ? 0 : Math.max(0, missing * 4);
  }
  if (purpose === 'shield' && idleFull) {
    return 0;
  }

  let score = missing * 26 + Math.max(0, 0.48 - ally.hpRatio) * 24;
  if (ally.recentlyHit) {
    score += 12;
  }
  if (ally.attacking) {
    score += 8;
  }
  if (ally.stunned) {
    score += 14;
  }
  score += Math.min(3, nearbyFoes) * 8;
  if (focused) {
    score += 11;
  }
  if (alliesNear(ally, situation.allies, 150) === 0 && nearbyFoes >= 1) {
    score += 10;
  }
  if ((purpose === 'heal' || purpose === 'buff') && ally.staminaRatio < 0.28) {
    score += 6;
  }
  if (purpose === 'shield') {
    if (nearbyFoes === 0 && !ally.recentlyHit && !focused) {
      score *= 0.28;
    } else {
      score += 10;
    }
  }
  if (purpose === 'buff' && ally.attacking) {
    score += 10;
  }

  const d = dist(self, ally);
  score -= (d / Math.max(140, situation.vision)) * 16;
  if (d > 440) {
    score -= 10;
  }

  const corridor = corridorThreat(self, ally, situation.enemies);
  if (self.hpRatio < 0.22 && corridor >= 2) {
    score -= 36;
  } else if (self.hpRatio < 0.28 && corridor >= 2) {
    score -= 18;
  } else if (self.hpRatio < 0.18 && corridor >= 1) {
    score -= 16;
  }
  if (self.hpRatio < 0.16 && d > 180 && corridor >= 1) {
    score -= 18;
  }
  return score;
};

export const pickBestSupportAlly = (
  situation: Situation,
  range: number,
  purposes: readonly SupportPurpose[],
  preferId = -1,
): CombatantView | undefined => {
  if (purposes.length === 0) {
    return undefined;
  }
  let best: CombatantView | undefined;
  let bestScore = 5.5;
  for (const ally of situation.allies) {
    if (ally.kind !== 'hero' || !ally.visible) {
      continue;
    }
    const d = dist(situation.self, ally);
    if (d > range + 36) {
      continue;
    }
    let need = 0;
    for (const purpose of purposes) {
      need = Math.max(need, scoreAllyNeed(situation.self, ally, situation, purpose));
    }
    if (ally.id === preferId && need > 4) {
      need += 6;
    }
    if (need > bestScore) {
      bestScore = need;
      best = ally;
    }
  }
  return best;
};

const modeOfNeed = (need: number): SupportMode => {
  if (need >= 38) {
    return 'save';
  }
  if (need >= 22) {
    return 'support';
  }
  if (need >= 8) {
    return 'mix';
  }
  return 'attack';
};

const holdMode = (prev: SupportMode, next: SupportMode, need: number): SupportMode => {
  if (prev === next) {
    return next;
  }
  if (prev === 'save' && need >= 24) {
    return 'save';
  }
  if (prev === 'support' && need >= 12 && need < 42) {
    return need >= 38 ? 'save' : 'support';
  }
  if (prev === 'mix' && need >= 5 && need < 30) {
    return 'mix';
  }
  if (prev === 'attack' && need < 14) {
    return 'attack';
  }
  return next;
};

/** Team-wide support vs attack mix. Hysteresis lives on the previous Situation snapshot. */
export const assessSupport = (situation: Situation): SupportRead => {
  if (!situation.hasAllySupport) {
    return { mode: 'attack', need: 0, reason: 'no ally support kit' };
  }
  const purposes: SupportPurpose[] = ['heal', 'shield', 'buff'];
  const ally = pickBestSupportAlly(situation, situation.self.attackRange * 1.65 + 80, purposes, situation.supportFocusId ?? -1);
  const need = ally
    ? Math.max(
        scoreAllyNeed(situation.self, ally, situation, 'heal'),
        scoreAllyNeed(situation.self, ally, situation, 'shield'),
        scoreAllyNeed(situation.self, ally, situation, 'buff'),
      )
    : 0;
  const raw = modeOfNeed(need);
  const mode = situation.supportMode ? holdMode(situation.supportMode, raw, need) : raw;
  const reason =
    mode === 'save'
      ? 'save ally'
      : mode === 'support'
        ? 'cover the team'
        : mode === 'mix'
          ? 'mix heal and fire'
          : 'team is stable';
  return { mode, ally, need, reason };
};

export const scoreSupportAbility = (def: AbilityDef, situation: Situation, range: number): number => {
  const purposes = purposesOf(def);
  if (purposes.length === 0) {
    return 0;
  }
  const prefer = situation.supportFocusId ?? -1;
  const ally = pickBestSupportAlly(situation, range, purposes, prefer);
  const conservation = situation.personality.abilityConservation;
  if (!ally) {
    if (def.tactics?.includesSelf) {
      const hp = situation.self.hpRatio;
      const threatened =
        Boolean(situation.projectile?.willHit) ||
        situation.enemies.some((enemy) => enemy.kind === 'hero' && enemy.visible && dist(situation.self, enemy) < 150);
      if (threatened || hp < 0.4) {
        return 10 + (1 - hp) * 12 - conservation * 6;
      }
    }
    return -20 - conservation * 8;
  }
  let need = 0;
  for (const purpose of purposes) {
    need = Math.max(need, scoreAllyNeed(situation.self, ally, situation, purpose));
  }
  if (need < 7) {
    return -18 - conservation * 6;
  }
  let score = 8 + need * 0.95 + situation.personality.protectionInstinct * 8 - conservation * 5;
  if (def.slot === 'ultimate') {
    if (need < 18) {
      score -= 16 + conservation * 10;
    } else if (need >= 28) {
      score += 10;
    }
  }
  if (def.tactics?.includesSelf && situation.self.hpRatio < 0.42) {
    score += 8;
  }
  const corridor = corridorThreat(situation.self, ally, situation.enemies);
  if (situation.self.hpRatio < 0.22 && corridor >= 2) {
    score -= 28;
  }
  return score;
};
