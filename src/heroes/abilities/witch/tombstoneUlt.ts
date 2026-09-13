import { playWorld } from '../../../audio';
import { isHeroFighter } from '../../../combat/damageEvents';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { COMBAT } from '../../../config/combat';
import { WITCH_ULT, witchAuraRadius } from './tunables';
import { TombstoneAbility } from './tombstone';
import Phaser from 'phaser';

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
  private readonly aura: Phaser.GameObjects.Graphics;

  constructor(ctx: AbilityContext) {
    this.inner = new TombstoneAbility(ctx, WITCH_ULT.summonCount, WITCH_ULT.castMs, true);
    this.aura = ctx.scene.add.graphics().setDepth(9);
    pulseUltAura(ctx);
  }

  update(ctx: AbilityContext): boolean {
    if (ctx.caster.down || !ctx.caster.isPresent) {
      return false;
    }
    this.drawAura(ctx);
    return this.inner.update(ctx);
  }

  destroy(): void {
    this.inner.destroy();
    this.aura.destroy();
  }

  private drawAura(ctx: AbilityContext): void {
    const radius = witchAuraRadius();
    const g = this.aura;
    g.clear();
    g.setPosition(ctx.caster.x, ctx.caster.y);
    const age = ctx.now % 600;
    const pulse = 0.16 + Math.sin(age / 80) * 0.05;
    g.fillStyle(0x9b4dff, pulse);
    g.fillCircle(0, 0, radius);
    g.lineStyle(2, 0xc090ff, 0.55);
    g.strokeCircle(0, 0, radius);
  }
}

const pulseUltAura = (ctx: AbilityContext): void => {
  const radius = witchAuraRadius();
  playWorld('witch-ult-aura', ctx.caster);
  for (const enemy of ctx.enemies) {
    if (enemy.down || !enemy.isPresent || !isHeroFighter(enemy)) {
      continue;
    }
    if (Math.hypot(enemy.x - ctx.caster.x, enemy.y - ctx.caster.y) > radius + enemy.stats.bodyRadius) {
      continue;
    }
    enemy.status.applySlow(ctx.now, WITCH_ULT.debuffMs, WITCH_ULT.moveMul);
    enemy.status.applyAttackSpeedSlow(ctx.now, WITCH_ULT.debuffMs, WITCH_ULT.attackSlowMul);
    enemy.showMagicVortex(ctx.now + WITCH_ULT.debuffMs, 0x7a28a8);
    playWorld('witch-ult-hex', enemy);
  }
};
