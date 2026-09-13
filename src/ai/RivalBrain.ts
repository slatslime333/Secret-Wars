import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { QuickAttack } from '../combat/QuickAttack';
import type { AbilityController } from '../heroes/abilities/AbilityController';
import type { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { NinjaBody } from '../heroes/NinjaBody';
import { battlefieldOf } from '../map';
import { CombatDriver } from './combatDriver';
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
  private readonly chase = new Phaser.Math.Vector2();
  private readonly foes: NinjaBody[] = [];
  readonly mind: TacticalMind;
  private readonly combat = new CombatDriver();

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
    cpu.regenHealth(delta, now);
    this.mind.think(now, cpu, field, scene);
    const target = this.mind.target ?? foes[0];
    if (target) {
      cpu.setAim(target.x - cpu.x, target.y - cpu.y);
    }

    this.dash.apply(now, cpu);
    const abilityCtx = this.abilities && this.world
      ? {
          scene,
          now,
          delta,
          caster: cpu,
          enemies: foes,
          world: this.world,
          interruptCombat: () => {
            this.attacks.interrupt(now);
            this.dash.cancel(cpu);
            this.block.setHeld(now, cpu, false);
          },
          rivalBlock: this.playerBlock,
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
    });
    this.block.tick(delta, now, cpu);
    this.block.sync(now, cpu);

    const control = this.abilities?.control;
    if (cpu.status.isBlockStunned(now) || cpu.status.isClashLocked(now)) {
      cpu.stop();
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock);
      return;
    }

    if (this.dash.isActive(now) || control?.move) {
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock);
      return;
    }

    if (cpu.status.shouldLockMovement(now) || this.block.isActive(now)) {
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

    this.queueSwing(now, cpu, target);
    const inRange = target ? Math.hypot(target.x - cpu.x, target.y - cpu.y) <= cpu.stats.attackRange * 1.05 : false;
    const held = now < this.holdUntil && inRange && cpu.canAttack(now) && this.mind.wantsAttack();
    const pressed = this.tapQueued && cpu.canAttack(now) && this.mind.wantsAttack();
    this.tapQueued = false;
    if (
      !control?.attack &&
      !cpu.down &&
      !this.block.isActive(now) &&
      !this.dash.isActive(now) &&
      !cpu.status.cannotAttack(now)
    ) {
      this.attacks.update(now, held, pressed, cpu, foes, this.playerBlock);
    } else {
      this.attacks.update(now, false, false, cpu, foes, this.playerBlock);
    }
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
      this.tapQueued = true;
      this.holdUntil = now + 90;
      return;
    }
    if (this.mind.action === 'wait_for_opening' && !isOpening(now, cpu, target, distance)) {
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
      this.mind.goal,
      this.mind.moveHint(),
    );
    if (goal.halt || this.block.isActive(now)) {
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

const isOpening = (now: number, self: NinjaBody, target: NinjaBody, distance: number): boolean => {
  if (target.status.isBlockStunned(now) || target.status.isHitReacting(now)) {
    return true;
  }
  const sinceSwing = now - target.status.lastAttackAt;
  if (sinceSwing > 140 && sinceSwing < 400) {
    return Math.random() < 0.7;
  }
  if (target.stamina < 12 && distance <= self.stats.attackRange * 1.15) {
    return Math.random() < 0.55;
  }
  return Math.random() < 0.16;
};
