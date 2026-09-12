import Phaser from 'phaser';
import { playWorld } from '../audio';
import { MINION, MinionKind, RANGER_MINION, SWORD_MINION, minionAdvanceX } from '../config/minion';
import { NinjaBody } from '../heroes/NinjaBody';
import { resolveAbilityHit } from '../heroes/abilities/resolveAbilityHit';
import { Projectile } from '../combat/projectile';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { distanceBetween } from '../heroes/abilities/geometry';
import { battlefieldOf } from '../map';
import { TacticalField } from '../ai/tactical/field';
import { TacticalMind } from '../ai/tactical/mind';
import { moveGoal } from '../ai/tactical/move';
import type { TacticalAction } from '../ai/tactical/types';

export type MinionState = TacticalAction | 'recover';

export type MinionDebugInfo = {
  state: MinionState;
  targetLabel: string;
  distance: number;
  cooldownMs: number;
  team: string;
  hp: string;
  threat: string;
  allyCount: number;
  enemyCount: number;
  reason: string;
  targetScore: number;
};

/**
 * Advance the lane unless a nearby fight is actually worth taking.
 * Combat still uses the minion kit; targeting comes from TacticalMind.
 */
export class MinionBrain {
  state: MinionState = 'push_lane';
  target?: NinjaBody;
  private nextAttackAt = 0;
  private recoverUntil = 0;
  private acquireX = 0;
  private acquireY = 0;
  private attacking = false;
  private readonly steer = new Phaser.Math.Vector2();
  readonly mind: TacticalMind;

  constructor(
    readonly body: NinjaBody,
    readonly kind: MinionKind,
  ) {
    this.mind = new TacticalMind(
      'minion',
      `${body.team}:${kind}:${Math.round(body.x)}:${Math.round(body.y)}`,
      body.team === 'alpha' ? 400 : 1800,
      body.y,
    );
  }

  debugInfo(now: number): MinionDebugInfo {
    const info = this.mind.debugInfo(this.body);
    const target = this.target && !this.target.down ? this.target : undefined;
    return {
      state: this.attacking ? 'attack' : now < this.recoverUntil ? 'recover' : info.action,
      targetLabel: target ? labelOf(target) : info.targetLabel,
      distance: target ? distanceBetween(this.body.x, this.body.y, target.x, target.y) : 0,
      cooldownMs: Math.max(0, this.nextAttackAt - now),
      team: this.body.team,
      hp: info.hp,
      threat: info.threat,
      allyCount: info.allyCount,
      enemyCount: info.enemyCount,
      reason: info.reason,
      targetScore: info.targetScore,
    };
  }

  update(
    now: number,
    _delta: number,
    field: TacticalField,
    world: AbilityWorld,
    scene: Phaser.Scene,
  ): void {
    if (this.body.down) {
      this.body.stop();
      return;
    }
    this.mind.think(now, this.body, field, scene);
    this.syncTarget();
    this.act(now, world, scene);
  }

  private syncTarget(): void {
    const next = this.mind.target;
    if (next && next !== this.target) {
      this.target = next;
      this.acquireX = this.body.x;
      this.acquireY = this.body.y;
    } else if (!next) {
      this.target = undefined;
    }
    if (this.target && this.shouldDrop(this.target)) {
      this.target = undefined;
    }
    this.state = this.attacking ? 'attack' : this.mind.action;
  }

  private act(now: number, world: AbilityWorld, scene: Phaser.Scene): void {
    if (this.body.status.shouldLockMovement(now)) {
      return;
    }
    const target = this.target && !this.target.down ? this.target : undefined;
    if (target) {
      this.body.setAim(target.x - this.body.x, target.y - this.body.y);
    } else {
      this.body.setAim(minionAdvanceX(this.body.team), 0);
    }

    if (now < this.recoverUntil) {
      this.body.stop();
      this.state = 'recover';
      return;
    }

    const range = target ? this.body.stats.attackRange + target.stats.bodyRadius : 0;
    const inRange = target ? distanceBetween(this.body.x, this.body.y, target.x, target.y) <= range : false;
    if (this.mind.wantsAttack() && inRange && target) {
      this.body.stop();
      this.tryAttack(now, target, world, scene);
      return;
    }

    if (this.attacking) {
      this.body.stop();
      return;
    }

    const ally = this.mind.intent.ally;
    const goal = moveGoal(
      this.mind.action,
      {
        x: this.body.x,
        y: this.body.y,
        team: this.body.team,
        attackRange: this.body.stats.attackRange,
        role: this.body.stats.role,
        kind: 'minion',
      },
      now,
      this.mind.homeX,
      this.mind.homeY,
      target ? { x: target.x, y: target.y, aimX: target.aim.x, aimY: target.aim.y } : undefined,
      ally ? { x: ally.x, y: ally.y, aimX: ally.aim.x, aimY: ally.aim.y } : undefined,
      this.mind.intent.flankSign,
      this.body.y,
    );
    if (goal.halt) {
      this.body.stop();
      return;
    }
    let dx = goal.x - this.body.x;
    let dy = goal.y - this.body.y;
    if (this.mind.action === 'push_lane' || this.mind.action === 'advance' || this.mind.action === 'search_for_target') {
      dx = minionAdvanceX(this.body.team);
      dy = Phaser.Math.Clamp((this.mind.homeY - this.body.y) * 0.004, -0.35, 0.35);
    }
    const len = Math.hypot(dx, dy) || 1;
    const steered = battlefieldOf(scene)?.query.steer(this.body.x, this.body.y, dx / len, dy / len);
    if (steered) {
      this.steer.set(steered.x, steered.y);
    } else {
      this.steer.set(dx / len, dy / len);
    }
    this.body.applyMove(this.steer);
  }

  private tryAttack(now: number, target: NinjaBody, world: AbilityWorld, scene: Phaser.Scene): void {
    if (this.attacking || now < this.nextAttackAt || this.body.status.cannotAttack(now)) {
      return;
    }
    this.attacking = true;
    this.state = 'attack';
    if (this.kind === 'ranger') {
      this.fireArrow(now, target, world, scene);
    } else {
      this.swingSword(now, target, scene);
    }
  }

  private swingSword(now: number, target: NinjaBody, scene: Phaser.Scene): void {
    const spec = SWORD_MINION;
    this.body.playAttackAnimation(now, 1);
    playWorld('minion-attack', this.body);
    scene.time.delayedCall(spec.windupMs, () => {
      this.attacking = false;
      if (this.body.down || target.down) {
        return;
      }
      if (distanceBetween(this.body.x, this.body.y, target.x, target.y) > spec.attackRange + target.stats.bodyRadius + 12) {
        return;
      }
      const vsMinion = target.stats.role === 'minion';
      resolveAbilityHit(
        scene,
        scene.time.now,
        this.body,
        target,
        {
          rawDamage: spec.attackDamage,
          knockback: vsMinion ? spec.vsMinionKnockback : spec.knockbackPower,
          receivedKnockbackMul: vsMinion ? 1 : undefined,
          staminaDamage: 2,
          dirX: target.x - this.body.x,
          dirY: target.y - this.body.y,
          step: 1,
          hitReactionMs: MINION.hitReactionMs,
          heavy: false,
          sourceKind: 'other',
        },
      );
      this.body.status.markSwing(scene.time.now, 1);
      this.recoverUntil = scene.time.now + spec.recoveryMs;
      this.nextAttackAt = scene.time.now + spec.attackCooldownMs;
    });
  }

  private fireArrow(now: number, target: NinjaBody, world: AbilityWorld, scene: Phaser.Scene): void {
    const spec = RANGER_MINION;
    playWorld('minion-attack', this.body);
    this.body.playCustomAttack(now, spec.windupMs + 80, (frac) => ({
      swordAngleOffset: frac < 0.7 ? frac * 0.8 : 0.2,
      armLiftRight: 0.4,
    }));
    scene.time.delayedCall(spec.windupMs, () => {
      this.attacking = false;
      if (this.body.down) {
        return;
      }
      const ang = Math.atan2(target.y - this.body.y, target.x - this.body.x);
      const spread = (Math.random() - 0.5) * 2 * spec.spreadRad;
      const aim = ang + spread;
      const nx = Math.cos(aim);
      const ny = Math.sin(aim);
      this.body.setAim(nx, ny);
      const shot = new Projectile(
        scene,
        this.body.x + nx * 12,
        this.body.y + ny * 4,
        nx * spec.projectileSpeed,
        ny * spec.projectileSpeed,
        spec.projectileRadius,
        spec.projectileLifetimeMs,
        spec.projectileColor,
        'arrow',
      );
      const caster = this.body;
      world.addTicker({
        update: (tickNow, delta, fighters) => {
          const foes = fighters.filter((fighter) => fighter.team !== caster.team && !fighter.down);
          const result = shot.update(tickNow, delta / 1000, foes);
          if (result === 'dead') {
            return false;
          }
          if (result) {
            resolveAbilityHit(scene, tickNow, caster, result.target, {
              rawDamage: spec.attackDamage,
              knockback: spec.knockbackPower,
              staminaDamage: 1,
              dirX: nx,
              dirY: ny,
              step: 1,
              hitReactionMs: MINION.hitReactionMs,
              heavy: false,
              sourceKind: 'other',
            });
            return false;
          }
          return true;
        },
        destroy: () => shot.destroy(),
      });
      this.recoverUntil = scene.time.now + spec.recoveryMs;
      this.nextAttackAt = scene.time.now + spec.attackCooldownMs;
    });
  }

  private shouldDrop(target: NinjaBody): boolean {
    const fromAcquire = distanceBetween(this.acquireX, this.acquireY, target.x, target.y);
    const fromSelf = distanceBetween(this.body.x, this.body.y, target.x, target.y);
    return fromAcquire > MINION.leashRadius || fromSelf > MINION.leashRadius * 1.15;
  }
}

const labelOf = (unit: NinjaBody): string => {
  if (unit.stats.role === 'minion') {
    return unit.stats.displayName;
  }
  return `Hero ${unit.stats.displayName}`;
};
