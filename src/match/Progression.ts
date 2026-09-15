import { MATCH, xpToNextLevel, type StatGrowthKey } from '../config/match';
import type { HeroCombatConfig } from '../config/hero';
import type { NinjaBody } from '../heroes/NinjaBody';

export type LevelGrant = {
  level: number;
  stat: StatGrowthKey;
  amount: number;
};

export type LevelUpResult = {
  leveled: boolean;
  levelsGained: number;
  newLevel: number;
  stat: StatGrowthKey | null;
  grants: LevelGrant[];
};

/**
 * Per-hero XP and automatic one-stat-per-level growth.
 * Stat choice can replace `nextStat()` later without changing grantXp.
 */
export class Progression {
  level = MATCH.xp.startLevel;
  xp = 0;

  constructor(private readonly body: NinjaBody) {}

  get stats(): HeroCombatConfig {
    return this.body.stats;
  }

  get xpToNext(): number {
    return xpToNextLevel(this.level);
  }

  get xpRatio(): number {
    const need = this.xpToNext;
    if (need <= 0) {
      return 1;
    }
    return Math.min(1, this.xp / need);
  }

  get atCap(): boolean {
    return this.level >= MATCH.xp.maxLevel;
  }

  grantXp(amount: number): LevelUpResult {
    if (amount <= 0 || this.atCap) {
      return { leveled: false, levelsGained: 0, newLevel: this.level, stat: null, grants: [] };
    }
    this.xp += amount;
    const grants: LevelGrant[] = [];
    while (!this.atCap && this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      grants.push(this.applyLevel());
    }
    if (this.atCap) {
      this.xp = 0;
    }
    return {
      leveled: grants.length > 0,
      levelsGained: grants.length,
      newLevel: this.level,
      stat: grants[grants.length - 1]?.stat ?? null,
      grants,
    };
  }

  giveLevel(): LevelUpResult {
    if (this.atCap) {
      return { leveled: false, levelsGained: 0, newLevel: this.level, stat: null, grants: [] };
    }
    this.xp = 0;
    const grant = this.applyLevel();
    return { leveled: true, levelsGained: 1, newLevel: this.level, stat: grant.stat, grants: [grant] };
  }

  private nextStat(): StatGrowthKey {
    const order = MATCH.growth.order;
    return order[(this.level - MATCH.xp.startLevel) % order.length];
  }

  private applyLevel(): LevelGrant {
    const stat = this.nextStat();
    const amount = MATCH.growth.perLevel[stat];
    this.level += 1;
    if (stat === 'maxHealth') {
      this.body.stats.maxHealth += amount;
      this.body.health = Math.min(this.body.stats.maxHealth, this.body.health + amount);
    } else if (stat === 'attackDamage') {
      this.body.stats.attackDamage += amount;
    } else {
      this.body.stats.defense += amount;
    }
    return { level: this.level, stat, amount };
  }
}
