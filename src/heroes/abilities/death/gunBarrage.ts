import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEATH_GUN } from './tunables';
import { Projectile } from '../../../combat/projectile';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { spawnMuzzleFlash } from '../../../effects/muzzleFlash';
import { COLORS } from '../../../ui/theme';
import { deathUziMuzzleOffset } from '../../drawDeath';
import { facingFromAim } from '../../drawNinja';

export const gunBarrageDef: AbilityDef = {
  id: 'death-gun-barrage',
  name: 'Gun Barrage',
  slot: 'ability1',
  cooldownMs: DEATH_GUN.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.gunBarrage,
  accent: COLORS.orange,
  aimOnRelease: true,
  padLabel: 'GUN',
  deferCooldown: true,
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new GunBarrageAbility(ctx),
};

class GunBarrageAbility implements ActiveAbility {
  readonly id = gunBarrageDef.id;
  readonly control = { move: false, attack: true, dash: true, block: false, abilities: true };
  private fired = 0;
  private nextShotAt: number;
  private done = false;

  constructor(ctx: AbilityContext) {
    this.nextShotAt = ctx.now + 160;
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'BARRAGE', COLORS.orange);
    ctx.caster.playCustomAttack(ctx.now, DEATH_GUN.bullets * DEATH_GUN.intervalMs + 220, (frac) => ({
      armLiftRight: 0.35 + Math.sin(frac * Math.PI * 18) * 0.12,
      armLiftLeft: 0.1,
      batOnBack: true,
      showUzi: true,
      swayX: Math.sin(frac * Math.PI * 16) * 2,
    }));
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (this.done || caster.down) {
      return false;
    }
    this.aimCaster(ctx);
    if (now >= this.nextShotAt && this.fired < DEATH_GUN.bullets) {
      this.fire(ctx);
      this.fired += 1;
      this.nextShotAt = now + DEATH_GUN.intervalMs;
    }
    if (this.fired >= DEATH_GUN.bullets) {
      this.done = true;
      return false;
    }
    return true;
  }

  destroy(): void {
    this.done = true;
  }

  private aimCaster(ctx: AbilityContext): void {
    const pad = ctx.aimOverride;
    if (pad && pad.x * pad.x + pad.y * pad.y > 0.01) {
      ctx.caster.setAim(pad.x, pad.y);
      return;
    }
    const aim = ctx.caster.aim;
    if (aim.lengthSq() > 0.01) {
      ctx.caster.setAim(aim.x, aim.y);
    }
  }

  private fire(ctx: AbilityContext): void {
    const { caster, scene, world } = ctx;
    const aim = ctx.aimOverride ?? caster.aim;
    const length = Math.hypot(aim.x, aim.y) || 1;
    const nx = aim.x / length;
    const ny = aim.y / length;
    caster.setAim(nx, ny);
    const muzzle = deathUziMuzzleOffset(facingFromAim(nx, ny), 0.35);
    const mx = caster.x + muzzle.x;
    const my = caster.y + muzzle.y;
    spawnMuzzleFlash(scene, mx, my, nx, ny);
    const shot = new Projectile(
      scene,
      mx + nx * 6,
      my + ny * 4,
      nx * DEATH_GUN.speed,
      ny * DEATH_GUN.speed,
      DEATH_GUN.radius,
      DEATH_GUN.lifetimeMs,
      0xe8c070,
      'slug',
    );
    world.addTicker({
      update: (now, delta, fighters) => {
        const enemies = fighters.filter((fighter) => fighter.team !== caster.team && !fighter.down);
        const result = shot.update(now, delta / 1000, enemies);
        if (result === 'dead') {
          return false;
        }
        if (result) {
          resolveAbilityHit(
            scene,
            now,
            caster,
            result.target,
            {
              rawDamage: caster.stats.attackDamage * DEATH_GUN.damageMul,
              knockback: caster.stats.knockbackPower * DEATH_GUN.knockbackMul,
              staminaDamage: 2,
              dirX: nx,
              dirY: ny,
              step: 1,
              heavy: false,
            },
            ctx.rivalBlock,
          );
          return false;
        }
        return true;
      },
      destroy: () => shot.destroy(),
    });
  }
}
