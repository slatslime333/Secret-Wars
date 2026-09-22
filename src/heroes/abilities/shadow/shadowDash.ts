import { playWorld } from '../../../audio';
import { COMBAT } from '../../../config/combat';
import { SHADOW } from '../../../config/shadow';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { breakProps } from '../../../match/objectives/worldStrike';
import { segmentHitsCircle } from '../geometry';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { spawnShadowSlash } from './clawFx';
import { NinjaBody } from '../../NinjaBody';
import { SHADOW_DASH } from './tunables';

export const shadowDashDef: AbilityDef = {
  id: 'shadow-dash',
  name: 'Shadow Dash',
  slot: 'ability2',
  cooldownMs: SHADOW_DASH.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.shadowDash,
  accent: 0x4a3470,
  aimOnRelease: true,
  padLabel: 'DASH',
  tactics: { roles: ['mobility', 'initiate', 'disruption', 'escape', 'cc'], range: SHADOW_DASH.distance },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new ShadowDashAbility(ctx),
};

class ShadowDashAbility implements ActiveAbility {
  readonly id = shadowDashDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly hit = new Set<NinjaBody>();
  private lastX: number;
  private lastY: number;
  private readonly caster: NinjaBody;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    this.caster = caster;
    const aim = ctx.aimOverride ?? caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dirX = aim.x / len;
    this.dirY = aim.y / len;
    caster.setAim(this.dirX, this.dirY);
    this.until = now + SHADOW_DASH.durationMs;
    this.lastX = caster.x;
    this.lastY = caster.y;
    const speed = SHADOW_DASH.distance / (SHADOW_DASH.durationMs / 1000);
    caster.setSpeedCap(speed);
    caster.status.applyControlLock(now, SHADOW_DASH.durationMs);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'DASH', 0x4a3470);
    playWorld('shadow-dash-whoosh', caster);
    caster.playCustomAttack(now, SHADOW_DASH.durationMs, (frac) => ({
      armLiftRight: 0.9,
      armLiftLeft: 0.2,
      swayX: this.dirX * 8 * frac,
    }));
    spawnShadowSlash(ctx.scene, caster.x, caster.y, this.dirX, this.dirY, SHADOW.attackRange * 1.15);
    breakProps({
      attacker: caster,
      now,
      damage: SHADOW_DASH.damage,
      reach: SHADOW_DASH.distance,
      dirX: this.dirX,
      dirY: this.dirY,
      halfArc: 0.7,
      impulse: 1.7,
    });
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (caster.down) {
      caster.setSpeedCap(COMBAT.physicsMaxSpeed);
      return false;
    }
    const speed = SHADOW_DASH.distance / (SHADOW_DASH.durationMs / 1000);
    caster.body?.setDrag(0, 0);
    caster.body?.setVelocity(this.dirX * speed, this.dirY * speed);
    this.sweep(ctx);
    this.lastX = caster.x;
    this.lastY = caster.y;
    if (now >= this.until) {
      caster.setSpeedCap(COMBAT.physicsMaxSpeed);
      return false;
    }
    return true;
  }

  destroy(): void {
    this.caster.setSpeedCap(COMBAT.physicsMaxSpeed);
    this.hit.clear();
  }

  private sweep(ctx: AbilityContext): void {
    const radius = SHADOW.bodyRadius + SHADOW.bodyRadius + SHADOW_DASH.pathPadding;
    for (const enemy of ctx.enemies) {
      if (enemy.down || this.hit.has(enemy)) {
        continue;
      }
      if (!segmentHitsCircle(this.lastX, this.lastY, ctx.caster.x, ctx.caster.y, enemy.x, enemy.y, radius)) {
        continue;
      }
      this.hit.add(enemy);
      const side =
        Math.sign((enemy.x - ctx.caster.x) * -this.dirY + (enemy.y - ctx.caster.y) * this.dirX) || 1;
      const kbX = -this.dirY * side;
      const kbY = this.dirX * side;
      const kind = resolveAbilityHit(
        ctx.scene,
        ctx.now,
        ctx.caster,
        enemy,
        {
          rawDamage: SHADOW_DASH.damage,
          knockback: SHADOW.knockbackPower * SHADOW_DASH.knockbackMul,
          staminaDamage: SHADOW_DASH.staminaDamage,
          dirX: kbX,
          dirY: kbY,
          step: 2,
          heavy: false,
        },
        ctx.rivalBlock,
      );
      if (kind === 'hit') {
        enemy.status.applySlow(ctx.now, SHADOW_DASH.slowMs, SHADOW_DASH.slowMul);
        enemy.status.applyAttackSpeedSlow(ctx.now, SHADOW_DASH.slowMs, SHADOW_DASH.attackSlowMul);
        playWorld('shadow-dash-impact', enemy);
      }
    }
  }
}
