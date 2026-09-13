import Phaser from 'phaser';
import { laneSpawn } from '../config/arena';
import { battlefieldOf } from '../map';
import type { HeroRuntime } from '../match/HeroRuntime';
import type { NinjaBody } from '../heroes/NinjaBody';
import type { BlockController } from '../combat/BlockController';
import type { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { CombatDriver } from './combatDriver';
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
  private readonly move = new Phaser.Math.Vector2();
  private readonly foes: NinjaBody[] = [];
  readonly mind: TacticalMind;
  private readonly combat = new CombatDriver();

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
    world: AbilityWorld,
    foeBlock?: BlockController,
  ): void {
    if (!unit.alive) {
      unit.body.stop();
      return;
    }

    const body = unit.body;
    field.fillEnemies(body, this.foes);
    const foes = this.foes;
    if (!unit.block.isActive(now)) {
      body.regenStamina(delta, now);
    }
    body.regenHealth(delta, now);
    unit.block.tick(delta, now, body);
    unit.dash.apply(now, body);

    this.mind.think(now, body, field, scene);
    const target = this.mind.target;
    if (target) {
      body.setAim(target.x - body.x, target.y - body.y);
    } else {
      body.setAim(body.team === 'alpha' ? 1 : -1, 0);
    }

    const abilityCtx = unit.abilityContext(now, delta, foes, world);
    abilityCtx.rivalBlock = foeBlock;
    this.combat.tick({
      now,
      body,
      mind: this.mind,
      block: unit.block,
      dash: unit.dash,
      abilities: unit.abilities,
      abilityCtx,
      world,
      scene,
      foes,
      rng: Math.random,
    });
    unit.block.sync(now, body);

    const control = unit.abilities.control;
    if (
      control.move ||
      body.status.shouldLockMovement(now) ||
      unit.block.isActive(now) ||
      unit.dash.isActive(now)
    ) {
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
    if (
      !control.attack &&
      !body.down &&
      !unit.block.isActive(now) &&
      !unit.dash.isActive(now) &&
      !body.status.cannotAttack(now)
    ) {
      unit.attacks.update(now, held, pressed, body, foes, foeBlock);
    } else {
      unit.attacks.update(now, false, false, body, foes, foeBlock);
    }
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
    if (this.mind.action === 'wait_for_opening' && !isOpening(now, body, target)) {
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
      this.mind.goal,
    );
    if (goal.halt) {
      body.stop();
      return;
    }
    let dx = goal.x - body.x;
    let dy = goal.y - body.y;
    const strafe = this.combat.strafeDir(now);
    if (strafe) {
      dx = dx * 0.35 + strafe.x * 80;
      dy = dy * 0.35 + strafe.y * 80;
    }
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

const isOpening = (now: number, self: NinjaBody, target: NinjaBody): boolean => {
  if (target.status.isBlockStunned(now) || target.status.isHitReacting(now)) {
    return true;
  }
  const sinceSwing = now - target.status.lastAttackAt;
  if (sinceSwing > 140 && sinceSwing < 400) {
    return Math.random() < 0.7;
  }
  if (target.stamina < 12 && distance(self, target) <= self.stats.attackRange * 1.15) {
    return Math.random() < 0.55;
  }
  return Math.random() < 0.16;
};
