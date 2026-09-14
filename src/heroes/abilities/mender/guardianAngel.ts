import { playWorld } from '../../../audio';
import { COLE } from '../../../config/cole';
import { Projectile } from '../../../combat/projectile';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { spawnShockwaveRing } from '../../../effects/lightning';
import { NinjaBody } from '../../NinjaBody';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { distanceBetween } from '../geometry';
import { MENDER_ANGEL } from './tunables';
import { allyAlongAim } from './targeting';
import { clearGuardian, drawGuardianAura, guardianOf, setGuardian } from './shieldState';

export const guardianAngelDef: AbilityDef = {
  id: 'mender-guardian-angel',
  name: 'Guardian Angel',
  slot: 'ability1',
  cooldownMs: MENDER_ANGEL.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.guardianAngel,
  accent: 0x4aa8ff,
  aimOnRelease: true,
  padLabel: 'ANGEL',
  deferCooldown: true,
  tactics: { roles: ['defense', 'peel'], range: MENDER_ANGEL.maxRange },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new GuardianAngelAbility(ctx),
};

class GuardianAngelAbility implements ActiveAbility {
  readonly id = guardianAngelDef.id;
  readonly control = { move: false, attack: false, dash: false, block: false, abilities: false };
  consumeDeferred = true;
  private phase: 'shot' | 'done' = 'shot';
  private readonly shot: Projectile;

  constructor(ctx: AbilityContext) {
    const aim = ctx.aimOverride ?? ctx.caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    let nx = aim.x / len;
    let ny = aim.y / len;
    const ally = allyAlongAim(ctx.caster, ctx.allies ?? [], MENDER_ANGEL.maxRange, nx, ny);
    if (ally) {
      const dx = ally.x - ctx.caster.x;
      const dy = ally.y - ctx.caster.y;
      const d = Math.hypot(dx, dy) || 1;
      nx = dx / d;
      ny = dy / d;
      ctx.caster.setAim(nx, ny);
    }
    this.shot = new Projectile(
      ctx.scene,
      ctx.caster.x + nx * 18,
      ctx.caster.y + ny * 18,
      nx * MENDER_ANGEL.speed,
      ny * MENDER_ANGEL.speed,
      MENDER_ANGEL.radius,
      MENDER_ANGEL.lifetimeMs,
      0x4aa8ff,
      'spark',
      MENDER_ANGEL.maxRange,
      { x: ctx.caster.x, y: ctx.caster.y },
      ctx.caster.team,
    );
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'ANGEL', 0x7ecbff);
    playWorld('cole-ball-cast', ctx.caster);
  }

  update(ctx: AbilityContext): boolean {
    if (this.phase === 'shot') {
      const dt = ctx.delta / 1000;
      const allies = (ctx.allies ?? []).filter((ally) => ally !== ctx.caster && !ally.down && ally.isPresent);
      const result = this.shot.update(ctx.now, dt, allies);
      if (result === 'dead') {
        this.consumeDeferred = true;
        this.phase = 'done';
        return false;
      }
      if (result) {
        this.beginShield(ctx, result.target);
        this.consumeDeferred = false;
        this.phase = 'done';
        return false;
      }
      return true;
    }
    return false;
  }

  destroy(): void {
    this.shot.destroy();
  }

  private beginShield(ctx: AbilityContext, ally: NinjaBody): void {
    const existing = guardianOf(ally);
    existing?.gfx.destroy();
    const gfx = ctx.scene.add.graphics().setDepth(12);
    setGuardian(ally, { until: ctx.now + MENDER_ANGEL.durationMs, absorbed: 0, gfx, flashUntil: 0 });
    ctx.holdAbilitySlot?.('ability1');
    spawnCombatCallout(ctx.scene, ally.x, ally.y, 'SHIELD', 0x7ecbff);
    playWorld('witch-hex-buff', ally);
    startGuardianTicker(ctx, ally);
  }
}

const startGuardianTicker = (ctx: AbilityContext, target: NinjaBody): void => {
  const caster = ctx.caster;
  const rivals = ctx.rivalBlock;
  ctx.world.addTicker({
    update: (now, _delta, fighters) => {
      const state = guardianOf(target);
      if (!state) {
        ctx.releaseAbilitySlot?.('ability1', now, true);
        return false;
      }
      if (target.down || !target.isPresent || now >= state.until) {
        const absorbed = state.absorbed;
        clearGuardian(target);
        ctx.releaseAbilitySlot?.('ability1', now, true);
        resolveGuardianBurst(
          {
            scene: ctx.scene,
            now,
            delta: 16,
            caster,
            enemies: fighters.filter((fighter) => fighter.team !== caster.team),
            allies: fighters.filter((fighter) => fighter.team === caster.team),
            world: ctx.world,
            interruptCombat: () => undefined,
            rivalBlock: rivals,
          },
          target,
          absorbed,
        );
        return false;
      }
      drawGuardianAura(state, target.x, target.y, now);
      return true;
    },
    destroy: () => {
      /* aura gfx is owned by the shield state */
    },
  });
};

const resolveGuardianBurst = (ctx: AbilityContext, target: NinjaBody, absorbed: number): void => {
  const t = Math.max(0, Math.min(1, absorbed / MENDER_ANGEL.absorbRef));
  const radius = Math.round(MENDER_ANGEL.baseRadius + (MENDER_ANGEL.maxRadius - MENDER_ANGEL.baseRadius) * t);
  spawnShockwaveRing(ctx.scene, target.x, target.y, radius);
  spawnCombatCallout(ctx.scene, target.x, target.y, absorbed > 0 ? 'BURST' : 'FADE', 0x7ecbff);
  playWorld('cole-discharge', target);

  if (absorbed > 0 && !target.down && target.isPresent) {
    const heal = Math.max(0, Math.round(absorbed * MENDER_ANGEL.healRatio));
    const stamina = Math.min(MENDER_ANGEL.staminaCap, Math.round(absorbed * MENDER_ANGEL.staminaRatio));
    target.heal(heal);
    target.stamina = Math.min(target.stats.maxStamina, target.stamina + stamina);
  }

  const knockback = COLE.knockbackPower * MENDER_ANGEL.explodeKnockbackMul * (0.38 + 0.62 * t);
  for (const enemy of ctx.enemies) {
    if (enemy.down || !enemy.isPresent) {
      continue;
    }
    if (distanceBetween(target.x, target.y, enemy.x, enemy.y) > radius + enemy.stats.bodyRadius) {
      continue;
    }
    resolveAbilityHit(
      ctx.scene,
      ctx.now,
      ctx.caster,
      enemy,
      {
        rawDamage: MENDER_ANGEL.explodeDamage,
        knockback,
        staminaDamage: 2,
        dirX: enemy.x - target.x,
        dirY: enemy.y - target.y,
        step: 2,
        heavy: false,
      },
      ctx.rivalBlock,
    );
  }
};
