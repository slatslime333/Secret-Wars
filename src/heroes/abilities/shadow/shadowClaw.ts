import { playWorld } from '../../../audio';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { SHADOW } from '../../../config/shadow';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { breakProps } from '../../../match/objectives/worldStrike';
import { isInAttackArc } from '../../../combat/hitDetection';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { spawnShadowSlash } from './clawFx';
import { SHADOW_CLAW } from './tunables';

export const shadowClawDef: AbilityDef = {
  id: 'shadow-claw',
  name: 'Shadow Claw',
  slot: 'ability1',
  cooldownMs: SHADOW_CLAW.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.shadowClaw,
  accent: 0x6a48a0,
  aimOnRelease: true,
  padLabel: 'CLAW',
  tactics: { roles: ['burst', 'knockback', 'damage', 'space'], range: SHADOW_CLAW.radius },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new ShadowClawAbility(ctx),
};

class ShadowClawAbility implements ActiveAbility {
  readonly id = shadowClawDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;
  private readonly impactAt: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private struck = false;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    const aim = ctx.aimOverride ?? caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dirX = aim.x / len;
    this.dirY = aim.y / len;
    caster.setAim(this.dirX, this.dirY);
    caster.stop();
    this.until = now + SHADOW_CLAW.animMs;
    this.impactAt = now + SHADOW_CLAW.impactAt;
    caster.status.applyControlLock(now, SHADOW_CLAW.animMs);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'CLAW', 0x6a48a0);
    playWorld('shadow-claw-charge', caster);
    caster.playCustomAttack(now, SHADOW_CLAW.animMs, (frac) => ({
      armLiftRight: frac < 0.38 ? 0.15 + frac * 2.1 : Math.max(0.15, 1.45 - (frac - 0.38) * 2.2),
      armLiftLeft: frac < 0.38 ? 0.08 : 0.22,
      swayX: this.dirX * (frac < 0.4 ? -6 : 14) * Math.min(1, frac * 1.35),
    }));
  }

  update(ctx: AbilityContext): boolean {
    ctx.caster.stop();
    if (!this.struck && ctx.now >= this.impactAt) {
      this.strike(ctx);
    }
    return ctx.now < this.until && !ctx.caster.down;
  }

  destroy(): void {}

  private strike(ctx: AbilityContext): void {
    this.struck = true;
    const { caster } = ctx;
    spawnShadowSlash(ctx.scene, caster.x, caster.y, this.dirX, this.dirY, SHADOW_CLAW.radius, true);
    playWorld('shadow-claw-whoosh', caster);
    breakProps({
      attacker: caster,
      now: ctx.now,
      damage: SHADOW_CLAW.damage,
      reach: SHADOW_CLAW.radius,
      dirX: this.dirX,
      dirY: this.dirY,
      halfArc: SHADOW_CLAW.halfArc,
      impulse: 1.8,
    });
    let hit = false;
    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      if (
        !isInAttackArc(
          caster.x,
          caster.y,
          this.dirX,
          this.dirY,
          enemy.x,
          enemy.y,
          SHADOW_CLAW.radius + enemy.stats.bodyRadius,
          SHADOW_CLAW.halfArc,
          enemy.stats.bodyRadius,
        )
      ) {
        continue;
      }
      const kind = resolveAbilityHit(
        ctx.scene,
        ctx.now,
        caster,
        enemy,
        {
          rawDamage: SHADOW_CLAW.damage,
          knockback: SHADOW.knockbackPower * SHADOW_CLAW.knockbackMul,
          staminaDamage: SHADOW_CLAW.staminaDamage,
          dirX: this.dirX,
          dirY: this.dirY,
          step: 3,
          heavy: true,
          launchCap: SHADOW_CLAW.launchCap,
        },
        ctx.rivalBlock,
      );
      if (kind === 'hit') {
        hit = true;
      }
    }
    if (hit) {
      playWorld('shadow-claw-impact', caster);
    }
  }
}
