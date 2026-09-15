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
import { SwingIntent } from './tactical/swingIntent';
import type { TacticalDebugInfo } from './tactical/types';
import { menderPulseHealTarget } from './tactical/supportSense';

/**
 * Match CPU. Movement and swings still use the hero kit; decisions come from
 * the shared tactical layer rather than nearest-enemy chase.
 */
export class HeroPilot {
  private readonly move = new Phaser.Math.Vector2();
  private readonly foes: NinjaBody[] = [];
  readonly mind: TacticalMind;
  private readonly combat = new CombatDriver();
  private readonly swing = new SwingIntent();
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
    const heal = body.heroId === 'mender' ? menderPulseHealTarget(this.mind.situationView(), this.mind.intent.ally) : undefined;
    const focus = heal ?? target;
    const objective = this.mind.situationView().objective;
    if (focus) {
      const lead = this.combat.sense.aimLead(focus, Math.random);
      body.setAim(lead.x - body.x, lead.y - body.y);
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
        !unit.abilities.isDrivingMovement() &&
        !body.status.isHitReacting(now) &&
        !body.status.isLunging(now) &&
        !body.status.isHitStopping(now) &&
        !unit.dash.isActive(now)
      ) {
        body.stop();
      }
      unit.attacks.update(now, false, false, body, foes, foeBlock, allies);
      return;
    }

    this.walk(now, body, scene);
    this.swing.decide({
      now,
      body,
      target: focus ?? target,
      objective,
      action: this.mind.action,
      wantsAttack: this.mind.wantsAttack() || Boolean(heal),
      personality: this.mind.personality,
      kit: this.mind.situationView().kit,
      sense: this.combat.sense,
      blocking: unit.block.isActive(now),
      rng: Math.random,
    });

    const smashRange = objectiveInHitRange(body, objective, this.mind.action);
    const rangeMul = heal ? 2.15 : 1.32;
    const inRange = focus
      ? distance(body, focus) <= body.stats.attackRange * rangeMul
      : smashRange;
    const committed =
      this.mind.wantsAttack() ||
      Boolean(heal) ||
      this.combat.sense.chaining(now) ||
      this.combat.sense.counterReady(now);
    const buttons = this.swing.buttons(now, inRange, body.canAttack(now), committed);
    if (
      !control.attack &&
      !body.down &&
      !unit.block.isActive(now) &&
      !unit.dash.isActive(now) &&
      !body.status.cannotAttack(now)
    ) {
      unit.attacks.update(now, buttons.held, buttons.pressed, body, foes, foeBlock, allies);
    } else {
      unit.attacks.update(now, false, false, body, foes, foeBlock, allies);
    }
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
