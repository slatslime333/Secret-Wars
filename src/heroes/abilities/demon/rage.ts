import { playWorld } from '../../../audio';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { AbilityContext, AbilityDef, AbilityControlFlags, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEMON_RAGE } from './tunables';
import { applyDemonBigStats, applyDemonLittleStats } from './form';

export const demonRageDef: AbilityDef = {
  id: 'demon-rage',
  name: 'Demon Rage',
  slot: 'ultimate',
  cooldownMs: 0,
  chargeMode: 'meter',
  startingCharges: 0,
  maxCharges: 1,
  iconKey: ABILITY_ICON.demonRage,
  accent: 0xff4a10,
  padLabel: 'D.RAGE',
  tactics: { roles: ['burst', 'initiate', 'damage'], range: 80 },
  canActivate: (ctx) => canStartAbility(ctx) && ctx.caster.demonForm === 'little' && ctx.caster.demonRage >= 1,
  activate: (ctx) => new DemonRageAbility(ctx),
};

class DemonRageAbility implements ActiveAbility {
  readonly id = demonRageDef.id;
  readonly control: AbilityControlFlags = { move: true, attack: true, dash: true, block: true, abilities: true };
  private phase: 'lock' | 'big' = 'lock';
  private readonly lockUntil: number;
  private activeUntil = 0;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    this.lockUntil = now + DEMON_RAGE.lockMs;
    caster.demonForm = 'transforming';
    caster.demonRage = 1;
    caster.stop();
    caster.status.applyControlLock(now, DEMON_RAGE.lockMs);
    caster.grantInvulnerable(now + DEMON_RAGE.lockMs);
    caster.view.setScale(1.08);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'DEMON RAGE', 0xff4a10);
    playWorld('shadow-rage-cast', caster);
    caster.playCustomAttack(now, DEMON_RAGE.lockMs, (frac) => ({
      armLiftRight: 0.3 + frac * 1.1,
      armLiftLeft: 0.25 + frac * 0.9,
      jumpY: -10 * Math.sin(frac * Math.PI),
    }));
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down || !caster.isPresent) {
      this.revert(caster);
      return false;
    }
    if (this.phase === 'lock') {
      caster.stop();
      caster.demonRage = 1;
      caster.view.setScale(1.08 + 0.22 * (1 - Math.max(0, this.lockUntil - now) / DEMON_RAGE.lockMs));
      if (now >= this.lockUntil) {
        this.beginBig(ctx);
      }
      return true;
    }
    const left = Math.max(0, this.activeUntil - now);
    caster.demonRage = left / DEMON_RAGE.durationMs;
    caster.demonTransformUntil = this.activeUntil;
    if (left <= 0) {
      this.revert(caster);
      return false;
    }
    return true;
  }

  destroy(): void {
    /* Revert runs from update / death. */
  }

  private beginBig(ctx: AbilityContext): void {
    this.phase = 'big';
    this.control.move = false;
    this.control.attack = false;
    this.control.dash = false;
    this.control.block = false;
    this.control.abilities = true;
    this.activeUntil = ctx.now + DEMON_RAGE.durationMs;
    const { caster } = ctx;
    applyDemonBigStats(caster);
    caster.demonForm = 'big';
    caster.demonTransformUntil = this.activeUntil;
    caster.stamina = Math.min(
      caster.stats.maxStamina,
      caster.stamina + Math.round(caster.stats.maxStamina * DEMON_RAGE.staminaOnActivate),
    );
    caster.heal(Math.round(caster.stats.maxHealth * DEMON_RAGE.healOnActivate));
    caster.view.setScale(1.28);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'DEMON RAGE', 0xffc030);
    playWorld('shadow-rage-active', caster);
  }

  private revert(caster: AbilityContext['caster']): void {
    applyDemonLittleStats(caster);
    caster.demonForm = 'little';
    caster.demonRage = 0;
    caster.demonTransformUntil = 0;
    caster.view.setScale(1);
  }
}

/** Auto-start Demon Rage when the meter fills. Skips a player F press. */
export const tryAutoDemonRage = (ctx: AbilityContext, activate: () => boolean): void => {
  if (ctx.caster.heroId !== 'demon') {
    return;
  }
  if (ctx.caster.demonForm !== 'little' || ctx.caster.demonRage < 1) {
    return;
  }
  activate();
};
