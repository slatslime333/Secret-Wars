import Phaser from 'phaser';
import { laneSpawn } from '../config/arena';
import { battlefieldOf } from '../map';
import type { HeroRuntime } from '../match/HeroRuntime';
import type { NinjaBody } from '../heroes/NinjaBody';
import type { BlockController } from '../combat/BlockController';
import { TacticalField } from './tactical/field';
import { TacticalMind } from './tactical/mind';
import { moveGoal } from './tactical/move';
import type { TacticalDebugInfo } from './tactical/types';

/**
 * Match CPU. Movement and swings still use the hero kit; decisions come from
 * the shared tactical layer rather than nearest-enemy chase.
 */
export class HeroPilot {
  private tapQueued = false;
  private holdUntil = 0;
  private blockHoldUntil = 0;
  private nextDashAt = 0;
  private lastSwingSeen = -9999;
  private readonly move = new Phaser.Math.Vector2();
  private readonly dashDir = new Phaser.Math.Vector2();
  private readonly foes: NinjaBody[] = [];
  readonly mind: TacticalMind;

  constructor(unit: HeroRuntime) {
    const pad = laneSpawn(unit.team, unit.lane);
    this.mind = new TacticalMind('hero', unit.instanceId, pad.x, pad.y);
  }

  debugInfo(unit: HeroRuntime): TacticalDebugInfo {
    return this.mind.debugInfo(unit.body);
  }

  update(
    now: number,
    delta: number,
    unit: HeroRuntime,
    field: TacticalField,
    scene: Phaser.Scene,
    foeBlock?: BlockController,
  ): void {
    if (!unit.alive) {
      unit.body.stop();
      return;
    }

    const body = unit.body;
    field.fillEnemies(body, this.foes);
    const foes = this.foes;
    body.tickAmmo(now);
    if (!unit.block.isActive(now)) {
      body.regenStamina(delta, now);
    }
    unit.block.tick(delta, now, body);
    unit.dash.apply(now, body);

    this.mind.think(now, body, field, scene);
    const target = this.mind.target;
    if (target) {
      body.setAim(target.x - body.x, target.y - body.y);
    } else {
      body.setAim(body.team === 'alpha' ? 1 : -1, 0);
    }

    this.reflex(now, unit, target);
    unit.block.sync(now, body);

    if (body.status.shouldLockMovement(now) || unit.block.isActive(now) || unit.dash.isActive(now)) {
      if (!body.status.isHitReacting(now) && !body.status.isLunging(now) && !unit.dash.isActive(now)) {
        body.stop();
      }
      unit.attacks.update(now, false, false, body, foes, foeBlock);
      return;
    }

    this.walk(now, body, scene);
    this.queueSwing(now, body, target);

    const inRange = target ? distance(body, target) <= body.stats.attackRange * 1.08 : false;
    const held = now < this.holdUntil && inRange && body.canAttack(now) && this.mind.wantsAttack();
    const pressed = this.tapQueued && body.canAttack(now) && this.mind.wantsAttack();
    this.tapQueued = false;
    if (!body.down && !unit.block.isActive(now) && !unit.dash.isActive(now) && !body.status.cannotAttack(now)) {
      unit.attacks.update(now, held, pressed, body, foes, foeBlock);
    } else {
      unit.attacks.update(now, false, false, body, foes, foeBlock);
    }
  }

  private reflex(now: number, unit: HeroRuntime, target: NinjaBody | undefined): void {
    const body = unit.body;
    const p = this.mind.personality;
    if (this.mind.wantsEscape() && now >= this.nextDashAt && unit.dash.chargeCount > 0) {
      this.dashDir.set(this.mind.homeX - body.x, this.mind.homeY - body.y);
      if (this.dashDir.lengthSq() > 4 && unit.dash.tryStart(now, this.dashDir, body.aim, body)) {
        this.blockHoldUntil = 0;
        this.nextDashAt = now + 520 + p.thinkJitterMs;
        return;
      }
    }
    if (!target || unit.dash.isActive(now)) {
      unit.block.setHeld(now, body, now < this.blockHoldUntil);
      return;
    }
    const close = distance(body, target) <= body.stats.attackRange * 1.35;
    const swinging = now - target.status.lastAttackAt < 200 && target.status.lastAttackAt !== this.lastSwingSeen;
    if (close && swinging && body.stamina > 12 && Math.random() < 0.28 + p.caution * 0.22) {
      this.lastSwingSeen = target.status.lastAttackAt;
      this.blockHoldUntil = now + 320 + Math.random() * 240;
    }
    unit.block.setHeld(now, body, now < this.blockHoldUntil && !unit.dash.isActive(now));
  }

  private queueSwing(now: number, body: NinjaBody, target: NinjaBody | undefined): void {
    if (!target || !this.mind.wantsAttack() || !body.canAttack(now)) {
      return;
    }
    if (distance(body, target) > body.stats.attackRange * 1.08) {
      return;
    }
    if (now < this.holdUntil) {
      return;
    }
    const roll = Math.random();
    if (roll < 0.22 + this.mind.personality.caution * 0.12) {
      return;
    }
    this.tapQueued = roll > 0.62;
    this.holdUntil = now + (this.tapQueued ? 90 : 150 + Math.random() * 120);
  }

  private walk(now: number, body: NinjaBody, scene: Phaser.Scene): void {
    const target = this.mind.target;
    const ally = this.mind.intent.ally;
    const goal = moveGoal(
      this.mind.action,
      {
        x: body.x,
        y: body.y,
        team: body.team,
        attackRange: body.stats.attackRange,
        role: body.stats.role,
        kind: 'hero',
      },
      now,
      this.mind.homeX,
      this.mind.homeY,
      target
        ? { x: target.x, y: target.y, aimX: target.aim.x, aimY: target.aim.y }
        : undefined,
      ally ? { x: ally.x, y: ally.y, aimX: ally.aim.x, aimY: ally.aim.y } : undefined,
      this.mind.intent.flankSign,
      body.x + body.y,
    );
    if (goal.halt) {
      body.stop();
      return;
    }
    let dx = goal.x - body.x;
    let dy = goal.y - body.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len < 10) {
      body.stop();
      return;
    }
    dx /= len;
    dy /= len;
    const steered = battlefieldOf(scene)?.query.steer(body.x, body.y, dx, dy) ?? { x: dx, y: dy };
    if (steered.x === 0 && steered.y === 0) {
      body.stop();
      return;
    }
    this.move.set(steered.x, steered.y);
    body.applyMove(this.move);
  }
}

const distance = (a: NinjaBody, b: NinjaBody): number => Math.hypot(a.x - b.x, a.y - b.y);
