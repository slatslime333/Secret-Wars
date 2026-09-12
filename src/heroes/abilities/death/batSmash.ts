import { playWorld } from '../../../audio';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEATH_SMASH } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { distanceBetween } from '../geometry';
import { deathIdleBatAngle } from '../../drawDeath';
import { facingFromAim } from '../../drawNinja';

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
  aimOnRelease: true,
  padLabel: 'SMASH',
  tactics: { roles: ['burst', 'cc', 'damage', 'finish', 'knockback'], range: DEATH_SMASH.radius },
  canActivate: (ctx) =>
    !ctx.caster.status.isHitReacting(ctx.now) &&
    !ctx.caster.status.isBlockStunned(ctx.now) &&
    !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new BatSmashAbility(ctx),
};

class BatSmashAbility implements ActiveAbility {
  readonly id = batSmashDef.id;
  readonly control = { move: false, attack: true, dash: true, block: true, abilities: true };
  private readonly until: number;
  private readonly impactAt: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private struck = false;
  private readonly ring: ReturnType<AbilityContext['scene']['add']['graphics']>;

  constructor(ctx: AbilityContext) {
    const { caster, now, scene } = ctx;
    const aim = ctx.aimOverride ?? caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dirX = aim.x / len;
    this.dirY = aim.y / len;
    caster.setAim(this.dirX, this.dirY);
    caster.stop();
    this.until = now + DEATH_SMASH.animMs;
    this.impactAt = now + DEATH_SMASH.impactAt;
    caster.status.applyControlLock(now, DEATH_SMASH.animMs);
    this.ring = scene.add.graphics().setDepth(12);
    spawnCombatCallout(scene, caster.x, caster.y, 'SMASH', COLORS.redBright);
    const aimAngle = Math.atan2(this.dirY, this.dirX);
    const idle = deathIdleBatAngle(facingFromAim(this.dirX, this.dirY));
    const start = aimAngle - DEATH_SMASH.windupRad;
    const end = aimAngle + DEATH_SMASH.followRad;
    caster.playCustomAttack(
      now,
      DEATH_SMASH.animMs,
      (frac) => {
        const wind = frac < 0.56 ? frac / 0.56 : 1;
        const crash = frac >= 0.56 ? (frac - 0.56) / 0.44 : 0;
        const swingT = crash > 0 ? 0.18 + crash * 0.82 : wind * 0.18;
        const angle = start + (end - start) * swingT;
        return {
          swordAngleOffset: angle - idle,
          batScale: DEATH_SMASH.batScale,
          armLiftRight: 0.72 * wind - 0.38 * crash,
          swayX: crash * (this.dirX >= 0 ? 7 : -7),
        };
      },
      'Linear',
    );
  }

  update(ctx: AbilityContext): boolean {
    if (!this.struck) {
      ctx.caster.stop();
    }
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
    const reach = DEATH_SMASH.radius + 16;
    this.ring.lineStyle(2, 0xc8a060, this.struck ? 0.12 : 0.55);
    this.ring.lineBetween(
      caster.x + this.dirX * 12,
      caster.y + this.dirY * 12,
      caster.x + this.dirX * reach,
      caster.y + this.dirY * reach,
    );
  }

  private impact(ctx: AbilityContext): void {
    const { caster, scene, now } = ctx;
    spawnSmashRing(scene, caster.x, caster.y, DEATH_SMASH.radius);
    playWorld('death-smash-impact', caster);
    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      if (
        distanceBetween(caster.x, caster.y, enemy.x, enemy.y) >
        DEATH_SMASH.radius + enemy.stats.bodyRadius + 12
      ) {
        continue;
      }
      const awayX = enemy.x - caster.x;
      const awayY = enemy.y - caster.y;
      const awayLen = Math.hypot(awayX, awayY);
      const dirX = awayLen < 10 ? this.dirX : this.dirX * 0.72 + (awayX / awayLen) * 0.28;
      const dirY = awayLen < 10 ? this.dirY : this.dirY * 0.72 + (awayY / awayLen) * 0.28;
      const kind = resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: DEATH_SMASH.damage,
          knockback: caster.stats.knockbackPower * DEATH_SMASH.knockbackMul,
          staminaDamage: 8,
          dirX,
          dirY,
          step: 3,
          heavy: true,
          launchCap: DEATH_SMASH.launchCap,
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
