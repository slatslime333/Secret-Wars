import Phaser from 'phaser';
import { playWorld } from '../../../audio';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { ROPE_PUNCH } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { spawnShockwaveRing } from '../../../effects/lightning';
import { COLORS } from '../../../ui/theme';
import { distanceBetween } from '../geometry';
import { NinjaBody } from '../../NinjaBody';

export const megaPunchDef: AbilityDef = {
  id: 'rope-mega-punch',
  name: 'Mega Punch',
  slot: 'ability2',
  cooldownMs: ROPE_PUNCH.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.megaPunch,
  accent: COLORS.orange,
  aimOnRelease: true,
  padLabel: 'PUNCH',
  tactics: { roles: ['burst', 'cc', 'knockback', 'peel', 'defense'], range: ROPE_PUNCH.radius },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new MegaPunchAbility(ctx),
};

class MegaPunchAbility implements ActiveAbility {
  readonly id = megaPunchDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;
  private readonly impactAt: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private burst = false;
  private readonly hit = new Set<NinjaBody>();
  private readonly ring: Phaser.GameObjects.Graphics;

  constructor(ctx: AbilityContext) {
    const { caster, now, scene } = ctx;
    const aim = ctx.aimOverride ?? caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dirX = aim.x / len;
    this.dirY = aim.y / len;
    caster.setAim(this.dirX, this.dirY);
    caster.stop();
    this.until = now + ROPE_PUNCH.animMs;
    this.impactAt = now + ROPE_PUNCH.impactAt;
    caster.status.applyControlLock(now, ROPE_PUNCH.animMs);
    this.ring = scene.add.graphics().setDepth(12);
    spawnCombatCallout(scene, caster.x, caster.y, 'PUNCH', COLORS.orange);
    caster.playCustomAttack(
      now,
      ROPE_PUNCH.animMs,
      (frac) => {
        const rise = frac < 0.42 ? frac / 0.42 : Math.max(0, 1 - (frac - 0.42) / 0.58);
        const punch = frac < 0.38 ? 0 : Math.min(1, (frac - 0.38) / 0.22);
        return {
          armLiftRight: 0.3 + punch * 1.1,
          armLiftLeft: 0.15 + rise * 0.4,
          jumpY: -ROPE_PUNCH.jumpHeight * Math.sin(Math.min(1, frac * 1.05) * Math.PI),
          swayX: this.dirX * punch * 8,
          ropeAction: 'punch' as const,
        };
      },
      'Sine.Out',
    );
  }

  update(ctx: AbilityContext): boolean {
    ctx.caster.stop();
    this.drawTelegraph(ctx);
    if (ctx.now >= this.impactAt) {
      this.burstHit(ctx);
    }
    if (ctx.now >= this.until || ctx.caster.down) {
      return false;
    }
    return true;
  }

  destroy(): void {
    this.ring.destroy();
    this.hit.clear();
  }

  private burstHit(ctx: AbilityContext): void {
    if (this.burst) {
      return;
    }
    this.burst = true;
    spawnShockwaveRing(ctx.scene, ctx.caster.x, ctx.caster.y, ROPE_PUNCH.radius * 0.72);
    playWorld('rope-punch-impact', ctx.caster);
    for (const enemy of ctx.enemies) {
      if (enemy.down || this.hit.has(enemy)) {
        continue;
      }
      const dist = distanceBetween(ctx.caster.x, ctx.caster.y, enemy.x, enemy.y);
      if (dist > ROPE_PUNCH.radius + enemy.stats.bodyRadius) {
        continue;
      }
      const away = dist > 0.001 ? (enemy.x - ctx.caster.x) / dist : this.dirX;
      const awayY = dist > 0.001 ? (enemy.y - ctx.caster.y) / dist : this.dirY;
      const kind = resolveAbilityHit(
        ctx.scene,
        ctx.now,
        ctx.caster,
        enemy,
        {
          rawDamage: ROPE_PUNCH.damage,
          knockback: ROPE_PUNCH.knockback,
          staminaDamage: ROPE_PUNCH.staminaDamage,
          dirX: away,
          dirY: awayY,
          step: 3,
          heavy: true,
          launchCap: ROPE_PUNCH.launchCap,
        },
        ctx.rivalBlock,
      );
      if (kind === 'hit') {
        this.hit.add(enemy);
        enemy.status.applySlow(ctx.now, ROPE_PUNCH.slowMs, ROPE_PUNCH.slowMul);
        enemy.showRopeWrap(ctx.now + ROPE_PUNCH.slowMs);
      }
    }
  }

  private drawTelegraph(ctx: AbilityContext): void {
    const { caster, now } = ctx;
    this.ring.clear();
    const alpha = now >= this.impactAt ? 0.12 : 0.45;
    this.ring.fillStyle(COLORS.orange, alpha * 0.14);
    this.ring.fillCircle(caster.x, caster.y, ROPE_PUNCH.radius);
    this.ring.lineStyle(2, COLORS.orange, alpha);
    this.ring.strokeCircle(caster.x, caster.y, ROPE_PUNCH.radius);
  }
}
