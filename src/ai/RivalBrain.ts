import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { QuickAttack } from '../combat/QuickAttack';
import type { AbilityController } from '../heroes/abilities/AbilityController';
import type { AbilitySlot } from '../heroes/abilities/types';
import type { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { NinjaBody } from '../heroes/NinjaBody';
import { battlefieldOf } from '../map';
import { CombatDriver } from './combatDriver';
import { TacticalField } from './tactical/field';
import { TacticalMind } from './tactical/mind';
import { MovementCommit, resolveCpuWalk } from './tactical/locomotion';
import { moveGoal } from './tactical/move';
import { SwingIntent } from './tactical/swingIntent';
import type { TacticalDebugInfo } from './tactical/types';
import { stampKitPressure } from '../heroes/kitPressure';
import { menderPulseHealTarget } from './tactical/supportSense';

/**
 * Play Test rival. Same attack / shield / dash kit as the player, with
 * battlefield decisions from the shared tactical layer and imperfect reflexes.
 */
export class RivalBrain {
  private readonly chase = new Phaser.Math.Vector2();
  private readonly foes: NinjaBody[] = [];
  private readonly mates: NinjaBody[] = [];
  readonly mind: TacticalMind;
  private readonly combat = new CombatDriver();
  private readonly swing = new SwingIntent();
  private readonly loco: MovementCommit;

  constructor(
    private readonly attacks: QuickAttack,
    private readonly block: BlockController,
    private readonly dash: DashController,
    private readonly playerBlock: BlockController,
    private readonly abilities?: AbilityController,
    private readonly world?: AbilityWorld,
    seed = 'playtest-rival',
  ) {
    const pad = ARENA.teamSpawns.bravo;
    this.mind = new TacticalMind('hero', seed, pad.x, pad.y);
    this.loco = new MovementCommit(this.mind.personality);
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
    field.fillAllyBodies(cpu, this.mates);
    const foes = this.foes;
    stampKitPressure(cpu, now, this.abilities, this.dash);
    cpu.regenHealth(delta, now);
    cpu.regenStamina(delta, now);
    cpu.regenBlockShield(delta, now);
    this.mind.think(now, cpu, field, scene);
    const objective = this.mind.situationView().objective;
    const target = this.mind.action === 'contest_objective' ? this.mind.target : (this.mind.target ?? foes[0]);
    const heal = cpu.heroId === 'mender' ? menderPulseHealTarget(this.mind.situationView(), this.mind.intent.ally) : undefined;
    const focus = heal ?? target;
    if (focus) {
      const lead = this.combat.sense.aimLead(focus, Math.random);
      cpu.setAim(lead.x - cpu.x, lead.y - cpu.y);
    } else if (this.mind.action === 'contest_objective' && objective) {
      cpu.setAim(objective.x - cpu.x, objective.y - cpu.y);
    }

    this.dash.apply(now, cpu);
    const abilities = this.abilities;
    const abilityCtx = abilities && this.world
      ? {
          scene,
          now,
          delta,
          caster: cpu,
          enemies: foes,
          allies: this.mates,
          world: this.world,
          interruptCombat: () => {
            this.attacks.interrupt(now);
            this.dash.cancel(cpu);
            this.block.setHeld(now, cpu, false);
          },
          rivalBlock: this.playerBlock,
          holdAbilitySlot: (slot: AbilitySlot) => abilities.holdAbilitySlot(slot),
          releaseAbilitySlot: (slot: AbilitySlot, at: number, startCooldown: boolean) =>
            abilities.releaseAbilitySlot(slot, at, startCooldown),
        }
      : undefined;
    this.combat.tick({
      now,
      body: cpu,
      mind: this.mind,
      block: this.block,
      dash: this.dash,
      abilities: this.abilities,
      abilityCtx,
      world: this.world,
      scene,
      foes,
      rng: Math.random,
      stuck: this.loco.stuck,
    });
    if (this.combat.consumeDashLand()) {
      this.mind.think(now, cpu, field, scene, true);
    }
    this.block.tick(delta, now, cpu);
    this.block.sync(now, cpu);

    const control = this.abilities?.control;
    if (cpu.status.isBlockStunned(now) || cpu.status.isClashLocked(now)) {
      cpu.stop();
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock, this.mates);
      return;
    }

    if (this.dash.isActive(now) || control?.move) {
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock, this.mates);
      return;
    }

    if (cpu.status.shouldLockMovement(now)) {
      if (
        !cpu.status.isHitReacting(now) &&
        !cpu.status.isLunging(now) &&
        !cpu.status.isHitStopping(now)
      ) {
        cpu.stop();
      }
    } else {
      this.walk(now, cpu, scene);
    }
    if (this.loco.stuck.consumeCleared()) {
      this.mind.think(now, cpu, field, scene, true);
    }

    this.swing.decide({
      now,
      body: cpu,
      target: focus ?? target,
      objective,
      action: this.mind.action,
      wantsAttack: this.mind.wantsAttack() || Boolean(heal),
      personality: this.mind.personality,
      kit: this.mind.situationView().kit,
      sense: this.combat.sense,
      blocking: this.block.isActive(now),
      rng: Math.random,
    });
    const smashRange =
      this.mind.action === 'contest_objective' &&
      objective &&
      (objective.kind === 'golden_piggy' || objective.kind === 'executioner') &&
      Math.hypot(cpu.x - objective.x, cpu.y - objective.y) <= cpu.stats.attackRange + objective.radius + 10;
    const rangeMul = heal ? 2.15 : 1.32;
    const inRange = focus
      ? Math.hypot(focus.x - cpu.x, focus.y - cpu.y) <= cpu.stats.attackRange * rangeMul
      : Boolean(smashRange);
    const committed =
      this.mind.wantsAttack() ||
      Boolean(heal) ||
      this.combat.sense.chaining(now) ||
      this.combat.sense.counterReady(now);
    const buttons = this.swing.buttons(now, inRange, cpu.canAttack(now), committed);
    if (
      !control?.attack &&
      !cpu.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now) &&
      !cpu.status.cannotAttack(now)
    ) {
      this.attacks.update(now, buttons.held, buttons.pressed, cpu, foes, this.playerBlock, this.mates);
    } else {
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock, this.mates);
    }
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
      cpu.stop();
      return;
    }
    let dx = goal.x - cpu.x;
    let dy = goal.y - cpu.y;
    const strafe = this.combat.strafeDir(now);
    if (strafe) {
      dx = dx * 0.35 + strafe.x * 80;
      dy = dy * 0.35 + strafe.y * 80;
    }
    const walk = resolveCpuWalk(
      now,
      cpu.x,
      cpu.y,
      dx,
      dy,
      this.loco,
      this.mind.personality,
      this.mind.situationView().kit,
      battlefieldOf(scene)?.query,
      cpu.stats.moveSpeed,
      this.mind.moveHint()?.mates,
      cpu.stats.role,
    );
    if (this.loco.stuck.label) {
      this.mind.noteCombat(this.loco.stuck.label);
    }
    if (walk.stop) {
      cpu.stop();
      return;
    }
    this.chase.set(walk.x, walk.y);
    cpu.applyMove(this.chase);
  }
}
