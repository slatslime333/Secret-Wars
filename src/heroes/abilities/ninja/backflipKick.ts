import { NINJA } from '../../../config/ninja';
import { COMBAT } from '../../../config/combat';
import { applyImpactHitStop } from '../../../combat/hitStop';
import { spawnWindImpact } from '../../../effects/windImpact';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { NinjaBody } from '../../NinjaBody';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { segmentHitsCircle } from '../geometry';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { ABILITY_ICON } from '../icons';
import { NINJA_KICK } from './tunables';

export const backflipKickDef: AbilityDef = {
  id: 'ninja-backflip-kick',
  name: 'Backflip Kick',
  slot: 'ability2',
  cooldownMs: NINJA_KICK.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.backflipKick,
  accent: COLORS.orange,
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new BackflipKickAbility(ctx),
};

const recoilSpeed = (distance: number): number => Math.sqrt(Math.max(0, distance) * COMBAT.bodyDrag * 2);

class BackflipKickAbility implements ActiveAbility {
  readonly id = backflipKickDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private phase: 'dash' | 'impact' | 'flip' | 'done' = 'dash';
  private readonly dashUntil: number;
  private impactUntil = 0;
  private flipUntil = 0;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly hit = new Set<NinjaBody>();
  private readonly pending: NinjaBody[] = [];
  private lastX: number;
  private lastY: number;
  private contactX = 0;
  private contactY = 0;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    const len = Math.hypot(caster.aim.x, caster.aim.y) || 1;
    this.dirX = caster.aim.x / len;
    this.dirY = caster.aim.y / len;
    this.dashUntil = now + NINJA_KICK.dashDurationMs;
    this.lastX = caster.x;
    this.lastY = caster.y;
    const speed = NINJA_KICK.dashDistance / (NINJA_KICK.dashDurationMs / 1000);
    caster.setSpeedCap(speed);
    caster.status.applyControlLock(
      now,
      NINJA_KICK.dashDurationMs + NINJA_KICK.hitStopMs + NINJA_KICK.backflipMs,
    );
    caster.playKickPose(NINJA_KICK.dashDurationMs + NINJA_KICK.hitStopMs);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'KICK', COLORS.orange);
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (this.phase === 'dash') {
      const speed = NINJA_KICK.dashDistance / (NINJA_KICK.dashDurationMs / 1000);
      caster.body?.setDrag(0, 0);
      caster.body?.setVelocity(this.dirX * speed, this.dirY * speed);
      this.sweepHits(ctx);
      this.lastX = caster.x;
      this.lastY = caster.y;
      if (now >= this.dashUntil || this.pending.length > 0) {
        this.beginResolve(ctx);
      }
      return true;
    }
    if (this.phase === 'impact') {
      caster.body?.setVelocity(0, 0);
      if (now >= this.impactUntil) {
        this.launchImpact(ctx);
      }
      return true;
    }
    if (this.phase === 'flip') {
      if (now >= this.flipUntil) {
        this.phase = 'done';
        caster.setSpeedCap(COMBAT.physicsMaxSpeed);
        return false;
      }
      return true;
    }
    return false;
  }

  destroy(): void {
    this.hit.clear();
    this.pending.length = 0;
  }

  private sweepHits(ctx: AbilityContext): void {
    if (this.hit.size >= NINJA_KICK.maxTargets) {
      return;
    }
    for (const enemy of ctx.enemies) {
      if (enemy.down || this.hit.has(enemy)) {
        continue;
      }
      const radius = NINJA.bodyRadius + NINJA.bodyRadius + NINJA_KICK.pathPadding;
      if (!segmentHitsCircle(this.lastX, this.lastY, ctx.caster.x, ctx.caster.y, enemy.x, enemy.y, radius)) {
        continue;
      }
      this.noteContact(ctx, enemy);
      if (this.hit.size >= NINJA_KICK.maxTargets) {
        return;
      }
    }
  }

  private noteContact(ctx: AbilityContext, enemy: NinjaBody): void {
    this.hit.add(enemy);
    const blocked = ctx.rivalBlock?.tryAbsorb(ctx.now, enemy, ctx.caster.x, ctx.caster.y);
    if (blocked?.absorbed) {
      resolveAbilityHit(
        ctx.scene,
        ctx.now,
        ctx.caster,
        enemy,
        {
          rawDamage: NINJA.attackDamage * NINJA_KICK.damageMul,
          knockback: 0,
          staminaDamage: NINJA_KICK.staminaDamage,
          dirX: this.dirX,
          dirY: this.dirY,
          step: 2,
          heavy: this.pending.length === 0,
        },
        ctx.rivalBlock,
      );
      return;
    }
    if (this.pending.length === 0) {
      this.contactX = (ctx.caster.x + enemy.x) / 2;
      this.contactY = (ctx.caster.y + enemy.y) / 2;
    }
    this.pending.push(enemy);
  }

  private beginResolve(ctx: AbilityContext): void {
    this.sweepHits(ctx);
    if (this.pending.length === 0) {
      this.beginMiss(ctx);
      return;
    }
    this.phase = 'impact';
    this.impactUntil = ctx.now + NINJA_KICK.hitStopMs;
    applyImpactHitStop(ctx.now, [ctx.caster, ...this.pending], NINJA_KICK.hitStopMs);
    ctx.caster.playKickPose(NINJA_KICK.hitStopMs);
  }

  private launchImpact(ctx: AbilityContext): void {
    spawnWindImpact(ctx.scene, this.contactX, this.contactY, this.dirX, this.dirY);
    this.pending.forEach((enemy, index) => {
      const primary = index === 0;
      resolveAbilityHit(
        ctx.scene,
        ctx.now,
        ctx.caster,
        enemy,
        {
          rawDamage: NINJA.attackDamage * NINJA_KICK.damageMul,
          knockback: NINJA.knockbackPower * (primary ? NINJA_KICK.knockbackMul : NINJA_KICK.secondaryKnockbackMul),
          staminaDamage: NINJA_KICK.staminaDamage,
          dirX: this.dirX,
          dirY: this.dirY,
          step: 2,
          heavy: primary,
          skipSpark: primary,
          hitStopMs: 0,
        },
        ctx.rivalBlock,
      );
    });
    this.beginFlip(ctx, NINJA_KICK.backflipDistance, NINJA_KICK.backflipMs, NINJA_KICK.jumpHeight);
  }

  private beginMiss(ctx: AbilityContext): void {
    if (this.hit.size === 0) {
      spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'WHIFF', COLORS.muted);
    }
    this.beginFlip(ctx, NINJA_KICK.missRecoverDistance, NINJA_KICK.missRecoverMs, 22);
  }

  private beginFlip(ctx: AbilityContext, distance: number, durationMs: number, jumpHeight: number): void {
    this.phase = 'flip';
    this.flipUntil = ctx.now + durationMs;
    ctx.caster.status.applyControlLock(ctx.now, durationMs);
    ctx.caster.applyRecoil(-this.dirX, -this.dirY, recoilSpeed(distance));
    ctx.caster.playBackflip(-this.dirX, -this.dirY, durationMs, jumpHeight);
  }
}
