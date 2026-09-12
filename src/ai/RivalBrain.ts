import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { QuickAttack } from '../combat/QuickAttack';
import { NinjaBody } from '../heroes/NinjaBody';
import { battlefieldOf } from '../map';
import { TacticalField } from './tactical/field';
import { TacticalMind } from './tactical/mind';
import { moveGoal } from './tactical/move';
import type { TacticalDebugInfo } from './tactical/types';

/**
 * Play Test rival. Same attack / shield / dash kit as the player, with
 * battlefield decisions from the shared tactical layer and imperfect reflexes.
 */
export class RivalBrain {
  private tapQueued = false;
  private holdUntil = 0;
  private blockHoldUntil = 0;
  private lastPlayerSwingSeen = -9999;
  private nextDashAt = 0;
  private readonly chase = new Phaser.Math.Vector2();
  private readonly foes: NinjaBody[] = [];
  readonly mind: TacticalMind;

  constructor(
    private readonly attacks: QuickAttack,
    private readonly block: BlockController,
    private readonly dash: DashController,
    private readonly playerBlock: BlockController,
    seed = 'playtest-rival',
  ) {
    const pad = ARENA.teamSpawns.bravo;
    this.mind = new TacticalMind('hero', seed, pad.x, pad.y);
  }

  debugInfo(cpu: NinjaBody): TacticalDebugInfo {
    return this.mind.debugInfo(cpu);
  }

  update(now: number, delta: number, cpu: NinjaBody, field: TacticalField, scene: Phaser.Scene): void {
    if (cpu.down) {
      this.block.setHeld(now, cpu, false);
      return;
    }

    field.fillEnemies(cpu, this.foes);
    const foes = this.foes;
    cpu.tickAmmo(now);
    this.mind.think(now, cpu, field, scene);
    const target = this.mind.target ?? foes[0];
    if (target) {
      cpu.setAim(target.x - cpu.x, target.y - cpu.y);
    }

    this.dash.apply(now, cpu);
    this.reflex(now, cpu, target);
    this.block.tick(delta, now, cpu);
    this.block.sync(now, cpu);

    if (cpu.status.isBlockStunned(now) || cpu.status.isClashLocked(now)) {
      cpu.stop();
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock);
      return;
    }

    if (this.dash.isActive(now)) {
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock);
      return;
    }

    if (cpu.status.shouldLockMovement(now) || this.block.isActive(now)) {
      if (!cpu.status.isHitReacting(now) && !cpu.status.isLunging(now)) {
        cpu.stop();
      }
    } else {
      this.walk(now, cpu, scene);
    }

    this.queueSwing(now, cpu, target);
    const inRange = target ? Math.hypot(target.x - cpu.x, target.y - cpu.y) <= cpu.stats.attackRange * 1.05 : false;
    const held = now < this.holdUntil && inRange && cpu.canAttack(now) && this.mind.wantsAttack();
    const pressed = this.tapQueued && cpu.canAttack(now) && this.mind.wantsAttack();
    this.tapQueued = false;
    if (!cpu.down && !this.block.isActive(now) && !this.dash.isActive(now) && !cpu.status.cannotAttack(now)) {
      this.attacks.update(now, held, pressed, cpu, foes, this.playerBlock);
    } else {
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock);
    }
  }

  private reflex(now: number, cpu: NinjaBody, target: NinjaBody | undefined): void {
    const p = this.mind.personality;
    if (this.mind.wantsEscape() && now >= this.nextDashAt) {
      this.chase.set(this.mind.homeX - cpu.x, this.mind.homeY - cpu.y);
      if (this.dash.tryStart(now, this.chase, cpu.aim, cpu)) {
        this.blockHoldUntil = 0;
        this.nextDashAt = now + 480 + p.thinkJitterMs;
        return;
      }
    }
    if (!target) {
      this.block.setHeld(now, cpu, now < this.blockHoldUntil && !this.dash.isActive(now));
      return;
    }
    const distance = Math.hypot(target.x - cpu.x, target.y - cpu.y);
    const inRange = distance <= cpu.stats.attackRange * 1.05;
    const recentlyHit = cpu.status.isHitReacting(now);
    const roll = Math.random();
    if (recentlyHit && distance < cpu.stats.attackRange * 1.4 && roll < 0.28 + p.caution * 0.2) {
      this.chase.copy(cpu.aim).scale(-1);
      if (this.dash.tryStart(now, this.chase, cpu.aim, cpu)) {
        this.blockHoldUntil = 0;
        return;
      }
    }
    const playerSwinging = now - target.status.lastAttackAt < 200;
    if (playerSwinging && inRange && target.status.lastAttackAt !== this.lastPlayerSwingSeen) {
      this.lastPlayerSwingSeen = target.status.lastAttackAt;
      if (roll < 0.38 + p.caution * 0.16 && cpu.stamina > 12) {
        this.blockHoldUntil = now + 380 + Math.random() * 280;
      }
    }
    this.block.setHeld(now, cpu, now < this.blockHoldUntil && !this.dash.isActive(now));
  }

  private queueSwing(now: number, cpu: NinjaBody, target: NinjaBody | undefined): void {
    if (!target || !this.mind.wantsAttack() || !cpu.canAttack(now)) {
      return;
    }
    const distance = Math.hypot(target.x - cpu.x, target.y - cpu.y);
    if (distance > cpu.stats.attackRange * 1.05) {
      return;
    }
    if (now < this.holdUntil) {
      return;
    }
    const roll = Math.random();
    if (target.status.isBlockStunned(now) && roll < 0.7) {
      this.blockHoldUntil = 0;
      this.tapQueued = true;
      this.holdUntil = now + 90;
      return;
    }
    if (roll < 0.3 + this.mind.personality.caution * 0.12) {
      return;
    }
    this.tapQueued = roll > 0.72;
    this.holdUntil = now + (this.tapQueued ? 90 : 160 + Math.random() * 140);
  }

  private walk(now: number, cpu: NinjaBody, scene: Phaser.Scene): void {
    const target = this.mind.target;
    const ally = this.mind.intent.ally;
    const goal = moveGoal(
      this.mind.action,
      {
        x: cpu.x,
        y: cpu.y,
        team: cpu.team,
        attackRange: cpu.stats.attackRange,
        role: cpu.stats.role,
        kind: 'hero',
      },
      now,
      this.mind.homeX,
      this.mind.homeY,
      target ? { x: target.x, y: target.y, aimX: target.aim.x, aimY: target.aim.y } : undefined,
      ally ? { x: ally.x, y: ally.y, aimX: ally.aim.x, aimY: ally.aim.y } : undefined,
      this.mind.intent.flankSign,
      cpu.x,
    );
    if (goal.halt || this.block.isActive(now)) {
      cpu.stop();
      return;
    }
    const dx = goal.x - cpu.x;
    const dy = goal.y - cpu.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len < 10) {
      cpu.stop();
      return;
    }
    const steered = battlefieldOf(scene)?.query.steer(cpu.x, cpu.y, dx / len, dy / len) ?? { x: dx / len, y: dy / len };
    this.chase.set(steered.x, steered.y);
    cpu.applyMove(this.chase);
  }
}
