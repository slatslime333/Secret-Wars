import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { isHeroFighter } from '../../../combat/damageEvents';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { MENDER_WIND } from './tunables';
import type { NinjaBody } from '../../NinjaBody';

export const secondWindDef: AbilityDef = {
  id: 'mender-second-wind',
  name: 'Second Wind',
  slot: 'ultimate',
  cooldownMs: COMBAT.ultimateCooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.secondWind,
  accent: 0xf0d050,
  padLabel: 'WIND',
  tactics: { roles: ['defense', 'peel', 'aoe', 'space'], range: MENDER_WIND.radius },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new SecondWindAbility(ctx),
};

class SecondWindAbility implements ActiveAbility {
  readonly id = secondWindDef.id;
  readonly control = { move: false, attack: false, dash: false, block: false, abilities: false };
  private readonly until: number;

  constructor(ctx: AbilityContext) {
    this.until = ctx.now + 220;
    ctx.caster.status.applyControlLock(ctx.now, 220);
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'SECOND WIND', 0xf0d050);
    playWorld('witch-ult-cast', ctx.caster);
    startSecondWindField(ctx);
  }

  update(ctx: AbilityContext): boolean {
    return ctx.now < this.until;
  }

  destroy(): void {}
}

const startSecondWindField = (ctx: AbilityContext): void => {
  const originX = ctx.caster.x;
  const originY = ctx.caster.y;
  const owner = ctx.caster;
  const gfx = ctx.scene.add.graphics().setDepth(8);
  const until = ctx.now + MENDER_WIND.durationMs;
  let lastPulse = ctx.now;

  const inside = (fighter: NinjaBody): boolean =>
    Math.hypot(fighter.x - originX, fighter.y - originY) <= MENDER_WIND.radius + fighter.stats.bodyRadius;

  ctx.world.addTicker({
    update: (now, _delta, fighters) => {
      if (now >= until) {
        return false;
      }
      gfx.clear();
      gfx.setPosition(originX, originY);
      const wash = 0.14 + Math.sin(now / 160) * 0.04;
      gfx.fillStyle(0xf0d050, wash);
      gfx.fillCircle(0, 0, MENDER_WIND.radius);
      gfx.lineStyle(3, 0xfff2a0, 0.7);
      gfx.strokeCircle(0, 0, MENDER_WIND.radius);
      gfx.lineStyle(1.6, 0xffffff, 0.35);
      gfx.strokeCircle(0, 0, MENDER_WIND.radius * 0.72);
      gfx.lineStyle(2, 0xfff2a0, 0.5 + Math.sin(now / 90) * 0.12);
      for (const fighter of fighters) {
        if (fighter.down || !fighter.isPresent || !isHeroFighter(fighter) || !inside(fighter)) {
          continue;
        }
        if (fighter.team === owner.team) {
          continue;
        }
        gfx.strokeCircle(fighter.x - originX, fighter.y - originY, 16);
      }

      if (now - lastPulse < MENDER_WIND.pulseMs) {
        return true;
      }
      lastPulse = now;
      for (const fighter of fighters) {
        if (fighter.down || !fighter.isPresent || !isHeroFighter(fighter) || !inside(fighter)) {
          continue;
        }
        if (fighter.team === owner.team) {
          fighter.heal(MENDER_WIND.healPerSecond * (MENDER_WIND.pulseMs / 1000));
          fighter.status.applyStaminaRegenBuff(now, MENDER_WIND.pulseMs + 80, MENDER_WIND.staminaRegenMul);
          if (fighter === owner) {
            fighter.status.applyDefenseBuff(now, MENDER_WIND.pulseMs + 80, MENDER_WIND.defenseMul);
          }
        } else {
          fighter.status.applySlow(now, MENDER_WIND.pulseMs + 80, MENDER_WIND.enemySlowMul);
        }
      }
      playWorld('witch-ult-aura', owner);
      return true;
    },
    destroy: () => gfx.destroy(),
  });
};
