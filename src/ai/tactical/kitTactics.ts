import { defHasAllySupport, type AbilityDef, type AbilityRole, type AbilitySlot, type AbilityTactics } from '../../heroes/abilities/types';
import { scoreSupportAbility } from './supportSense';
import { scoreDemonAbility } from './demonSense';
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
      if (nearest.unit.stunned || nearest.unit.hpRatio < 0.28) {
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
    if (foes === 0 && minions < 2 && !setup && supportDelta < 8) {
      score -= 16;
    }
  }

  if ((hasRole(tactics, 'peel') || hasRole(tactics, 'initiate')) && !setup && !allySupport) {
    const allyInTrouble = allies.some((ally) => ally.kind === 'hero' && ally.hpRatio < 0.4 && dist(self, ally) < 240);
    if (allyInTrouble && foes >= 1) {
      score += 12;
    }
  }

  if (ultimate) {
    const saveBias = personality.abilityConservation * 18 + (kit?.ultSaveUntilFoes ?? 2) * 4;
    const grouped = foes >= (kit?.ultSaveUntilFoes ?? 2);
    const finish = foes === 1 && nearest && nearest.unit.hpRatio < 0.32 && hp > 0.28;
    const panic = hp < 0.18 && (escape || hasRole(tactics, 'aoe') || defensive);
    if (allySupport && supportDelta > 12) {
      score += supportDelta > 22 ? 12 : 4;
    } else if (grouped) {
      score += 16;
    } else if (finish) {
      score += 8;
    } else if (panic) {
      score += 12;
    } else {
      score -= 22 + saveBias;
    }
    if (foes === 0 && supportDelta < 10) {
      score -= 30;
    }
    if (plan?.state === 'opening' || plan?.state === 'patrol' || plan?.state === 'search') {
      score -= 16;
    }
    if (hp < 0.12 && !escape && !hasRole(tactics, 'aoe')) {
      score -= 12;
    }
    if (foes === 1 && nearest && nearest.unit.hpRatio < 0.12 && hp > 0.7) {
      score -= 10;
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
