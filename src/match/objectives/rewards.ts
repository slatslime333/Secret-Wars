import { OBJECTIVE } from '../../config/objective';
import { xpToNextLevel } from '../../config/match';
import type { TeamId } from '../../config/hero';
import { audio } from '../../audio';
import type { NinjaBody } from '../../heroes/NinjaBody';
import type { HeroRuntime } from '../HeroRuntime';
import type { XpOrbWorld } from '../XpOrbWorld';

export const occupancyNear = (
  heroes: readonly HeroRuntime[],
  x: number,
  y: number,
  radius: number,
): { alpha: number; bravo: number } => {
  const occ = { alpha: 0, bravo: 0 };
  for (const hero of heroes) {
    if (!hero.alive) {
      continue;
    }
    if (Math.hypot(hero.body.x - x, hero.body.y - y) <= radius) {
      occ[hero.team] += 1;
    }
  }
  return occ;
};

/** Integer XP from the hero's current level requirement, not lifetime XP. */
export const xpShareOfCurrentLevel = (level: number, fraction: number): number => {
  const need = xpToNextLevel(level);
  if (need <= 0 || fraction <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(need * fraction));
};

export const grantTeamLevels = (
  team: TeamId,
  heroes: readonly HeroRuntime[],
  grantLevel: (hero: HeroRuntime) => void,
  orbs: XpOrbWorld | undefined,
  x: number,
  y: number,
  levels = 1,
): void => {
  let granted = false;
  for (const hero of heroes) {
    if (hero.team !== team || !hero.alive || hero.progression.atCap) {
      continue;
    }
    for (let n = 0; n < levels; n += 1) {
      if (hero.progression.atCap) {
        break;
      }
      grantLevel(hero);
    }
    orbs?.spawn(x, y, hero.body, 0, team, { visual: true });
    granted = true;
  }
  if (granted) {
    audio.play('ui-level-up');
  }
};

export const grantTeamXpShare = (
  team: TeamId,
  heroes: readonly HeroRuntime[],
  grantXp: (hero: HeroRuntime, amount: number) => void,
  orbs: XpOrbWorld | undefined,
  x: number,
  y: number,
  fraction: number,
): number => {
  let total = 0;
  for (const hero of heroes) {
    if (hero.team !== team || !hero.alive || hero.progression.atCap) {
      continue;
    }
    const amount = xpShareOfCurrentLevel(hero.progression.level, fraction);
    if (amount <= 0) {
      continue;
    }
    grantXp(hero, amount);
    orbs?.spawn(x, y, hero.body, 0, team, { visual: true });
    total += amount;
  }
  return total;
};

/** Temporary red aura + haste. Overwrites duration; does not stack. */
export const applyObjectiveHaste = (
  body: NinjaBody,
  now: number,
  durationMs: number,
  moveMul: number,
  attackMul: number,
  staminaMul?: number,
): void => {
  body.status.applyHasteBuff(now, durationMs, moveMul, attackMul);
  if (staminaMul !== undefined) {
    body.status.applyStaminaRegenBuff(now, durationMs, staminaMul);
  }
  body.showMagicVortex(now + durationMs, OBJECTIVE.auraTint);
};

export const applyObjectiveHasteToTeam = (
  team: TeamId,
  heroes: readonly HeroRuntime[],
  now: number,
  durationMs: number,
  moveMul: number,
  attackMul: number,
  staminaMul?: number,
): void => {
  for (const hero of heroes) {
    if (hero.team !== team || !hero.alive) {
      continue;
    }
    applyObjectiveHaste(hero.body, now, durationMs, moveMul, attackMul, staminaMul);
  }
};
