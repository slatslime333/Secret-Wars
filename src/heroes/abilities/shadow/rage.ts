import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { AbilityContext, AbilityDef, AbilityControlFlags, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { SHADOW_RAGE } from './tunables';

export const shadowRageDef: AbilityDef = {
  id: 'shadow-rage',
  name: 'Rage',
  slot: 'ultimate',
  cooldownMs: COMBAT.ultimateCooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.shadowRage,
  accent: 0x8a68c0,
  padLabel: 'RAGE',
  tactics: { roles: ['burst', 'damage', 'initiate'], range: 80 },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new ShadowRageAbility(ctx),
};

class ShadowRageAbility implements ActiveAbility {
  readonly id = shadowRageDef.id;
  readonly control: AbilityControlFlags = { move: true, attack: true, dash: true, block: true, abilities: true };
  private phase: 'cast' | 'active' = 'cast';
  private readonly castUntil: number;
  private activeUntil = 0;
  private empowered = false;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    this.castUntil = now + SHADOW_RAGE.castMs;
    caster.stop();
    caster.status.applyControlLock(now, SHADOW_RAGE.castMs);
    caster.showRageFire(now + SHADOW_RAGE.castMs + SHADOW_RAGE.durationMs, this.castUntil);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'RAGE', 0x8a68c0);
    playWorld('shadow-rage-cast', caster);
    caster.playCustomAttack(now, SHADOW_RAGE.castMs, (frac) => ({
      armLiftRight: 0.4 + frac * 0.9,
      armLiftLeft: 0.2,
      jumpY: -6 * Math.sin(frac * Math.PI),
    }));
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down || !caster.isPresent) {
      return false;
    }
    if (this.phase === 'cast') {
      caster.stop();
      caster.showRageFire(this.castUntil + SHADOW_RAGE.durationMs, this.castUntil);
      if (now >= this.castUntil) {
        this.beginActive(ctx);
      }
      return true;
    }
    this.refreshBuffs(ctx);
    return now < this.activeUntil;
  }

  destroy(): void {
    /* Buff timers and VFX expire on their own; death/clearRage strips them. */
  }

  private beginActive(ctx: AbilityContext): void {
    this.phase = 'active';
    this.control.move = false;
    this.control.attack = false;
    this.control.dash = false;
    this.control.block = false;
    this.control.abilities = false;
    this.activeUntil = ctx.now + SHADOW_RAGE.durationMs;
    playWorld('shadow-rage-active', ctx.caster);
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'RAGE', 0xb8a0e0);
    this.applyBuffs(ctx, true);
  }

  private refreshBuffs(ctx: AbilityContext): void {
    this.applyBuffs(ctx, false);
  }

  private applyBuffs(ctx: AbilityContext, grantPool: boolean): void {
    const { caster, now } = ctx;
    const left = Math.max(0, this.activeUntil - now);
    if (left <= 0) {
      return;
    }
    caster.status.applyHasteBuff(now, left, SHADOW_RAGE.moveMul, SHADOW_RAGE.attackSpeedMul);
    caster.status.applyDefenseBuff(now, left, SHADOW_RAGE.defenseMul);
    caster.status.applyStaminaRegenBuff(now, left, SHADOW_RAGE.staminaRegenMul);
    caster.showRageFire(now + left, 0);
    if (grantPool && !this.empowered) {
      this.empowered = true;
      caster.applyRagePool(now, left, SHADOW_RAGE.staminaPoolMul);
    }
  }
}
