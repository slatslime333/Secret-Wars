import { playWorld } from '../../../audio';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEATH_SMASH } from './tunables';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { COLORS } from '../../../ui/theme';
import { smashBatHits, smashCrashOffsets, smashSwingAngle } from './smashHit';
import { deathIdleBatAngle } from '../../drawDeath';
import { facingFromAim } from '../../drawNinja';
import { NinjaBody } from '../../NinjaBody';

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
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new BatSmashAbility(ctx),
};

class BatSmashAbility implements ActiveAbility {
  readonly id = batSmashDef.id;
  readonly control = { move: false, attack: true, dash: true, block: true, abilities: true };
  private readonly startedAt: number;
  private readonly until: number;
  private readonly impactAt: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly aimAngle: number;
  private burst = false;
  private readonly hit = new Set<NinjaBody>();
  private readonly ring: ReturnType<AbilityContext['scene']['add']['graphics']>;

  constructor(ctx: AbilityContext) {
    const { caster, now, scene } = ctx;
    const aim = ctx.aimOverride ?? caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.dirX = aim.x / len;
    this.dirY = aim.y / len;
    this.aimAngle = Math.atan2(this.dirY, this.dirX);
    caster.setAim(this.dirX, this.dirY);
    caster.stop();
    this.startedAt = now;
    this.until = now + DEATH_SMASH.animMs;
    this.impactAt = now + DEATH_SMASH.impactAt;
    caster.status.applyControlLock(now, DEATH_SMASH.animMs);
    this.ring = scene.add.graphics().setDepth(12);
    spawnCombatCallout(scene, caster.x, caster.y, 'SMASH', COLORS.redBright);
    const idle = deathIdleBatAngle(facingFromAim(this.dirX, this.dirY));
    const start = this.aimAngle - DEATH_SMASH.windupRad;
    const end = this.aimAngle + DEATH_SMASH.followRad;
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
    ctx.caster.stop();
    this.drawTelegraph(ctx);
    if (ctx.now >= this.impactAt) {
      this.sweep(ctx);
    }
    if (ctx.now >= this.until || ctx.caster.down) {
      this.ring.destroy();
      return false;
    }
    return true;
  }

  destroy(): void {
    this.ring.destroy();
    this.hit.clear();
  }

  private frac(now: number): number {
    return Math.min(1, Math.max(0, (now - this.startedAt) / DEATH_SMASH.animMs));
  }

  private drawTelegraph(ctx: AbilityContext): void {
    const { caster, now } = ctx;
    this.ring.clear();
    const alpha = now >= this.impactAt ? 0.16 : 0.5;
    const span = smashCrashOffsets();
    const a0 = this.aimAngle + span.from;
    const a1 = this.aimAngle + span.to;
    this.ring.fillStyle(COLORS.redBright, alpha * 0.16);
    this.ring.slice(caster.x, caster.y, DEATH_SMASH.radius, a0, a1, false);
    this.ring.fillPath();
    this.ring.lineStyle(3, COLORS.redBright, alpha);
    this.ring.beginPath();
    this.ring.arc(caster.x, caster.y, DEATH_SMASH.radius, a0, a1, false);
    this.ring.strokePath();
    this.ring.lineBetween(
      caster.x,
      caster.y,
      caster.x + Math.cos(a0) * DEATH_SMASH.radius,
      caster.y + Math.sin(a0) * DEATH_SMASH.radius,
    );
    this.ring.lineBetween(
      caster.x,
      caster.y,
      caster.x + Math.cos(a1) * DEATH_SMASH.radius,
      caster.y + Math.sin(a1) * DEATH_SMASH.radius,
    );
    const angle = smashSwingAngle(this.aimAngle, this.frac(now));
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    this.ring.lineStyle(3, 0xc8a060, now >= this.impactAt ? 0.22 : 0.7);
    this.ring.lineBetween(
      caster.x + nx * 10,
      caster.y + ny * 10,
      caster.x + nx * DEATH_SMASH.radius,
      caster.y + ny * DEATH_SMASH.radius,
    );
  }

  private sweep(ctx: AbilityContext): void {
    const { caster, scene, now } = ctx;
    if (!this.burst) {
      this.burst = true;
      spawnSmashBurst(scene, caster.x, caster.y, this.aimAngle);
      playWorld('death-smash-impact', caster);
    }
    const angle = smashSwingAngle(this.aimAngle, this.frac(now));
    for (const enemy of ctx.enemies) {
      if (enemy.down || this.hit.has(enemy)) {
        continue;
      }
      if (!smashBatHits(caster.x, caster.y, angle, enemy.x, enemy.y, enemy.stats.bodyRadius)) {
        continue;
      }
      const awayX = enemy.x - caster.x;
      const awayY = enemy.y - caster.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      this.hit.add(enemy);
      const kind = resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: DEATH_SMASH.damage,
          knockback: DEATH_SMASH.knockback,
          staminaDamage: 8,
          dirX: awayX / awayLen + this.dirX * 0.35,
          dirY: awayY / awayLen + this.dirY * 0.35,
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
  aimAngle: number,
): void => {
  const graphics = scene.add.graphics().setDepth(16);
  const anim = { t: 0 };
  const span = smashCrashOffsets();
  const a0 = aimAngle + span.from;
  const a1 = aimAngle + span.to;
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 220,
    ease: 'Cubic.Out',
    onUpdate: () => {
      const fade = 1 - anim.t;
      const grow = 0.88 + anim.t * 0.2;
      graphics.clear();
      graphics.fillStyle(COLORS.redBright, 0.22 * fade);
      graphics.slice(x, y, DEATH_SMASH.radius * grow, a0, a1, false);
      graphics.fillPath();
      graphics.lineStyle(8 * fade, COLORS.redBright, 0.7 * fade);
      graphics.beginPath();
      graphics.arc(x, y, DEATH_SMASH.radius * grow, a0, a1, false);
      graphics.strokePath();
      graphics.lineStyle(4, 0xc8a060, 0.85 * fade);
      graphics.lineBetween(x, y, x + Math.cos(aimAngle) * DEATH_SMASH.radius, y + Math.sin(aimAngle) * DEATH_SMASH.radius);
    },
    onComplete: () => graphics.destroy(),
  });
};
