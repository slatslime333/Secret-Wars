import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { isInAttackArc } from './hitDetection';
import { spawnCombatCallout } from '../effects/combatCallout';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

export type BlockAbsorbResult = {
  absorbed: boolean;
  perfect: boolean;
};

/** Timed 0.35s directional shield, then cooldown. Not a holdable block. */
export class BlockController {
  private activeUntil = 0;
  private readyAt = 0;
  private startedAt = 0;
  private readonly shield: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.shield = scene.add.graphics().setDepth(11);
  }

  tryStart(now: number, ninja: NinjaBody): boolean {
    if (now < this.readyAt || this.isActive(now) || ninja.status.isBlockStunned(now)) {
      return false;
    }
    if (!ninja.trySpendStamina(COMBAT.blockStaminaCost, now)) {
      return false;
    }
    this.startedAt = now;
    this.activeUntil = now + COMBAT.blockDurationMs;
    this.readyAt = now + COMBAT.blockCooldownMs;
    spawnCombatCallout(this.shield.scene, ninja.x, ninja.y, 'BLOCK', COLORS.cyan);
    return true;
  }

  isActive(now: number): boolean {
    return now < this.activeUntil;
  }

  /** True when the timed shield is up and facing the attacker. */
  tryAbsorb(now: number, ninja: NinjaBody, fromX: number, fromY: number): BlockAbsorbResult {
    if (!this.isActive(now)) {
      return { absorbed: false, perfect: false };
    }
    const covered = isInAttackArc(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, fromX, fromY, 420, 0.95, 8);
    if (!covered) {
      return { absorbed: false, perfect: false };
    }
    const perfect = now - this.startedAt <= COMBAT.perfectBlockWindowMs;
    return { absorbed: true, perfect };
  }

  cooldownRatio(now: number): number {
    if (now >= this.readyAt) {
      return 0;
    }
    return (this.readyAt - now) / COMBAT.blockCooldownMs;
  }

  destroy(): void {
    this.shield.destroy();
  }

  sync(now: number, ninja: NinjaBody): void {
    this.shield.clear();
    if (!this.isActive(now)) {
      return;
    }
    const angle = Math.atan2(ninja.aim.y, ninja.aim.x);
    const remaining = (this.activeUntil - now) / COMBAT.blockDurationMs;
    this.shield.setPosition(ninja.x, ninja.y);
    this.shield.lineStyle(10, COLORS.paper, 0.55 + remaining * 0.4);
    this.shield.beginPath();
    this.shield.arc(0, 0, 30, angle - 1.05, angle + 1.05);
    this.shield.strokePath();
    this.shield.lineStyle(5, COLORS.cyan, 0.85 + remaining * 0.15);
    this.shield.beginPath();
    this.shield.arc(0, 0, 24, angle - 0.95, angle + 0.95);
    this.shield.strokePath();
  }
}
