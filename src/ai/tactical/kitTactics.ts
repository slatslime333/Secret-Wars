import type { AbilityDef, AbilityRole, AbilitySlot, AbilityTactics } from '../../heroes/abilities/types';
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

/**
 * Score one ready kit slot from its tactics tags and the local fight.
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
  const { self, enemies, allies, personality } = situation;
  const range = Math.max(48, tactics.range);
  const foes = countInRange(self, enemies.filter((unit) => unit.kind === 'hero'), range + 24);
  const minions = countInRange(self, enemies.filter((unit) => unit.kind === 'minion'), range + 24);
  const nearest = enemies.reduce((best, enemy) => {
    if (!enemy.visible) {
      return best;
    }
    const d = dist(self, enemy);
    return !best || d < best.d ? { enemy, d } : best;
  }, undefined as { enemy: CombatantView; d: number } | undefined);
  const hp = self.hpRatio;
  const ultimate = slot === 'ultimate';
  let score = 6 + personality.aggression * 4;

  if (hasRole(tactics, 'escape') || hasRole(tactics, 'defense')) {
    if (hp < 0.38) {
      score += 22;
    }
    if (hp < 0.22) {
      score += 16;
    }
    const nearHeroes = countInRange(self, enemies.filter((unit) => unit.kind === 'hero'), 200);
    if (nearHeroes >= 2) {
      score += 14;
    }
    if (hp > 0.72 && nearHeroes === 0) {
      score -= 24;
    }
  }

  if (hasRole(tactics, 'mobility') && !hasRole(tactics, 'escape')) {
    if (nearest && nearest.d > range * 0.4 && nearest.d < range * 1.2 && hp > 0.35) {
      score += 10;
    }
  }

  if (hasRole(tactics, 'damage') || hasRole(tactics, 'burst') || hasRole(tactics, 'finish')) {
    if (nearest && nearest.d <= range * 1.05) {
      score += 12 + (1 - nearest.enemy.hpRatio) * 10;
      if (nearest.enemy.stunned || nearest.enemy.hpRatio < 0.28) {
        score += 10;
      }
    } else {
      score -= 10;
    }
  }

  if (hasRole(tactics, 'aoe') || hasRole(tactics, 'cc') || hasRole(tactics, 'space')) {
    score += Math.max(0, foes - 1) * 14;
    if (foes + minions >= 3) {
      score += 8;
    }
    if (foes === 0 && minions < 2) {
      score -= 16;
    }
  }

  if (hasRole(tactics, 'peel') || hasRole(tactics, 'initiate')) {
    const allyInTrouble = allies.some((ally) => ally.kind === 'hero' && ally.hpRatio < 0.4 && dist(self, ally) < 240);
    if (allyInTrouble && foes >= 1) {
      score += 12;
    }
  }

  if (ultimate) {
    if (foes >= 2) {
      score += 18;
    } else if (foes === 1 && nearest && nearest.enemy.hpRatio < 0.35 && hp > 0.3) {
      score += 10;
    } else if (foes === 0) {
      score -= 28;
    }
    if (hp < 0.12 && !hasRole(tactics, 'escape') && !hasRole(tactics, 'aoe')) {
      score -= 12;
    }
    if (foes === 1 && nearest && nearest.enemy.hpRatio < 0.12 && hp > 0.7) {
      score -= 10;
    }
    score += 4;
  }

  if (!nearest || nearest.d > range * 1.35) {
    if (!(hasRole(tactics, 'escape') && hp < 0.34)) {
      score -= 14;
    }
  }

  return score;
};
