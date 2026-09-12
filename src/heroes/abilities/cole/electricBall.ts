import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { COLE_BALL } from './tunables';
import { Projectile } from '../../../combat/projectile';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnLightningBolt } from '../../../effects/lightning';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { NinjaBody } from '../../NinjaBody';
import { distanceBetween } from '../geometry';

export const electricBallDef: AbilityDef = {
  id: 'cole-electric-ball',
  name: 'Electric Ball',
  slot: 'ability1',
  cooldownMs: COLE_BALL.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.electricBall,
  accent: 0x4aa8ff,
  aimOnRelease: true,
  canActivate: (ctx) => !ctx.caster.status.isBlockStunned(ctx.now) && !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new ElectricBallAbility(ctx),
};

class ElectricBallAbility implements ActiveAbility {
  readonly id = electricBallDef.id;
  readonly control = { move: false, attack: false, dash: false, block: false, abilities: true };
  private readonly shot: Projectile;
  private done = false;

  constructor(ctx: AbilityContext) {
    const aim = ctx.aimOverride ?? ctx.caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    const nx = aim.x / len;
    const ny = aim.y / len;
    this.shot = new Projectile(
      ctx.scene,
      ctx.caster.x + nx * 18,
      ctx.caster.y + ny * 18,
      nx * COLE_BALL.speed,
      ny * COLE_BALL.speed,
      COLE_BALL.radius,
      COLE_BALL.lifetimeMs,
      0x4aa8ff,
    );
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'BALL', 0x7ecbff);
  }

  update(ctx: AbilityContext): boolean {
    if (this.done) {
      return false;
    }
    const result = this.shot.update(ctx.now, ctx.delta / 1000, ctx.enemies);
    if (result === 'dead') {
      this.done = true;
      return false;
    }
    if (result) {
      this.resolveHit(ctx, result.target, result.x, result.y);
      this.done = true;
      return false;
    }
    return true;
  }

  destroy(): void {
    this.shot.destroy();
  }

  private resolveHit(ctx: AbilityContext, primary: NinjaBody, x: number, y: number): void {
    const kind = resolveAbilityHit(
      ctx.scene,
      ctx.now,
      ctx.caster,
      primary,
      {
        rawDamage: ctx.caster.stats.attackDamage * COLE_BALL.damageMul,
        knockback: ctx.caster.stats.knockbackPower * COLE_BALL.knockbackMul,
        staminaDamage: 8,
        dirX: primary.x - ctx.caster.x,
        dirY: primary.y - ctx.caster.y,
        step: 2,
        heavy: true,
      },
      ctx.rivalBlock,
    );
    if (kind !== 'hit') {
      return;
    }

    const chained: NinjaBody[] = [primary];
    const pool = ctx.enemies
      .filter((enemy) => enemy !== primary && !enemy.down)
      .sort((a, b) => distanceBetween(x, y, a.x, a.y) - distanceBetween(x, y, b.x, b.y));

    for (const enemy of pool) {
      if (chained.length >= COLE_BALL.maxTargets) {
        break;
      }
      if (distanceBetween(x, y, enemy.x, enemy.y) > COLE_BALL.chainRange) {
        continue;
      }
      const prev = chained[chained.length - 1];
      spawnLightningBolt(ctx.scene, prev.x, prev.y, enemy.x, enemy.y, { heavy: false, life: 160 });
      resolveAbilityHit(
        ctx.scene,
        ctx.now,
        ctx.caster,
        enemy,
        {
          rawDamage: ctx.caster.stats.attackDamage * COLE_BALL.chainDamageMul,
          knockback: ctx.caster.stats.knockbackPower * 0.7,
          staminaDamage: 3,
          dirX: enemy.x - prev.x,
          dirY: enemy.y - prev.y,
          step: 1,
          heavy: false,
        },
        ctx.rivalBlock,
      );
      enemy.status.applySlow(ctx.now, COLE_BALL.chainSlowMs, COLE_BALL.chainSlowMul);
      chained.push(enemy);
    }
  }
}
