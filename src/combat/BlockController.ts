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

/**
 * Hold-to-block directional shield.
 * Holding and blocked hits drain the fighter's shield HP, not stamina.
 * Walking remains allowed while the shield is up.
 */
export class BlockController {
  private holding = false;
  private raisedAt = -9999;
  private drainAcc = 0;
  private readonly shield: Phaser.GameObjects.Graphics;
  private drawn = false;
  private lastAngle = 999;
  private lastPerfect = false;

  constructor(scene: Phaser.Scene) {
    this.shield = scene.add.graphics().setDepth(11);
  }

  setHeld(now: number, ninja: NinjaBody, held: boolean): void {
    if (!held || ninja.down || ninja.status.isBlockStunned(now)) {
      this.drop(ninja);
      return;
    }
    if (!ninja.canRaiseBlock()) {
      this.drop(ninja);
      return;
    }
    if (!this.holding) {
      this.holding = true;
      this.raisedAt = now;
      this.drainAcc = 0;
      ninja.blocking = true;
      spawnCombatCallout(this.shield.scene, ninja.x, ninja.y, 'SHIELD', COLORS.cyan);
    }
  }

  tick(deltaMs: number, now: number, ninja: NinjaBody): void {
    if (!this.holding) {
      ninja.blocking = false;
      return;
    }
    if (ninja.down || ninja.status.isBlockStunned(now)) {
      this.drop(ninja);
      return;
    }
    this.drainAcc += COMBAT.blockDrainPerSecond * (deltaMs / 1000);
    const spent = Math.floor(this.drainAcc);
    if (spent > 0) {
      this.drainAcc -= spent;
      ninja.drainBlockShield(spent, now);
    }
    if (!ninja.canRaiseBlock()) {
      this.breakShield(ninja);
    }
  }

  isActive(now?: number): boolean {
    return this.holding && (now === undefined || now >= 0);
  }

  isPerfect(now: number): boolean {
    return this.holding && now - this.raisedAt <= COMBAT.perfectShieldWindowMs;
  }

  /** True when the held shield is up and facing the attacker. */
  tryAbsorb(now: number, ninja: NinjaBody, fromX: number, fromY: number): BlockAbsorbResult {
    if (!this.holding || ninja.blockShield <= 0) {
      return { absorbed: false, perfect: false };
    }
    const covered = isInAttackArc(ninja.x, ninja.y, ninja.aim.x, ninja.aim.y, fromX, fromY, 420, 0.95, 8);
    if (!covered) {
      return { absorbed: false, perfect: false };
    }
    return { absorbed: true, perfect: this.isPerfect(now) };
  }

  breakShield(ninja: NinjaBody): void {
    if (!this.holding && !ninja.blocking) {
      return;
    }
    spawnCombatCallout(this.shield.scene, ninja.x, ninja.y, 'SHIELD BREAK', COLORS.orange);
    this.drop(ninja);
  }

  destroy(): void {
    this.shield.destroy();
  }

  sync(now: number, ninja: NinjaBody): void {
    if (!this.holding) {
      if (this.drawn) {
        this.shield.clear();
        this.drawn = false;
      }
      return;
    }
    const angle = Math.atan2(ninja.aim.y, ninja.aim.x);
    const perfect = this.isPerfect(now);
    this.shield.setPosition(ninja.x, ninja.y);
    if (this.drawn && Math.abs(angle - this.lastAngle) < 0.03 && perfect === this.lastPerfect) {
      return;
    }
    this.lastAngle = angle;
    this.lastPerfect = perfect;
    this.drawn = true;
    this.shield.clear();
    this.shield.lineStyle(10, COLORS.paper, perfect ? 0.95 : 0.62);
    this.shield.beginPath();
    this.shield.arc(0, 0, 30, angle - 1.05, angle + 1.05);
    this.shield.strokePath();
    this.shield.lineStyle(5, perfect ? COLORS.yellow : COLORS.cyan, perfect ? 1 : 0.9);
    this.shield.beginPath();
    this.shield.arc(0, 0, 24, angle - 0.95, angle + 0.95);
    this.shield.strokePath();
  }

  private drop(ninja: NinjaBody): void {
    this.holding = false;
    this.drainAcc = 0;
    ninja.blocking = false;
  }
}
