import Phaser from 'phaser';
import { MINION, MinionKind, RANGER_MINION, SWORD_MINION, minionAdvanceX } from '../config/minion';
import { NinjaBody } from '../heroes/NinjaBody';
import { resolveAbilityHit } from '../heroes/abilities/resolveAbilityHit';
import { Projectile } from '../combat/projectile';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { distanceBetween } from '../heroes/abilities/geometry';

export type MinionState = 'advance' | 'approach' | 'attack' | 'recover';

export type MinionDebugInfo = {
  state: MinionState;
  targetLabel: string;
  distance: number;
  cooldownMs: number;
  team: string;
  hp: string;
};

/**
 * Advance the lane, pick a nearby enemy, fight, then keep pushing.
 * No infinite chase — scan + leash keep them on the battlefield axis.
 */
export class MinionBrain {
  state: MinionState = 'advance';
  target?: NinjaBody;
  private nextThinkAt = 0;
  private nextAttackAt = 0;
  private recoverUntil = 0;
  private acquireX = 0;
  private acquireY = 0;
  private attacking = false;

  constructor(
    readonly body: NinjaBody,
    readonly kind: MinionKind,
  ) {}

  debugInfo(now: number): MinionDebugInfo {
    const target = this.target && !this.target.down ? this.target : undefined;
    return {
      state: this.state,
      targetLabel: target ? labelOf(target) : 'none',
      distance: target ? distanceBetween(this.body.x, this.body.y, target.x, target.y) : 0,
      cooldownMs: Math.max(0, this.nextAttackAt - now),
      team: this.body.team,
      hp: `${Math.round(this.body.health)}/${this.body.stats.maxHealth}`,
    };
  }

  update(
    now: number,
    _delta: number,
    others: NinjaBody[],
    world: AbilityWorld,
    scene: Phaser.Scene,
  ): void {
    if (this.body.down) {
      this.body.stop();
      return;
    }
    if (now >= this.nextThinkAt) {
      this.think(now, others);
      this.nextThinkAt = now + MINION.retargetMs;
    }
    this.act(now, world, scene);
  }

  private think(now: number, others: NinjaBody[]): void {
    if (this.target && (this.target.down || this.shouldDrop(this.target))) {
      this.target = undefined;
    }
    const enemies = others.filter((unit) => unit.team !== this.body.team && !unit.down);
    const next = this.pickTarget(enemies);
    if (next && next !== this.target) {
      this.target = next;
      this.acquireX = this.body.x;
      this.acquireY = this.body.y;
    }

    const target = this.target;
    if (!target) {
      this.state = 'advance';
      return;
    }
    const dist = distanceBetween(this.body.x, this.body.y, target.x, target.y);
    const range = this.body.stats.attackRange + target.stats.bodyRadius;
    if (now < this.recoverUntil || this.attacking) {
      this.state = this.attacking ? 'attack' : 'recover';
      return;
    }
    if (dist <= range) {
      this.state = 'attack';
      return;
    }
    this.state = 'approach';
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

    if (this.state === 'attack' && target) {
      this.body.stop();
      this.tryAttack(now, target, world, scene);
      return;
    }
    if (this.state === 'recover') {
      this.body.stop();
      return;
    }

    const dir = this.moveDir(target);
    this.body.applyMove(dir);
  }

  private tryAttack(now: number, target: NinjaBody, world: AbilityWorld, scene: Phaser.Scene): void {
    if (this.attacking || now < this.nextAttackAt || this.body.status.cannotAttack(now)) {
      return;
    }
    this.attacking = true;
    if (this.kind === 'ranger') {
      this.fireArrow(now, target, world, scene);
    } else {
      this.swingSword(now, target, scene);
    }
  }

  private swingSword(now: number, target: NinjaBody, scene: Phaser.Scene): void {
    const spec = SWORD_MINION;
    this.body.playAttackAnimation(now, 1);
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
        },
      );
      this.body.status.markSwing(scene.time.now, 1);
      this.recoverUntil = scene.time.now + spec.recoveryMs;
      this.nextAttackAt = scene.time.now + spec.attackCooldownMs;
    });
  }

  private fireArrow(now: number, target: NinjaBody, world: AbilityWorld, scene: Phaser.Scene): void {
    const spec = RANGER_MINION;
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

  private pickTarget(enemies: NinjaBody[]): NinjaBody | undefined {
    const current = this.target && !this.target.down && !this.shouldDrop(this.target) ? this.target : undefined;
    let best: NinjaBody | undefined;
    let bestDist = MINION.scanRadius as number;
    for (const enemy of enemies) {
      const dist = distanceBetween(this.body.x, this.body.y, enemy.x, enemy.y);
      if (dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }
    if (!best) {
      return current;
    }
    if (!current) {
      return best;
    }
    const currentDist = distanceBetween(this.body.x, this.body.y, current.x, current.y);
    if (best !== current && currentDist - bestDist > MINION.switchScore) {
      return best;
    }
    return current;
  }

  private shouldDrop(target: NinjaBody): boolean {
    const fromAcquire = distanceBetween(this.acquireX, this.acquireY, target.x, target.y);
    const fromSelf = distanceBetween(this.body.x, this.body.y, target.x, target.y);
    return fromAcquire > MINION.leashRadius || fromSelf > MINION.leashRadius * 1.15;
  }

  private moveDir(target: NinjaBody | undefined): Phaser.Math.Vector2 {
    const march = minionAdvanceX(this.body.team);
    if (this.state === 'approach' && target) {
      const dx = target.x - this.body.x;
      const dy = target.y - this.body.y;
      const len = Math.hypot(dx, dy) || 1;
      return new Phaser.Math.Vector2(dx / len, dy / len);
    }
    const dy = (750 - this.body.y) * 0.004;
    const vec = new Phaser.Math.Vector2(march, Phaser.Math.Clamp(dy, -0.35, 0.35));
    return vec.normalize();
  }
}

const labelOf = (unit: NinjaBody): string => {
  if (unit.stats.role === 'minion') {
    return unit.stats.displayName;
  }
  return `Hero ${unit.stats.displayName}`;
};
