import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { COLE_DISCHARGE } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { breakProps } from '../../../match/objectives/worldStrike';
import { spawnLightningBolt, spawnShockwaveRing } from '../../../effects/lightning';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { distanceBetween } from '../geometry';

export const dischargeDef: AbilityDef = {
  id: 'cole-discharge',
  name: 'Discharge',
  slot: 'ability2',
  cooldownMs: COLE_DISCHARGE.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.discharge,
  accent: COLORS.cyan,
  tactics: { roles: ['aoe', 'cc', 'peel', 'space', 'damage'], range: COLE_DISCHARGE.radius },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new DischargeAbility(ctx),
};

class DischargeAbility implements ActiveAbility {
  readonly id = dischargeDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    this.until = now + COLE_DISCHARGE.expandMs;
    caster.status.applyControlLock(now, COLE_DISCHARGE.expandMs);
    spawnShockwaveRing(ctx.scene, caster.x, caster.y, COLE_DISCHARGE.radius);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'DISCHARGE', COLORS.cyan);
    breakProps({
      attacker: caster,
      now,
      damage: COLE_DISCHARGE.damage,
      reach: COLE_DISCHARGE.radius,
      dirX: caster.aim.x,
      dirY: caster.aim.y,
      impulse: 1.7,
    });

    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      const dist = distanceBetween(caster.x, caster.y, enemy.x, enemy.y);
      if (dist > COLE_DISCHARGE.radius + enemy.stats.bodyRadius) {
        continue;
      }
      const kind = resolveAbilityHit(
        ctx.scene,
        now,
        caster,
        enemy,
        {
          rawDamage: COLE_DISCHARGE.damage,
          knockback: caster.stats.knockbackPower * COLE_DISCHARGE.knockbackMul,
          staminaDamage: 8,
          dirX: enemy.x - caster.x,
          dirY: enemy.y - caster.y,
          step: 3,
          heavy: true,
        },
        ctx.rivalBlock,
      );
      if (kind === 'hit') {
        spawnLightningBolt(ctx.scene, caster.x, caster.y, enemy.x, enemy.y, { heavy: true, life: 180 });
        enemy.status.applyParalyze(now, COLE_DISCHARGE.paralyzeMs);
      }
    }
  }

  update(ctx: AbilityContext): boolean {
    return ctx.now < this.until;
  }

  destroy(): void {
    /* burst is instant */
  }
}
