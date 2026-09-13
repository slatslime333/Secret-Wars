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
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { NINJA_KICK } from '../ninja/tunables';
import { spawnRopeProjectile } from './ropeShot';
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
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new RopeGrabAbility(ctx),
};

const recoilSpeed = (distance: number): number => Math.sqrt(Math.max(0, distance) * COMBAT.bodyDrag * 2);

class RopeGrabAbility implements ActiveAbility {
  readonly id = ropeGrabDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  consumeDeferred = false;
  private phase: 'shot' | 'sling' | 'impact' | 'flip' | 'done' = 'shot';
  private target?: NinjaBody;
  private cancelled = false;
  private readonly dir = { x: 1, y: 0 };
  private slingUntil = 0;
  private impactUntil = 0;
  private flipUntil = 0;
  private readonly line: Phaser.GameObjects.Graphics;
  private shotGone = false;

  constructor(ctx: AbilityContext) {
    const { caster } = ctx;
    const aim = ctx.aimOverride ?? caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dir.x = aim.x / len;
    this.dir.y = aim.y / len;
    caster.setAim(this.dir.x, this.dir.y);
    const ang = Math.atan2(this.dir.y, this.dir.x);
    const origin = ropeArmOrigin(caster.x, caster.y, ang, 1, 16);
    this.line = ctx.scene.add.graphics().setDepth(16);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'GRAB', COLORS.orange);
    caster.playCustomAttack(ctx.now, 220, () => ({
      armLiftRight: 0.95,
      armLiftLeft: 0.2,
    }));
    spawnRopeProjectile({
      scene: ctx.scene,
      world: ctx.world,
      caster,
      x: origin.x,
      y: origin.y,
      dirX: this.dir.x,
      dirY: this.dir.y,
      speed: ROPE_GRAB.speed,
      radius: ROPE_GRAB.radius,
      lifetimeMs: ROPE_GRAB.lifetimeMs,
      maxRange: ROPE_GRAB.range,
      onHit: (hit) => {
        if (this.cancelled) {
          return;
        }
        this.consumeDeferred = true;
        this.target = hit.target;
        playWorld('rope-grab-catch', caster);
      },
      onMiss: () => {
        if (this.cancelled) {
          return;
        }
        this.shotGone = true;
      },
    });
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down) {
      return false;
    }
    if (this.phase === 'shot') {
      if (this.target && !this.target.down) {
        this.beginSling(ctx);
        return true;
      }
      if (this.target?.down || this.shotGone) {
        if (!this.consumeDeferred) {
          spawnCombatCallout(ctx.scene, caster.x, caster.y, 'MISS', COLORS.muted);
        }
        return false;
      }
      this.drawLine(caster, caster.x + this.dir.x * 40, caster.y + this.dir.y * 40);
      return true;
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
      const speed = Math.max(520, dist / (ROPE_GRAB.slingMs / 1000));
      caster.setSpeedCap(speed);
      caster.body?.setDrag(0, 0);
      caster.body?.setVelocity(this.dir.x * speed, this.dir.y * speed);
      this.drawLine(caster, tx, ty);
      const reach = caster.stats.bodyRadius + (dest?.stats.bodyRadius ?? 14) + 10;
      if (!dest || dist <= reach || now >= this.slingUntil) {
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
    this.cancelled = true;
    this.line.destroy();
    this.target = undefined;
  }

  private beginSling(ctx: AbilityContext): void {
    this.phase = 'sling';
    this.slingUntil = ctx.now + ROPE_GRAB.slingMs;
    ctx.caster.status.applyControlLock(ctx.now, ROPE_GRAB.slingMs + NINJA_KICK.hitStopMs + NINJA_KICK.backflipMs);
    ctx.caster.playCustomAttack(ctx.now, ROPE_GRAB.slingMs, (frac) => ({
      armLiftLeft: 0.9,
      armLiftRight: 0.9,
      jumpY: -10 - Math.sin(frac * Math.PI) * 8,
    }));
    playWorld('rope-grab-zip', ctx.caster);
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
        rawDamage: NINJA_KICK.damage,
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
    enemy.status.applySlow(ctx.now, NINJA_KICK.hitSlowMs, NINJA_KICK.hitSlowMul);
    this.beginFlip(ctx, NINJA_KICK.backflipDistance, NINJA_KICK.backflipMs, NINJA_KICK.jumpHeight);
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
    strokeRope(this.line, hand.x, hand.y, tx, ty, 3.4);
  }
}
