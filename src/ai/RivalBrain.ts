import Phaser from 'phaser';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { QuickAttack } from '../combat/QuickAttack';
import { NinjaBody } from '../heroes/NinjaBody';

/**
 * Imperfect rival Ninja. Uses the same attack / shield / dash kit as the player
 * with delayed, sometimes-wrong decisions so it never feels frame-perfect.
 */
export class RivalBrain {
  private nextDecisionAt = 0;
  private tapQueued = false;
  private holdUntil = 0;
  private blockHoldUntil = 0;
  private lastPlayerSwingSeen = -9999;
  private readonly chase = new Phaser.Math.Vector2();

  constructor(
    private readonly attacks: QuickAttack,
    private readonly block: BlockController,
    private readonly dash: DashController,
    private readonly playerBlock: BlockController,
  ) {}

  update(now: number, delta: number, cpu: NinjaBody, player: NinjaBody): void {
    if (cpu.down || player.down) {
      this.block.setHeld(now, cpu, false);
      return;
    }

    cpu.tickAmmo(now);
    cpu.setAim(player.x - cpu.x, player.y - cpu.y);
    const distance = Math.hypot(player.x - cpu.x, player.y - cpu.y);
    const inRange = distance <= cpu.stats.attackRange * 1.05;

    this.dash.apply(now, cpu);
    this.block.setHeld(now, cpu, now < this.blockHoldUntil && !this.dash.isActive(now));
    this.block.tick(delta, now, cpu);
    this.block.sync(now, cpu);

    if (cpu.status.isBlockStunned(now) || cpu.status.isClashLocked(now)) {
      cpu.stop();
      this.attacks.update(now, false, false, cpu, [player], this.playerBlock);
      return;
    }

    if (this.dash.isActive(now)) {
      this.attacks.update(now, false, false, cpu, [player], this.playerBlock);
      return;
    }

    if (now >= this.nextDecisionAt) {
      this.choose(now, cpu, player, distance, inRange);
    }

    if (cpu.status.shouldLockMovement(now) || this.block.isActive(now)) {
      if (!cpu.status.isHitReacting(now) && !cpu.status.isLunging(now)) {
        cpu.stop();
      }
    } else {
      this.move(cpu, player, distance, now);
    }

    const held = now < this.holdUntil && inRange && cpu.canAttack(now);
    const pressed = this.tapQueued && cpu.canAttack(now);
    this.tapQueued = false;
    if (
      !cpu.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now) &&
      !cpu.status.cannotAttack(now)
    ) {
      this.attacks.update(now, held, pressed, cpu, [player], this.playerBlock);
    } else {
      this.attacks.update(now, false, false, cpu, [player], this.playerBlock);
    }
  }

  private choose(
    now: number,
    cpu: NinjaBody,
    player: NinjaBody,
    distance: number,
    inRange: boolean,
  ): void {
    this.nextDecisionAt = now + 280 + Math.random() * 320;
    const playerSwinging = now - player.status.lastAttackAt < 200;
    const recentlyHit = cpu.status.isHitReacting(now);
    const roll = Math.random();

    if (recentlyHit && distance < cpu.stats.attackRange * 1.4 && roll < 0.38) {
      this.chase.copy(cpu.aim).scale(-1);
      if (this.dash.tryStart(now, this.chase, cpu.aim, cpu)) {
        this.blockHoldUntil = 0;
        return;
      }
    }

    if (playerSwinging && inRange && player.status.lastAttackAt !== this.lastPlayerSwingSeen) {
      this.lastPlayerSwingSeen = player.status.lastAttackAt;
      if (roll < 0.42 && cpu.stamina > 12) {
        this.blockHoldUntil = now + 380 + Math.random() * 280;
        return;
      }
    }

    if (cpu.ammo <= 0) {
      if (distance < cpu.stats.attackRange * 1.6 && roll < 0.28) {
        this.chase.copy(cpu.aim).scale(-1);
        this.dash.tryStart(now, this.chase, cpu.aim, cpu);
      }
      return;
    }

    if (inRange && player.status.isBlockStunned(now) && roll < 0.7) {
      this.blockHoldUntil = 0;
      this.queueAttack(now, true);
      return;
    }

    if (inRange) {
      if (roll < 0.38) {
        return;
      }
      this.blockHoldUntil = 0;
      this.queueAttack(now, roll > 0.72);
      return;
    }

    if (distance > cpu.stats.attackRange * 2.2 && roll < 0.18) {
      this.dash.tryStart(now, cpu.aim, cpu.aim, cpu);
    }
  }

  private queueAttack(now: number, tap: boolean): void {
    if (tap) {
      this.tapQueued = true;
      this.holdUntil = now + 90;
    } else {
      this.holdUntil = now + 160 + Math.random() * 140;
    }
  }

  private move(cpu: NinjaBody, player: NinjaBody, distance: number, now: number): void {
    if (this.block.isActive(now)) {
      cpu.stop();
      return;
    }
    const preferred = cpu.stats.attackRange * 0.72;
    const dx = player.x - cpu.x;
    const dy = player.y - cpu.y;
    const length = Math.hypot(dx, dy) || 1;
    if (distance > preferred + 18) {
      this.chase.set(dx / length, dy / length);
      cpu.applyMove(this.chase);
    } else if (distance < preferred - 22 && cpu.status.isHitReacting(now)) {
      this.chase.set(-dx / length, -dy / length);
      cpu.applyMove(this.chase);
    } else {
      cpu.stop();
    }
  }
}
