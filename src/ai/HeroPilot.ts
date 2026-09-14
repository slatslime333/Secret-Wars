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
import { MovementCommit } from './tactical/locomotion';
import { moveGoal } from './tactical/move';
import type { TacticalDebugInfo } from './tactical/types';

/**
 * Match CPU. Movement and swings still use the hero kit; decisions come from
 * the shared tactical layer rather than nearest-enemy chase.
 */
export class HeroPilot {
  private tapQueued = false;
  private holdUntil = 0;
  private pauseUntil = 0;
  private hitsIntoBlock = 0;
  private readonly move = new Phaser.Math.Vector2();
  private readonly foes: NinjaBody[] = [];
  readonly mind: TacticalMind;
  private readonly combat = new CombatDriver();
  private readonly loco: MovementCommit;

  constructor(unit: HeroRuntime) {
    const pad = laneSpawn(unit.team, unit.lane);
    this.mind = new TacticalMind('hero', unit.instanceId, pad.x, pad.y);
    this.loco = new MovementCommit(this.mind.personality);
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
    allies: NinjaBody[] = [],
  ): void {
    if (!unit.alive) {
      unit.body.stop();
      return;
    }

    const body = unit.body;
    field.fillEnemies(body, this.foes);
    const foes = this.foes;
    body.regenStamina(delta, now);
    body.regenBlockShield(delta, now);
    body.regenHealth(delta, now);
    unit.block.tick(delta, now, body);
    unit.dash.apply(now, body);

    this.mind.think(now, body, field, scene);
    const target = this.mind.target;
    const objective = this.mind.situationView().objective;
    if (target) {
      body.setAim(target.x - body.x, target.y - body.y);
    } else if (this.mind.action === 'contest_objective' && objective) {
      body.setAim(objective.x - body.x, objective.y - body.y);
    } else {
      body.setAim(body.team === 'alpha' ? 1 : -1, 0);
    }

    const abilityCtx = unit.abilityContext(now, delta, foes, world, undefined, allies);
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
      unit.dash.isActive(now)
    ) {
      if (
        !body.status.isHitReacting(now) &&
        !body.status.isLunging(now) &&
        !body.status.isHitStopping(now) &&
        !unit.dash.isActive(now)
      ) {
        body.stop();
      }
      unit.attacks.update(now, false, false, body, foes, foeBlock);
      return;
    }

    this.walk(now, body, scene);
    this.queueSwing(now, body, target, objective);

    const smashRange = objectiveInHitRange(body, objective, this.mind.action);
    const inRange = target
      ? distance(body, target) <= body.stats.attackRange * 1.08
      : smashRange;
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

  private queueSwing(
    now: number,
    body: NinjaBody,
    target: NinjaBody | undefined,
    objective?: { kind: string; x: number; y: number; radius: number },
  ): void {
    if (!this.mind.wantsAttack() || !body.canAttack(now) || now < this.pauseUntil) {
      return;
    }
    const smash = objectiveInHitRange(body, objective, this.mind.action);
    if (!target) {
      if (!smash) {
        return;
      }
      if (now < this.holdUntil) {
        return;
      }
      const roll = Math.random();
      this.tapQueued = roll > 0.5;
      this.holdUntil = now + (this.tapQueued ? 90 : 130 + Math.random() * 120);
      return;
    }
    const targetReachable = distance(body, target) <= body.stats.attackRange * 1.08;
    if (!targetReachable) {
      if (!smash) {
        return;
      }
      if (now < this.holdUntil) {
        return;
      }
      const roll = Math.random();
      this.tapQueued = roll > 0.5;
      this.holdUntil = now + (this.tapQueued ? 90 : 130 + Math.random() * 120);
      return;
    }
    if (now < this.holdUntil) {
      return;
    }
    if (target.blocking) {
      this.hitsIntoBlock += 1;
      const notice = 0.4 + this.mind.personality.reactionQuality * 0.4 + this.mind.personality.caution * 0.15;
      if (this.hitsIntoBlock >= 1 && Math.random() < notice) {
        this.pauseUntil = now + 160 + Math.random() * 220;
        this.holdUntil = this.pauseUntil;
        return;
      }
    } else {
      this.hitsIntoBlock = 0;
    }
    if (this.mind.action === 'wait_for_opening' && !isOpening(now, body, target)) {
      return;
    }
    const roll = Math.random();
    if (roll < 0.16 + this.mind.personality.caution * 0.12 + (target.blocking ? 0.22 : 0)) {
      this.pauseUntil = now + 80 + Math.random() * 140;
      return;
    }
    this.tapQueued = roll > 0.58 + this.mind.personality.aggression * 0.12;
    this.holdUntil = now + (this.tapQueued ? 90 : 140 + Math.random() * 140 + this.mind.personality.patience * 40);
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
        id: this.mind.situationView().self.id,
      },
      now,
      this.mind.homeX,
      this.mind.homeY,
      target
        ? {
            x: target.x,
            y: target.y,
            aimX: target.aim.x,
            aimY: target.aim.y,
            vx: target.body?.velocity.x,
            vy: target.body?.velocity.y,
          }
        : undefined,
      ally ? { x: ally.x, y: ally.y, aimX: ally.aim.x, aimY: ally.aim.y } : undefined,
      this.mind.intent.flankSign,
      this.mind.situationView().self.id,
      this.mind.goal,
      this.mind.moveHint(),
    );
    if (goal.halt) {
      this.loco.reset();
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
    if (len < 12) {
      this.loco.reset();
      body.stop();
      return;
    }
    dx /= len;
    dy /= len;
    const committed = this.loco.heading(now, dx, dy, this.mind.personality);
    const steered = battlefieldOf(scene)?.query.steer(body.x, body.y, committed.x, committed.y) ?? committed;
    if (steered.x === 0 && steered.y === 0) {
      body.stop();
      return;
    }
    this.move.set(steered.x, steered.y);
    body.applyMove(this.move);
  }
}

const distance = (a: NinjaBody, b: NinjaBody): number => Math.hypot(a.x - b.x, a.y - b.y);

const objectiveInHitRange = (
  body: NinjaBody,
  objective: { kind: string; x: number; y: number; radius: number } | undefined,
  action: string,
): boolean => {
  if (!objective || action !== 'contest_objective') {
    return false;
  }
  if (objective.kind !== 'golden_piggy' && objective.kind !== 'executioner') {
    return false;
  }
  return Math.hypot(body.x - objective.x, body.y - objective.y) <= body.stats.attackRange + objective.radius + 10;
};

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
