import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { spawnCombatCallout } from '../effects/combatCallout';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

/** Timed 0.35s shield, then 4s cooldown. Not a holdable block. */
export class BlockController {
  private activeUntil = 0;
  private readyAt = 0;
  private readonly shield: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.shield = scene.add.graphics().setDepth(11);
  }

  tryStart(now: number, ninja: NinjaBody): boolean {
    if (now < this.readyAt || this.isActive(now)) {
      return false;
    }
    if (!ninja.trySpendStamina(COMBAT.blockStaminaCost, now)) {
      return false;
    }
    this.activeUntil = now + COMBAT.blockDurationMs;
    this.readyAt = now + COMBAT.blockCooldownMs;
    spawnCombatCallout(this.shield.scene, ninja.x, ninja.y, 'BLOCK', COLORS.cyan);
    return true;
  }

  isActive(now: number): boolean {
    return now < this.activeUntil;
  }

  cooldownRatio(now: number): number {
    if (now >= this.readyAt) {
      return 0;
    }
    return (this.readyAt - now) / COMBAT.blockCooldownMs;
  }

  sync(now: number, ninja: NinjaBody): void {
    this.shield.clear();
    if (!this.isActive(now)) {
      return;
    }
    const angle = Math.atan2(ninja.aim.y, ninja.aim.x);
    this.shield.setPosition(ninja.x, ninja.y);
    this.shield.lineStyle(8, COLORS.paper, 0.95);
    this.shield.beginPath();
    this.shield.arc(0, 0, 28, angle - 0.9, angle + 0.9);
    this.shield.strokePath();
    this.shield.lineStyle(4, COLORS.cyan, 1);
    this.shield.beginPath();
    this.shield.arc(0, 0, 24, angle - 0.85, angle + 0.85);
    this.shield.strokePath();
  }
}
