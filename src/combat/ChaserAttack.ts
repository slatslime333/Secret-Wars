import Phaser from 'phaser';
import { CHASER } from '../config/chaser';
import { COMBAT, attackHalfArcRad } from '../config/combat';
import { NINJA } from '../config/ninja';
import { playHitJuice } from '../effects/hitJuice';
import { spawnHitSpark } from '../effects/hitSpark';
import { applyDefense } from './damage';
import { isInAttackArc } from './hitDetection';
import { BlockController } from './BlockController';
import { ChaserBody } from '../heroes/ChaserBody';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

/** Basic melee: telegraph, then one swing. Cancelled if stunned during windup. */
export class ChaserAttack {
  private windupUntil = 0;
  private pending = false;
  private readyAt = 0;
  private readonly telegraph: Phaser.GameObjects.Graphics;
  private slash?: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.telegraph = scene.add.graphics().setDepth(11);
  }

  get winding(): boolean {
    return this.pending && this.scene.time.now < this.windupUntil;
  }

  tryStart(now: number, chaser: ChaserBody): boolean {
    if (this.pending || now < this.readyAt || chaser.down || chaser.isStunned(now)) {
      return false;
    }
    this.pending = true;
    this.windupUntil = now + COMBAT.chaserWindupMs;
    return true;
  }

  update(now: number, chaser: ChaserBody, ninja: NinjaBody, block: BlockController): void {
    if (this.pending && chaser.isStunned(now)) {
      this.cancel();
      return;
    }
    this.drawTelegraph(chaser);
    if (!this.pending || now < this.windupUntil) {
      return;
    }
    this.pending = false;
    this.readyAt = now + CHASER.attackCooldownMs;
    chaser.playAttackAnimation(now);
    this.flashSlash(chaser);
    this.tryHit(chaser, ninja, block, now);
  }

  private cancel(): void {
    this.pending = false;
    this.windupUntil = 0;
    this.telegraph.clear();
  }

  private tryHit(chaser: ChaserBody, ninja: NinjaBody, block: BlockController, now: number): void {
    if (ninja.down) {
      return;
    }
    const connected = isInAttackArc(
      chaser.x,
      chaser.y,
      chaser.aim.x,
      chaser.aim.y,
      ninja.x,
      ninja.y,
      CHASER.attackRange + COMBAT.hitForgiveness,
      attackHalfArcRad,
      NINJA.bodyRadius,
    );
    if (!connected) {
      return;
    }
    if (ninja.isInvulnerable(now)) {
      return;
    }
    if (block.tryAbsorb(now, ninja, chaser.x, chaser.y).absorbed) {
      playHitJuice(this.scene, ninja.x, ninja.y, { damage: 0, blocked: true });
      return;
    }
    const damage = applyDefense(CHASER.attackDamage, ninja.defense);
    ninja.takeHit({
      damage,
      dirX: chaser.aim.x,
      dirY: chaser.aim.y,
      knockback: CHASER.knockbackPower,
      staminaDamage: COMBAT.combo[1].staminaDamage,
      step: 1,
    });
    spawnHitSpark(this.scene, ninja.x + chaser.aim.x * 10, ninja.y + chaser.aim.y * 10);
    playHitJuice(this.scene, ninja.x, ninja.y, { damage });
  }

  private drawTelegraph(chaser: ChaserBody): void {
    this.telegraph.clear();
    if (!this.winding) {
      return;
    }
    const angle = Math.atan2(chaser.aim.y, chaser.aim.x);
    const half = attackHalfArcRad;
    this.telegraph.setPosition(chaser.x, chaser.y);
    this.telegraph.fillStyle(COLORS.redBright, 0.22);
    this.telegraph.beginPath();
    this.telegraph.moveTo(0, 0);
    this.telegraph.arc(0, 0, CHASER.attackRange, angle - half, angle + half);
    this.telegraph.closePath();
    this.telegraph.fillPath();
    this.telegraph.lineStyle(3, COLORS.redBright, 0.95);
    this.telegraph.beginPath();
    this.telegraph.arc(0, 0, CHASER.attackRange, angle - half, angle + half);
    this.telegraph.strokePath();
  }

  private flashSlash(chaser: ChaserBody): void {
    this.slash?.destroy();
    const graphics = this.scene.add.graphics().setDepth(13);
    const angle = Math.atan2(chaser.aim.y, chaser.aim.x);
    graphics.setPosition(chaser.x, chaser.y);
    graphics.lineStyle(7, COLORS.redBright, 0.95);
    graphics.beginPath();
    graphics.arc(0, 0, CHASER.attackRange * 0.84, angle - attackHalfArcRad, angle + attackHalfArcRad);
    graphics.strokePath();
    this.slash = graphics;
    this.scene.time.delayedCall(140, () => {
      graphics.destroy();
      if (this.slash === graphics) {
        this.slash = undefined;
      }
    });
  }
}
