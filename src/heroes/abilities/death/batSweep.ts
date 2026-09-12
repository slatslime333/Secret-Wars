import Phaser from 'phaser';
import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEATH_SWEEP } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { distanceBetween } from '../geometry';
import { sweepKnockback } from './sweep';
import { NinjaBody } from '../../NinjaBody';

export const deathBatSweepDef: AbilityDef = {
  id: 'death-bat-sweep',
  name: "Death's Bat Sweep",
  slot: 'ultimate',
  cooldownMs: 0,
  chargeMode: 'once',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.batSweep,
  accent: COLORS.yellow,
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new DeathBatSweepAbility(ctx),
};

class DeathBatSweepAbility implements ActiveAbility {
  readonly id = deathBatSweepDef.id;
  readonly control = { move: false, attack: true, dash: true, block: true, abilities: true };
  private readonly endsAt: number;
  private readonly lastHitAt = new Map<NinjaBody, number>();
  private readonly fx: SweepFx;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    this.endsAt = now + DEATH_SWEEP.durationMs;
    caster.status.applySlow(now, DEATH_SWEEP.durationMs, DEATH_SWEEP.moveMul);
    this.fx = new SweepFx(ctx.scene, caster);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'SWEEP', COLORS.yellow);
    caster.playCustomAttack(now, DEATH_SWEEP.durationMs, (frac) => ({
      swordAngleOffset: frac * Math.PI * 2 * (DEATH_SWEEP.durationMs / DEATH_SWEEP.spinMs),
      batScale: 1.45,
      armLiftRight: 0.45,
      swayX: Math.sin(frac * Math.PI * 8) * 3,
    }));
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    this.fx.redraw(now);
    if (now >= this.endsAt || caster.down) {
      caster.setSpeedCap(COMBAT.physicsMaxSpeed);
      this.fx.destroy();
      return false;
    }
    this.hit(ctx);
    return true;
  }

  destroy(): void {
    this.fx.destroy();
    this.lastHitAt.clear();
  }

  private hit(ctx: AbilityContext): void {
    const { caster, now, scene } = ctx;
    const spin = (now / DEATH_SWEEP.spinMs) * Math.PI * 2;
    const dir = sweepKnockback(Math.cos(spin), Math.sin(spin), 1);
    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      if (distanceBetween(caster.x, caster.y, enemy.x, enemy.y) > DEATH_SWEEP.radius + enemy.stats.bodyRadius) {
        continue;
      }
      const last = this.lastHitAt.get(enemy) ?? -9999;
      if (now - last < DEATH_SWEEP.hitCooldownMs) {
        continue;
      }
      const kind = resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: caster.stats.attackDamage * DEATH_SWEEP.damageMul,
          knockback: caster.stats.knockbackPower * DEATH_SWEEP.knockbackMul,
          staminaDamage: 7,
          dirX: dir.x,
          dirY: dir.y,
          step: 3,
          heavy: true,
        },
        ctx.rivalBlock,
      );
      if (kind === 'hit' || kind === 'blocked' || kind === 'perfect-block') {
        this.lastHitAt.set(enemy, now);
        if (kind === 'hit') {
          playWorld('death-sweep-hit', enemy);
        }
      }
    }
  }
}

class SweepFx {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly blade: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly caster: NinjaBody,
  ) {
    this.ring = scene.add.graphics().setDepth(8);
    this.blade = scene.add.graphics().setDepth(16);
  }

  redraw(now: number): void {
    const spin = (now / DEATH_SWEEP.spinMs) * Math.PI * 2;
    this.ring.clear();
    this.ring.lineStyle(3, COLORS.redBright, 0.28);
    this.ring.strokeCircle(this.caster.x, this.caster.y, DEATH_SWEEP.radius);
    this.ring.lineStyle(2, 0xc8a060, 0.2);
    this.ring.strokeCircle(this.caster.x, this.caster.y, DEATH_SWEEP.radius * 0.72);

    this.blade.clear();
    this.blade.setPosition(this.caster.x, this.caster.y);
    this.blade.lineStyle(12, 0x3a2410, 0.55);
    this.blade.beginPath();
    this.blade.arc(0, 0, DEATH_SWEEP.radius * 0.82, spin - 0.85, spin);
    this.blade.strokePath();
    this.blade.lineStyle(6, 0xc68654, 0.9);
    this.blade.beginPath();
    this.blade.arc(0, 0, DEATH_SWEEP.radius * 0.82, spin - 0.7, spin);
    this.blade.strokePath();
    this.blade.lineStyle(2, COLORS.paper, 0.8);
    this.blade.beginPath();
    this.blade.arc(0, 0, DEATH_SWEEP.radius * 0.78, spin - 0.45, spin);
    this.blade.strokePath();
  }

  destroy(): void {
    this.ring.destroy();
    this.blade.destroy();
  }
}
