import { playWorld } from '../../../audio';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { WITCH_HEX, witchHexAllyRange } from './tunables';
import { nearestAllyHero } from './tombstone';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import type { NinjaBody } from '../../NinjaBody';

export const hexDef: AbilityDef = {
  id: 'witch-hex',
  name: 'Hex',
  slot: 'ability2',
  cooldownMs: WITCH_HEX.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.hex,
  accent: 0x9b4dff,
  padLabel: 'HEX',
  tactics: { roles: ['defense', 'peel'], range: witchHexAllyRange() },
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new HexAbility(ctx),
};

class HexAbility implements ActiveAbility {
  readonly id = hexDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;
  private applied = false;

  constructor(ctx: AbilityContext) {
    this.until = ctx.now + WITCH_HEX.castMs;
    ctx.caster.stop();
    ctx.caster.status.applyControlLock(ctx.now, WITCH_HEX.castMs);
    ctx.caster.playCustomAttack(ctx.now, WITCH_HEX.castMs, (frac) => ({
      staffRaise: Math.min(1, frac * 2.4),
      armLiftRight: 0.5,
      armLiftLeft: 0.15,
    }));
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'HEX', 0x9b4dff);
    playWorld('witch-hex-cast', ctx.caster);
    this.applyBuffs(ctx);
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down || !caster.isPresent) {
      return false;
    }
    caster.stop();
    this.applyBuffs(ctx);
    return now < this.until;
  }

  private applyBuffs(ctx: AbilityContext): void {
    if (this.applied) {
      return;
    }
    this.applied = true;
    applyHexBuff(ctx, ctx.caster);
    const ally = nearestAllyHero(ctx.caster, ctx.allies ?? [], witchHexAllyRange());
    if (ally) {
      applyHexBuff(ctx, ally);
    }
  }

  destroy(): void {}
}

const applyHexBuff = (ctx: AbilityContext, target: NinjaBody): void => {
  const now = ctx.now;
  const shield = Math.round(ctx.caster.stats.maxHealth * WITCH_HEX.shieldHealthMul);
  target.applyTempShield(now, shield, WITCH_HEX.durationMs);
  target.status.applyHasteBuff(now, WITCH_HEX.durationMs, WITCH_HEX.moveMul, WITCH_HEX.attackSpeedMul);
  target.showMagicVortex(now + WITCH_HEX.durationMs, 0x9b4dff);
  playWorld('witch-hex-buff', target);
};
