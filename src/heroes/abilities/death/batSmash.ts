import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEATH_SMASH } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { distanceBetween } from '../geometry';

export const batSmashDef: AbilityDef = {
  id: 'death-bat-smash',
  name: 'Bat Smash',
  slot: 'ability2',
  cooldownMs: DEATH_SMASH.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.batSmash,
  accent: COLORS.redBright,
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new BatSmashAbility(ctx),
};

class BatSmashAbility implements ActiveAbility {
  readonly id = batSmashDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;
  private readonly impactAt: number;
  private struck = false;
  private readonly ring: ReturnType<AbilityContext['scene']['add']['graphics']>;

  constructor(ctx: AbilityContext) {
    const { caster, now, scene } = ctx;
    this.until = now + DEATH_SMASH.animMs;
    this.impactAt = now + DEATH_SMASH.impactAt;
    caster.status.applyControlLock(now, DEATH_SMASH.animMs);
    this.ring = scene.add.graphics().setDepth(12);
    spawnCombatCallout(scene, caster.x, caster.y, 'SMASH', COLORS.redBright);
    caster.playCustomAttack(now, DEATH_SMASH.animMs, (frac) => {
      const wind = frac < 0.55 ? frac / 0.55 : 1;
      const crash = frac >= 0.55 ? (frac - 0.55) / 0.45 : 0;
      return {
        swordAngleOffset: -1.35 * wind + 2.4 * crash,
        batScale: DEATH_SMASH.batScale,
        armLiftRight: 0.9 * wind - 0.55 * crash,
        swayX: crash * (caster.aim.x >= 0 ? 6 : -6),
      };
    });
  }

  update(ctx: AbilityContext): boolean {
    this.drawTelegraph(ctx);
    if (!this.struck && ctx.now >= this.impactAt) {
      this.struck = true;
      this.impact(ctx);
    }
    if (ctx.now >= this.until || ctx.caster.down) {
      this.ring.destroy();
      return false;
    }
    return true;
  }

  destroy(): void {
    this.ring.destroy();
  }

  private drawTelegraph(ctx: AbilityContext): void {
    const { caster } = ctx;
    this.ring.clear();
    this.ring.lineStyle(3, COLORS.redBright, this.struck ? 0.15 : 0.4);
    this.ring.strokeCircle(caster.x, caster.y, DEATH_SMASH.radius);
  }

  private impact(ctx: AbilityContext): void {
    const { caster, scene, now } = ctx;
    spawnSmashRing(scene, caster.x, caster.y, DEATH_SMASH.radius);
    const aimLen = Math.hypot(caster.aim.x, caster.aim.y) || 1;
    const ax = caster.aim.x / aimLen;
    const ay = caster.aim.y / aimLen;
    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      if (distanceBetween(caster.x, caster.y, enemy.x, enemy.y) > DEATH_SMASH.radius + enemy.stats.bodyRadius) {
        continue;
      }
      const toX = enemy.x - caster.x;
      const toY = enemy.y - caster.y;
      const cross = ax * toY - ay * toX;
      const sign = cross >= 0 ? 1 : -1;
      const kind = resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: caster.stats.attackDamage * DEATH_SMASH.damageMul,
          knockback: caster.stats.knockbackPower * DEATH_SMASH.knockbackMul,
          staminaDamage: 8,
          dirX: -ay * sign,
          dirY: ax * sign,
          step: 3,
          heavy: true,
        },
        ctx.rivalBlock,
      );
      if (kind === 'hit') {
        enemy.status.applyStun(now, DEATH_SMASH.stunMs);
      }
    }
  }
}

const spawnSmashRing = (scene: AbilityContext['scene'], x: number, y: number, radius: number): void => {
  const graphics = scene.add.graphics().setDepth(16);
  const anim = { t: 0 };
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 220,
    ease: 'Cubic.Out',
    onUpdate: () => {
      graphics.clear();
      graphics.lineStyle(10 * (1 - anim.t), COLORS.redBright, 0.7 * (1 - anim.t));
      graphics.strokeCircle(x, y, radius * (0.45 + anim.t * 0.6));
      graphics.lineStyle(4, 0xc8a060, 0.85 * (1 - anim.t));
      graphics.strokeCircle(x, y, radius * (0.3 + anim.t * 0.5));
    },
    onComplete: () => graphics.destroy(),
  });
};
