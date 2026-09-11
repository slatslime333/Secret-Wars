import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { QuickAttack } from '../combat/QuickAttack';
import { NinjaBody } from '../heroes/NinjaBody';

/**
 * Imperfect rival Ninja. Uses the same attack / block / dash kit as the player
 * with delayed, sometimes-wrong decisions so it never feels frame-perfect.
 */
export class RivalBrain {
  private nextDecisionAt = 0;
  private tapQueued = false;
  private holdUntil = 0;
  private lastPlayerSwingSeen = -9999;
  private readonly chase = new Phaser.Math.Vector2();

  constructor(
    private readonly attacks: QuickAttack,
    private readonly block: BlockController,
    private readonly dash: DashController,
    private readonly playerBlock: BlockController,
  ) {}

  update(now: number, cpu: NinjaBody, player: NinjaBody): void {
    if (cpu.down || player.down) {
      cpu.stop();
      return;
    }

    cpu.setAim(player.x - cpu.x, player.y - cpu.y);
    const distance = Math.hypot(player.x - cpu.x, player.y - cpu.y);
    const inRange = distance <= NINJA.attackRange * 1.05;

    if (cpu.status.isBlockStunned(now) || cpu.status.isClashLocked(now)) {
      cpu.stop();
      this.attacks.update(now, false, false, cpu, player, this.playerBlock);
      return;
    }

    if (this.dash.isActive(now)) {
      this.dash.apply(now, cpu);
      this.attacks.update(now, false, false, cpu, player, this.playerBlock);
      return;
    }

    if (now >= this.nextDecisionAt) {
      this.choose(now, cpu, player, distance, inRange);
    }

    if (!this.dash.isActive(now) && !this.block.isActive(now)) {
      this.move(cpu, player, distance, now);
    } else if (!this.dash.isActive(now)) {
      cpu.stop();
    }

    const held = now < this.holdUntil && inRange;
    const pressed = this.tapQueued;
    this.tapQueued = false;
    if (
      !cpu.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now) &&
      !cpu.status.cannotAttack(now)
    ) {
      this.attacks.update(now, held, pressed, cpu, player, this.playerBlock);
    } else {
      this.attacks.update(now, false, false, cpu, player, this.playerBlock);
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
    const playerSwinging = now - player.status.lastAttackAt < 180;
    const recentlyHit = cpu.status.isHitReacting(now);
    const roll = Math.random();

    if (recentlyHit && distance < NINJA.attackRange * 1.4 && roll < 0.38) {
      this.chase.copy(cpu.aim).scale(-1);
      if (this.dash.tryStart(now, this.chase, cpu.aim, cpu)) {
        return;
      }
    }

    if (playerSwinging && inRange && player.status.lastAttackAt !== this.lastPlayerSwingSeen) {
      this.lastPlayerSwingSeen = player.status.lastAttackAt;
      if (roll < 0.42) {
        this.block.tryStart(now, cpu);
        return;
      }
    }

    if (inRange && player.status.isBlockStunned(now) && roll < 0.7) {
      this.queueAttack(now, true);
      return;
    }

    if (inRange) {
      if (roll < 0.38) {
        return;
      }
      this.queueAttack(now, roll > 0.72);
      return;
    }

    if (distance > NINJA.attackRange * 2.2 && roll < 0.18) {
      this.dash.tryStart(now, cpu.aim, cpu.aim, cpu);
    }
  }

  private queueAttack(now: number, tap: boolean): void {
    if (tap) {
      this.tapQueued = true;
      this.holdUntil = now + 90;
    } else {
      this.holdUntil = now + 140 + Math.random() * 120;
    }
  }

  private move(cpu: NinjaBody, player: NinjaBody, distance: number, now: number): void {
    if (this.block.isActive(now)) {
      cpu.stop();
      return;
    }
    const preferred = NINJA.attackRange * 0.72;
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
