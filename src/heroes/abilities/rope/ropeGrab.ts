import Phaser from 'phaser';
import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { applyImpactHitStop } from '../../../combat/hitStop';
import { spawnWindImpact } from '../../../effects/windImpact';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { NINJA } from '../../../config/ninja';
import { NinjaBody } from '../../NinjaBody';
import { ropeArmOrigin } from '../../drawRope';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { segmentHitsCircle } from '../geometry';
import { NINJA_KICK } from '../ninja/tunables';
import { strokeRope } from './ropeVisual';
import { ROPE_GRAB } from './tunables';

export const ropeGrabDef: AbilityDef = {
  id: 'rope-grab',
  name: 'Rope Grab',
  slot: 'ability1',
  cooldownMs: ROPE_GRAB.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.ropeGrab,
  accent: COLORS.orange,
  aimOnRelease: true,
  padLabel: 'GRAB',
  deferCooldown: true,
  tactics: {
    roles: ['mobility', 'initiate', 'damage', 'disruption', 'finish'],
    range: ROPE_GRAB.range,
  },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new RopeGrabAbility(ctx),
};

const recoilSpeed = (distance: number): number => Math.sqrt(Math.max(0, distance) * COMBAT.bodyDrag * 2);

class RopeGrabAbility implements ActiveAbility {
  readonly id = ropeGrabDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  consumeDeferred = false;
  private phase: 'shot' | 'sling' | 'impact' | 'flip' | 'done' = 'shot';
  private target?: NinjaBody;
  private readonly dir = { x: 1, y: 0 };
  private slingUntil = 0;
  private slingSpeed = 0;
  private impactUntil = 0;
  private flipUntil = 0;
  private readonly line: Phaser.GameObjects.Graphics;
  private length = 0;
  private readonly origin = { x: 0, y: 0 };

  constructor(ctx: AbilityContext) {
    const { caster } = ctx;
    const aim = ctx.aimOverride ?? caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dir.x = aim.x / len;
    this.dir.y = aim.y / len;
    caster.setAim(this.dir.x, this.dir.y);
    this.syncOrigin(caster);
    this.line = ctx.scene.add.graphics().setDepth(16);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'GRAB', COLORS.orange);
    caster.playCustomAttack(ctx.now, 220, () => ({
      armLiftRight: 0.95,
      armLiftLeft: 0.2,
    }));
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down) {
      return false;
    }
    if (this.phase === 'shot') {
      if (this.advanceRope(ctx)) {
        return true;
      }
      spawnCombatCallout(ctx.scene, caster.x, caster.y, 'MISS', COLORS.muted);
      return false;
    }
    if (this.phase === 'sling') {
      const dest = this.target && !this.target.down ? this.target : undefined;
      const tx = dest?.x ?? caster.x + this.dir.x * 40;
      const ty = dest?.y ?? caster.y + this.dir.y * 40;
      const dx = tx - caster.x;
      const dy = ty - caster.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.dir.x = dx / dist;
      this.dir.y = dy / dist;
      const remainingMs = Math.max(16, this.slingUntil - now);
      const speed = Math.max(this.slingSpeed, dist / (remainingMs / 1000));
      caster.setSpeedCap(speed);
      caster.body?.setDrag(0, 0);
      caster.body?.setVelocity(this.dir.x * speed, this.dir.y * speed);
      this.drawLine(caster, tx, ty);
      const reach = caster.stats.bodyRadius + (dest?.stats.bodyRadius ?? 14) + 12;
      if (!dest || dist <= reach || now >= this.slingUntil) {
        if (dest && dist > reach) {
          caster.placeAt(dest.x - this.dir.x * reach, dest.y - this.dir.y * reach);
        }
        caster.body?.setVelocity(0, 0);
        this.beginKick(ctx);
      }
      return true;
    }
    if (this.phase === 'impact') {
      caster.body?.setVelocity(0, 0);
      this.line.clear();
      if (now >= this.impactUntil) {
        this.launchKick(ctx);
      }
      return true;
    }
    if (this.phase === 'flip') {
      if (now >= this.flipUntil) {
        caster.setSpeedCap(COMBAT.physicsMaxSpeed);
        return false;
      }
      return true;
    }
    return false;
  }

  destroy(): void {
    this.line.destroy();
    this.target = undefined;
  }

  private beginSling(ctx: AbilityContext): void {
    this.phase = 'sling';
    const { caster } = ctx;
    const dest = this.target;
    const dist = dest ? Math.hypot(dest.x - caster.x, dest.y - caster.y) : 80;
    const travelMs = Math.round(Phaser.Math.Clamp(dist / 1.45, 200, 520));
    this.slingUntil = ctx.now + travelMs;
    this.slingSpeed = Math.max(640, dist / (travelMs / 1000));
    caster.status.applyControlLock(ctx.now, travelMs + NINJA_KICK.hitStopMs + NINJA_KICK.backflipMs);
    caster.playCustomAttack(ctx.now, travelMs, (frac) => ({
      armLiftLeft: 0.9,
      armLiftRight: 0.9,
      jumpY: -12 - Math.sin(frac * Math.PI) * 14,
    }));
    playWorld('rope-grab-zip', caster);
  }

  private beginKick(ctx: AbilityContext): void {
    const enemy = this.target && !this.target.down ? this.target : undefined;
    if (!enemy) {
      spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'WHIFF', COLORS.muted);
      this.beginFlip(ctx, NINJA_KICK.missRecoverDistance, NINJA_KICK.missRecoverMs, 22);
      return;
    }
    this.phase = 'impact';
    this.impactUntil = ctx.now + NINJA_KICK.hitStopMs;
    applyImpactHitStop(ctx.now, [ctx.caster, enemy], NINJA_KICK.hitStopMs);
    ctx.caster.playKickPose(NINJA_KICK.hitStopMs);
    enemy.status.applyParalyze(ctx.now, NINJA_KICK.hitStopMs + 40);
  }

  private launchKick(ctx: AbilityContext): void {
    const enemy = this.target && !this.target.down ? this.target : undefined;
    if (!enemy) {
      this.beginFlip(ctx, NINJA_KICK.missRecoverDistance, NINJA_KICK.missRecoverMs, 22);
      return;
    }
    const contactX = (ctx.caster.x + enemy.x) / 2;
    const contactY = (ctx.caster.y + enemy.y) / 2;
    spawnWindImpact(ctx.scene, contactX, contactY, this.dir.x, this.dir.y);
    playWorld('rope-grab-impact', ctx.caster);
    resolveAbilityHit(
      ctx.scene,
      ctx.now,
      ctx.caster,
      enemy,
      {
        rawDamage: ROPE_GRAB.damage,
        knockback: NINJA.knockbackPower * NINJA_KICK.knockbackMul,
        staminaDamage: NINJA_KICK.staminaDamage,
        dirX: this.dir.x,
        dirY: this.dir.y,
        step: 2,
        heavy: true,
        skipSpark: true,
        hitStopMs: 0,
        launchCap: NINJA_KICK.launchCap,
      },
      ctx.rivalBlock,
    );
    enemy.status.applySlow(ctx.now, ROPE_GRAB.hitSlowMs, ROPE_GRAB.hitSlowMul);
    enemy.showRopeWrap(ctx.now + ROPE_GRAB.hitSlowMs);
    this.beginFlip(ctx, NINJA_KICK.backflipDistance, NINJA_KICK.backflipMs, NINJA_KICK.jumpHeight);
  }

  private advanceRope(ctx: AbilityContext): boolean {
    const { caster } = ctx;
    this.syncOrigin(caster);
    this.length = Math.min(ROPE_GRAB.range, this.length + ROPE_GRAB.speed * (ctx.delta / 1000));
    const tipX = this.origin.x + this.dir.x * this.length;
    const tipY = this.origin.y + this.dir.y * this.length;
    this.drawLine(caster, tipX, tipY);
    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      const radius = ROPE_GRAB.radius + enemy.stats.bodyRadius + ROPE_GRAB.forgive;
      if (!segmentHitsCircle(this.origin.x, this.origin.y, tipX, tipY, enemy.x, enemy.y, radius)) {
        continue;
      }
      this.consumeDeferred = true;
      this.target = enemy;
      playWorld('rope-grab-catch', caster);
      enemy.showRopeWrap(ctx.now + ROPE_GRAB.hitSlowMs + NINJA_KICK.hitStopMs + 520);
      this.beginSling(ctx);
      return true;
    }
    return this.length < ROPE_GRAB.range;
  }

  private syncOrigin(caster: NinjaBody): void {
    const ang = Math.atan2(this.dir.y, this.dir.x);
    const hand = ropeArmOrigin(caster.x, caster.y, ang, 1, 16);
    this.origin.x = hand.x;
    this.origin.y = hand.y;
  }

  private beginFlip(ctx: AbilityContext, distance: number, durationMs: number, jumpHeight: number): void {
    this.phase = 'flip';
    this.flipUntil = ctx.now + durationMs;
    ctx.caster.status.applyControlLock(ctx.now, durationMs);
    ctx.caster.applyRecoil(-this.dir.x, -this.dir.y, recoilSpeed(distance));
    ctx.caster.playBackflip(-this.dir.x, -this.dir.y, durationMs, jumpHeight);
  }

  private drawLine(caster: NinjaBody, tx: number, ty: number): void {
    const ang = Math.atan2(this.dir.y, this.dir.x);
    const hand = ropeArmOrigin(caster.x, caster.y, ang, 1, 14);
    this.line.clear();
    strokeRope(this.line, hand.x, hand.y, tx, ty, ROPE_GRAB.width);
  }
}
