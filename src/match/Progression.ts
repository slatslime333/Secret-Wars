import { MATCH, xpToNextLevel, type StatGrowthKey } from '../config/match';
import type { HeroCombatConfig } from '../config/hero';
import type { NinjaBody } from '../heroes/NinjaBody';

export type LevelUpResult = {
  leveled: boolean;
  levelsGained: number;
  newLevel: number;
  stat: StatGrowthKey | null;
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
      return { leveled: false, levelsGained: 0, newLevel: this.level, stat: null };
    }
    this.xp += amount;
    let levelsGained = 0;
    let lastStat: StatGrowthKey | null = null;
    while (!this.atCap && this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      lastStat = this.applyLevel();
      levelsGained += 1;
    }
    if (this.atCap) {
      this.xp = 0;
    }
    return {
      leveled: levelsGained > 0,
      levelsGained,
      newLevel: this.level,
      stat: lastStat,
    };
  }

  giveLevel(): LevelUpResult {
    if (this.atCap) {
      return { leveled: false, levelsGained: 0, newLevel: this.level, stat: null };
    }
    this.xp = 0;
    const stat = this.applyLevel();
    return { leveled: true, levelsGained: 1, newLevel: this.level, stat };
  }

  private nextStat(): StatGrowthKey {
    const order = MATCH.growth.order;
    return order[(this.level - MATCH.xp.startLevel) % order.length];
  }

  private applyLevel(): StatGrowthKey {
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
    return stat;
  }
}
