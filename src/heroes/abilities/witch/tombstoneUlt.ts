import { playWorld } from '../../../audio';
import { isHeroFighter } from '../../../combat/damageEvents';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { COMBAT } from '../../../config/combat';
import { WITCH_ULT, witchAuraRadius } from './tunables';
import { TombstoneAbility } from './tombstone';
import type { NinjaBody } from '../../NinjaBody';

export const tombstoneUltDef: AbilityDef = {
  id: 'witch-tombstone-ult',
  name: 'Tombstone',
  slot: 'ultimate',
  cooldownMs: COMBAT.ultimateCooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.tombstoneUlt,
  accent: 0x9b4dff,
  padLabel: 'TOMB',
  tactics: { roles: ['aoe', 'cc', 'space', 'defense'], range: witchAuraRadius() },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new TombstoneUltAbility(ctx),
};

class TombstoneUltAbility implements ActiveAbility {
  readonly id = tombstoneUltDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly inner: TombstoneAbility;

  constructor(ctx: AbilityContext) {
    this.inner = new TombstoneAbility(ctx, WITCH_ULT.summonCount, WITCH_ULT.castMs, true);
    startWitchUltAura(ctx);
  }

  update(ctx: AbilityContext): boolean {
    return this.inner.update(ctx);
  }

  destroy(): void {
    this.inner.destroy();
  }
}

/** Aura outlives the summon cast so Witch can still hex and move during the 8s slow. */
const startWitchUltAura = (ctx: AbilityContext): void => {
  const gfx = ctx.scene.add.graphics().setDepth(9);
  const owner = ctx.caster;
  const until = ctx.now + WITCH_ULT.auraMs;
  let lastPulseAt = 0;

  const pulse = (now: number, fighters: readonly NinjaBody[]): void => {
    const radius = witchAuraRadius();
    playWorld('witch-ult-aura', owner);
    for (const enemy of fighters) {
      if (enemy.team === owner.team || enemy.down || !enemy.isPresent || !isHeroFighter(enemy)) {
        continue;
      }
      if (Math.hypot(enemy.x - owner.x, enemy.y - owner.y) > radius + enemy.stats.bodyRadius) {
        continue;
      }
      enemy.status.applySlow(now, WITCH_ULT.debuffMs, WITCH_ULT.moveMul);
      enemy.status.applyAttackSpeedSlow(now, WITCH_ULT.debuffMs, WITCH_ULT.attackSlowMul);
      enemy.showMagicVortex(now + WITCH_ULT.debuffMs, 0x7a28a8);
      playWorld('witch-ult-hex', enemy);
    }
  };

  pulse(ctx.now, ctx.enemies);
  lastPulseAt = ctx.now;

  ctx.world.addTicker({
    update: (now, _delta, fighters) => {
      if (!owner.isPresent || owner.down || now >= until) {
        return false;
      }
      const radius = witchAuraRadius();
      gfx.clear();
      gfx.setPosition(owner.x, owner.y);
      const age = now % 600;
      const wash = 0.16 + Math.sin(age / 80) * 0.05;
      gfx.fillStyle(0x9b4dff, wash);
      gfx.fillCircle(0, 0, radius);
      gfx.lineStyle(2, 0xc090ff, 0.55);
      gfx.strokeCircle(0, 0, radius);
      if (now - lastPulseAt >= 220) {
        lastPulseAt = now;
        pulse(now, fighters);
      }
      return true;
    },
    destroy: () => gfx.destroy(),
  });
};
