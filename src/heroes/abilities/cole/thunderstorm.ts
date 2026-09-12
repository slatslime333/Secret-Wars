import Phaser from 'phaser';
import { COMBAT } from '../../../config/combat';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { COLE_STORM } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnLightningBolt, spawnStormWarning } from '../../../effects/lightning';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { distanceBetween } from '../geometry';

export const thunderstormDef: AbilityDef = {
  id: 'cole-thunderstorm',
  name: 'Thunderstorm',
  slot: 'ultimate',
  cooldownMs: 0,
  chargeMode: 'once',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.thunderstorm,
  accent: COLORS.yellow,
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new ThunderstormAbility(ctx),
};

type PendingStrike = { x: number; y: number; at: number };

class ThunderstormAbility implements ActiveAbility {
  readonly id = thunderstormDef.id;
  readonly control = { move: false, attack: true, dash: true, block: true, abilities: true };
  private readonly endsAt: number;
  private nextWarnAt: number;
  private readonly pending: PendingStrike[] = [];
  private readonly ring: ReturnType<Phaser.Scene['add']['graphics']>;

  constructor(ctx: AbilityContext) {
    this.endsAt = ctx.now + COLE_STORM.durationMs;
    this.nextWarnAt = ctx.now + 80;
    ctx.caster.status.applySlow(ctx.now, COLE_STORM.durationMs, COLE_STORM.moveMul);
    this.ring = ctx.scene.add.graphics().setDepth(8);
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'STORM', COLORS.yellow);
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    this.drawBound(caster.x, caster.y);
    if (now >= this.nextWarnAt && now < this.endsAt - COLE_STORM.warningMs) {
      this.nextWarnAt = now + COLE_STORM.strikeIntervalMs;
      for (let i = 0; i < COLE_STORM.arcsPerPulse; i += 1) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * COLE_STORM.radius * 0.88;
        const x = caster.x + Math.cos(ang) * dist;
        const y = caster.y + Math.sin(ang) * dist;
        spawnStormWarning(ctx.scene, x, y, COLE_STORM.strikeRadius, COLE_STORM.warningMs);
        this.pending.push({ x, y, at: now + COLE_STORM.warningMs });
      }
    }

    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      if (now < this.pending[i].at) {
        continue;
      }
      const strike = this.pending.splice(i, 1)[0];
      spawnLightningBolt(ctx.scene, caster.x, caster.y - 10, strike.x, strike.y, { heavy: true, life: 160 });
      for (const enemy of ctx.enemies) {
        if (enemy.down) {
          continue;
        }
        if (distanceBetween(strike.x, strike.y, enemy.x, enemy.y) > COLE_STORM.strikeRadius + enemy.stats.bodyRadius) {
          continue;
        }
        const kind = resolveAbilityHit(
          ctx.scene,
          now,
          caster,
          enemy,
          {
            rawDamage: caster.stats.attackDamage * COLE_STORM.damageMul,
            knockback: caster.stats.knockbackPower * 1.4,
            staminaDamage: 6,
            dirX: enemy.x - caster.x,
            dirY: enemy.y - caster.y,
            step: 2,
            heavy: true,
          },
          ctx.rivalBlock,
        );
        if (kind === 'hit') {
          enemy.status.applySlow(now, COLE_STORM.slowMs, COLE_STORM.slowMul);
        }
      }
    }

    if (now >= this.endsAt && this.pending.length === 0) {
      caster.setSpeedCap(COMBAT.physicsMaxSpeed);
      this.ring.destroy();
      return false;
    }
    return true;
  }

  destroy(): void {
    this.ring.destroy();
  }

  private drawBound(x: number, y: number): void {
    this.ring.clear();
    this.ring.lineStyle(2, 0x7ecbff, 0.45);
    this.ring.strokeCircle(x, y, COLE_STORM.radius);
    this.ring.fillStyle(0x4aa8ff, 0.05);
    this.ring.fillCircle(x, y, COLE_STORM.radius);
  }
}
