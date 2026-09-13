import { playWorld } from '../../../audio';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEATH_SMASH } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { smashHitsTarget } from './smashHit';
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
    const alpha = this.struck ? 0.12 : 0.5;
    const hw = DEATH_SMASH.halfWidth;
    const nx = this.dirX;
    const ny = this.dirY;
    const px = -ny * hw;
    const py = nx * hw;
    const end = DEATH_SMASH.radius;
    this.ring.fillStyle(COLORS.redBright, alpha * 0.18);
    this.ring.fillTriangle(
      caster.x + px,
      caster.y + py,
      caster.x - px,
      caster.y - py,
      caster.x + nx * end + px,
      caster.y + ny * end + py,
    );
    this.ring.fillTriangle(
      caster.x - px,
      caster.y - py,
      caster.x + nx * end - px,
      caster.y + ny * end - py,
      caster.x + nx * end + px,
      caster.y + ny * end + py,
    );
    this.ring.lineStyle(3, COLORS.redBright, alpha);
    this.ring.lineBetween(caster.x + px, caster.y + py, caster.x + nx * end + px, caster.y + ny * end + py);
    this.ring.lineBetween(caster.x - px, caster.y - py, caster.x + nx * end - px, caster.y + ny * end - py);
    this.ring.strokeCircle(caster.x, caster.y, hw);
    this.ring.strokeCircle(caster.x + nx * end, caster.y + ny * end, hw);
    this.ring.lineStyle(2, 0xc8a060, this.struck ? 0.12 : 0.55);
    this.ring.lineBetween(
      caster.x + nx * 12,
      caster.y + ny * 12,
      caster.x + nx * (end + 16),
      caster.y + ny * (end + 16),
    );
  }

  private impact(ctx: AbilityContext): void {
    const { caster, scene, now } = ctx;
    spawnSmashBurst(scene, caster.x, caster.y, this.dirX, this.dirY);
    playWorld('death-smash-impact', caster);
    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      if (!smashHitsTarget(caster.x, caster.y, this.dirX, this.dirY, enemy.x, enemy.y, enemy.stats.bodyRadius)) {
        continue;
      }
      const kind = resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: DEATH_SMASH.damage,
          knockback: caster.stats.knockbackPower * DEATH_SMASH.knockbackMul,
          staminaDamage: 8,
          dirX: this.dirX,
          dirY: this.dirY,
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

const spawnSmashBurst = (
  scene: AbilityContext['scene'],
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): void => {
  const graphics = scene.add.graphics().setDepth(16);
  const anim = { t: 0 };
  const hw = DEATH_SMASH.halfWidth;
  const end = DEATH_SMASH.radius;
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 220,
    ease: 'Cubic.Out',
    onUpdate: () => {
      const fade = 1 - anim.t;
      const grow = 0.85 + anim.t * 0.35;
      const px = -dirY * hw * grow;
      const py = dirX * hw * grow;
      graphics.clear();
      graphics.lineStyle(10 * fade, COLORS.redBright, 0.7 * fade);
      graphics.lineBetween(x + px, y + py, x + dirX * end + px, y + dirY * end + py);
      graphics.lineBetween(x - px, y - py, x + dirX * end - px, y + dirY * end - py);
      graphics.strokeCircle(x + dirX * end, y + dirY * end, hw * grow);
      graphics.lineStyle(4, 0xc8a060, 0.85 * fade);
      graphics.lineBetween(x + dirX * 10, y + dirY * 10, x + dirX * end, y + dirY * end);
    },
    onComplete: () => graphics.destroy(),
  });
};
