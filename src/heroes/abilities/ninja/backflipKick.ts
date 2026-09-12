import { NINJA } from '../../../config/ninja';
import { COMBAT } from '../../../config/combat';
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

class BackflipKickAbility implements ActiveAbility {
  readonly id = backflipKickDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private phase: 'dash' | 'flip' | 'done' = 'dash';
  private readonly dashUntil: number;
  private flipUntil = 0;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly hit = new Set<NinjaBody>();
  private lastX: number;
  private lastY: number;

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
    caster.status.applyControlLock(now, NINJA_KICK.dashDurationMs + NINJA_KICK.backflipMs);
    caster.playKickPose(NINJA_KICK.dashDurationMs);
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
      if (now >= this.dashUntil || this.hit.size > 0) {
        this.beginResolve(ctx);
      }
      return true;
    }
    if (this.phase === 'flip') {
      const speed = NINJA_KICK.backflipDistance / (NINJA_KICK.backflipMs / 1000);
      caster.body?.setDrag(0, 0);
      caster.body?.setVelocity(-this.dirX * speed, -this.dirY * speed);
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
      this.strike(ctx, enemy, this.hit.size === 0);
      this.hit.add(enemy);
      if (this.hit.size >= NINJA_KICK.maxTargets) {
        return;
      }
    }
  }

  private beginResolve(ctx: AbilityContext): void {
    this.sweepHits(ctx);
    this.phase = 'flip';
    this.flipUntil = ctx.now + NINJA_KICK.backflipMs;
    ctx.caster.playBackflip(-this.dirX, -this.dirY, NINJA_KICK.backflipMs);
    if (this.hit.size === 0) {
      spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'WHIFF', COLORS.muted);
    }
  }

  private strike(ctx: AbilityContext, enemy: NinjaBody, primary: boolean): void {
    const knockback = NINJA.knockbackPower * (primary ? NINJA_KICK.knockbackMul : NINJA_KICK.secondaryKnockbackMul);
    resolveAbilityHit(
      ctx.scene,
      ctx.now,
      ctx.caster,
      enemy,
      {
        rawDamage: NINJA.attackDamage * NINJA_KICK.damageMul,
        knockback,
        staminaDamage: NINJA_KICK.staminaDamage,
        dirX: this.dirX,
        dirY: this.dirY,
        step: 2,
        heavy: primary,
      },
        ctx.rivalBlock,
    );
  }
}
