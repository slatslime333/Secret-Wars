import Phaser from 'phaser';
import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { ROPE_SPRAY, ROPE_SHOT } from './tunables';
import { spawnRopeProjectile } from './ropeShot';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { playUltimateShake } from '../../../effects/hitJuice';
import { COLORS } from '../../../ui/theme';
import { ropeArmOrigin } from '../../drawRope';

export const ropeSprayDef: AbilityDef = {
  id: 'rope-spray',
  name: 'Rope Spray',
  slot: 'ultimate',
  cooldownMs: COMBAT.ultimateCooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.ropeSpray,
  accent: COLORS.yellow,
  tactics: { roles: ['aoe', 'cc', 'space', 'disruption', 'damage'], range: ROPE_SPRAY.range },
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new RopeSprayAbility(ctx),
};

class RopeSprayAbility implements ActiveAbility {
  readonly id = ropeSprayDef.id;
  readonly control = { move: false, attack: true, dash: true, block: true, abilities: true };
  private readonly endsAt: number;
  private nextShotAt: number;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly casterView: Phaser.GameObjects.Container;

  constructor(ctx: AbilityContext) {
    this.endsAt = ctx.now + ROPE_SPRAY.durationMs;
    this.nextShotAt = ctx.now + 40;
    this.casterView = ctx.caster.view;
    ctx.caster.status.applySlow(ctx.now, ROPE_SPRAY.durationMs, ROPE_SPRAY.moveMul);
    this.ring = ctx.scene.add.graphics().setDepth(8);
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'SPRAY', COLORS.yellow);
    playUltimateShake(ctx.scene);
    ctx.caster.playCustomAttack(ctx.now, ROPE_SPRAY.durationMs, (frac) => ({
      armLiftLeft: 0.45 + Math.sin(frac * Math.PI * 24) * 0.45,
      armLiftRight: 0.45 + Math.cos(frac * Math.PI * 24) * 0.45,
      jumpY: -6 - Math.abs(Math.sin(frac * Math.PI * 10)) * 8,
      swayX: Math.sin(frac * Math.PI * 18) * 3,
    }));
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down) {
      return false;
    }
    this.drawBound(caster.x, caster.y);
    caster.view.setRotation(((now % 380) / 380) * Math.PI * 2);
    if (now >= this.nextShotAt && now < this.endsAt) {
      this.nextShotAt = now + ROPE_SPRAY.intervalMs;
      this.firePulse(ctx);
    }
    if (now >= this.endsAt) {
      this.casterView.setRotation(0);
      return false;
    }
    return true;
  }

  destroy(): void {
    this.casterView.setRotation(0);
    this.ring.destroy();
  }

  private firePulse(ctx: AbilityContext): void {
    const { caster } = ctx;
    playWorld('rope-spray-whip', caster);
    for (let i = 0; i < ROPE_SPRAY.shotsPerPulse; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      const arm: -1 | 1 = i === 0 ? -1 : 1;
      const origin = ropeArmOrigin(caster.x, caster.y, ang, arm, 12);
      spawnRopeProjectile({
        scene: ctx.scene,
        world: ctx.world,
        caster,
        x: origin.x,
        y: origin.y,
        dirX: nx,
        dirY: ny,
        speed: ROPE_SPRAY.speed,
        radius: ROPE_SHOT.radius,
        lifetimeMs: 900,
        maxRange: ROPE_SPRAY.range,
        onHit: (hit, now) => {
          resolveAbilityHit(
            ctx.scene,
            now,
            caster,
            hit.target,
            {
              rawDamage: ROPE_SPRAY.damage,
              knockback: caster.stats.knockbackPower * ROPE_SPRAY.knockbackMul,
              staminaDamage: 3,
              dirX: nx,
              dirY: ny,
              step: 1,
              heavy: false,
            },
            ctx.rivalBlock,
          );
          if (!hit.target.down && !hit.target.status.isParalyzed(now)) {
            hit.target.status.applyParalyze(now, ROPE_SPRAY.paralyzeMs);
            hit.target.showRopeWrap(now + ROPE_SPRAY.paralyzeMs);
            playWorld('rope-wrap', hit.target);
          }
        },
      });
    }
  }

  private drawBound(x: number, y: number): void {
    this.ring.clear();
    this.ring.lineStyle(2, 0xc4894a, 0.28);
    this.ring.strokeCircle(x, y, ROPE_SPRAY.range);
    this.ring.lineStyle(1, 0x5a3014, 0.18);
    this.ring.strokeCircle(x, y, ROPE_SPRAY.range * 0.62);
  }
}
