import Phaser from 'phaser';
import { playWorld } from '../audio';
import { atFarEdge } from '../config/arena';
import { MINION, MinionKind, RANGER_MINION, SWORD_MINION, minionAdvanceX } from '../config/minion';
import { WITCH_TOMBSTONE } from '../heroes/abilities/witch/tunables';
import { NinjaBody } from '../heroes/NinjaBody';
import { resolveAbilityHit } from '../heroes/abilities/resolveAbilityHit';
import { Projectile } from '../combat/projectile';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { distanceBetween } from '../heroes/abilities/geometry';
import { battlefieldOf } from '../map';
import { TacticalField } from '../ai/tactical/field';
import { TacticalMind } from '../ai/tactical/mind';
import { moveGoal } from '../ai/tactical/move';
import { guardHome, minionLaneSpread, type CrowdMate } from '../ai/tactical/spacing';
import type { TacticalAction, UnitFact } from '../ai/tactical/types';

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

export type MinionBrainOptions = {
  guard?: NinjaBody;
  windupMs?: number;
  recoveryMs?: number;
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
  private readonly guard?: NinjaBody;
  private readonly windupMs: number;
  private readonly recoveryMs: number;
  private readonly nearby: UnitFact[] = [];

  constructor(
    readonly body: NinjaBody,
    readonly kind: MinionKind,
    options: MinionBrainOptions = {},
  ) {
    this.guard = options.guard;
    this.windupMs = options.windupMs ?? (kind === 'ranger' ? RANGER_MINION.windupMs : SWORD_MINION.windupMs);
    this.recoveryMs = options.recoveryMs ?? (kind === 'ranger' ? RANGER_MINION.recoveryMs : SWORD_MINION.recoveryMs);
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
    if (this.guard) {
      this.actGuard(now, field, world, scene);
      return;
    }
    this.syncTarget();
    this.act(now, world, scene);
  }

  private actGuard(now: number, field: TacticalField, world: AbilityWorld, scene: Phaser.Scene): void {
    const owner = this.guard;
    if (!owner || owner.down || !owner.isPresent) {
      this.body.health = 0;
      return;
    }
    if (this.body.status.shouldLockMovement(now)) {
      return;
    }
    const protect = WITCH_TOMBSTONE.protectRadius;
    const leash = WITCH_TOMBSTONE.leashRadius;
    const foes: NinjaBody[] = [];
    field.fillEnemies(this.body, foes);
    let nearest: NinjaBody | undefined;
    let nearestDist = Number(protect);
    for (const foe of foes) {
      if (foe.down) {
        continue;
      }
      const fromOwner = distanceBetween(owner.x, owner.y, foe.x, foe.y);
      if (fromOwner > protect) {
        continue;
      }
      const fromSelf = distanceBetween(this.body.x, this.body.y, foe.x, foe.y);
      if (fromSelf < nearestDist) {
        nearest = foe;
        nearestDist = fromSelf;
      }
    }
    this.target = nearest;
    if (nearest) {
      this.body.setAim(nearest.x - this.body.x, nearest.y - this.body.y);
    } else {
      this.body.setAim(owner.x - this.body.x, owner.y - this.body.y);
    }
    const home = guardHome(owner, this.mind.situationView().self.id || Math.round(this.body.y));
    const fromOwner = distanceBetween(this.body.x, this.body.y, owner.x, owner.y);
    if (now < this.recoverUntil) {
      this.body.stop();
      this.state = 'recover';
      return;
    }
    if (nearest) {
      const range = this.body.stats.attackRange + nearest.stats.bodyRadius;
      const inRange = distanceBetween(this.body.x, this.body.y, nearest.x, nearest.y) <= range;
      if (inRange) {
        this.body.stop();
        this.tryAttack(now, nearest, world, scene);
        return;
      }
    }
    if (this.attacking) {
      this.body.stop();
      return;
    }
    const goalX = nearest && fromOwner < leash ? nearest.x : home.x;
    const goalY = nearest && fromOwner < leash ? nearest.y : home.y;
    let dx = goalX - this.body.x;
    let dy = goalY - this.body.y;
    const spread = minionLaneSpread(
      {
        x: this.body.x,
        y: this.body.y,
        team: this.body.team,
        attackRange: this.body.stats.attackRange,
        role: this.body.stats.role,
        kind: 'minion',
        id: this.mind.situationView().self.id,
      },
      this.crowdMates(field),
      dx,
      dy,
    );
    dx = spread.x;
    dy = spread.y;
    const len = Math.hypot(dx, dy) || 1;
    const steered = battlefieldOf(scene)?.query.steer(this.body.x, this.body.y, dx / len, dy / len);
    if (steered) {
      this.steer.set(steered.x, steered.y);
    } else {
      this.steer.set(dx / len, dy / len);
    }
    this.body.applyMove(this.steer);
    this.state = nearest ? 'attack' : 'push_lane';
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
        id: this.mind.situationView().self.id,
      },
      now,
      this.mind.homeX,
      this.mind.homeY,
      target ? { x: target.x, y: target.y, aimX: target.aim.x, aimY: target.aim.y } : undefined,
      ally ? { x: ally.x, y: ally.y, aimX: ally.aim.x, aimY: ally.aim.y } : undefined,
      this.mind.intent.flankSign,
      this.mind.situationView().self.id,
      this.mind.goal,
      this.mind.moveHint(),
    );
    if (goal.halt) {
      this.body.stop();
      return;
    }
    let dx = goal.x - this.body.x;
    let dy = goal.y - this.body.y;
    const pushing =
      this.mind.action === 'push_lane' ||
      this.mind.action === 'advance' ||
      this.mind.action === 'search_for_target';
    if (pushing && !atFarEdge(this.body.team, this.body.x)) {
      dx = minionAdvanceX(this.body.team);
      dy = Phaser.Math.Clamp((this.mind.homeY - this.body.y) * 0.004, -0.35, 0.35);
    }
    const spread = minionLaneSpread(
      {
        x: this.body.x,
        y: this.body.y,
        team: this.body.team,
        attackRange: this.body.stats.attackRange,
        role: this.body.stats.role,
        kind: 'minion',
        id: this.mind.situationView().self.id,
      },
      this.mind.moveHint()?.mates,
      dx,
      dy,
    );
    dx = spread.x;
    dy = spread.y;
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
    const spec = this.body.stats;
    this.body.playAttackAnimation(now, 1);
    playWorld('minion-attack', this.body);
    scene.time.delayedCall(this.windupMs, () => {
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
          knockback: vsMinion && 'vsMinionKnockback' in spec ? SWORD_MINION.vsMinionKnockback : spec.knockbackPower,
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
      this.recoverUntil = scene.time.now + this.recoveryMs;
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
      shot.team = this.body.team;
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

  private crowdMates(field: TacticalField): CrowdMate[] {
    const n = field.queryNearby(this.body.x, this.body.y, 96, this.nearby);
    const mates: CrowdMate[] = [];
    const selfId = this.mind.situationView().self.id;
    for (let i = 0; i < n; i += 1) {
      const fact = this.nearby[i];
      if (!fact || fact.team !== this.body.team || fact.id === selfId) {
        continue;
      }
      mates.push({
        x: fact.x,
        y: fact.y,
        id: fact.id,
        kind: fact.kind,
        role: String(fact.role),
        attackRange: fact.attackRange,
      });
    }
    return mates;
  }
}

const labelOf = (unit: NinjaBody): string => {
  if (unit.stats.role === 'minion') {
    return unit.stats.displayName;
  }
  return `Hero ${unit.stats.displayName}`;
};
