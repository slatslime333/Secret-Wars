import Phaser from 'phaser';
import { playWorld } from '../../../audio';
import { NINJA } from '../../../config/ninja';
import { COMBAT } from '../../../config/combat';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { playUltimateShake } from '../../../effects/hitJuice';
import { COLORS } from '../../../ui/theme';
import { NinjaBody } from '../../NinjaBody';
import { AbilityContext, AbilityDef, ActiveAbility, canStartAbility } from '../types';
import { distanceBetween } from '../geometry';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { breakProps } from '../../../match/objectives/worldStrike';
import { ABILITY_ICON } from '../icons';
import { NINJA_TORNADO } from './tunables';

export const ninjaTornadoDef: AbilityDef = {
  id: 'ninja-tornado',
  name: 'Ninja Tornado',
  slot: 'ultimate',
  cooldownMs: COMBAT.ultimateCooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.ninjaTornado,
  accent: COLORS.yellow,
  tactics: { roles: ['aoe', 'burst', 'cc', 'damage', 'space'], range: NINJA_TORNADO.radius },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => new NinjaTornadoAbility(ctx),
};

class NinjaTornadoAbility implements ActiveAbility {
  readonly id = ninjaTornadoDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly endsAt: number;
  private readonly originX: number;
  private readonly originY: number;
  private nextSwipeAt: number;
  private readonly lastHitAt = new Map<NinjaBody, number>();
  private targetX: number;
  private targetY: number;
  private readonly fx: TornadoFx;
  private ghostAt = 0;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    this.endsAt = now + NINJA_TORNADO.durationMs;
    this.originX = caster.x;
    this.originY = caster.y;
    this.nextSwipeAt = now + 70;
    this.targetX = caster.x + caster.aim.x * 28;
    this.targetY = caster.y + caster.aim.y * 28;
    this.pickDestination(ctx);
    caster.status.applyControlLock(now, NINJA_TORNADO.durationMs);
    caster.setSpeedCap(NINJA_TORNADO.bounceSpeed);
    this.fx = new TornadoFx(ctx.scene, caster);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'TORNADO', COLORS.yellow);
    playUltimateShake(ctx.scene);
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    if (now >= this.endsAt || caster.down) {
      caster.setSpeedCap(COMBAT.physicsMaxSpeed);
      return false;
    }

    this.driveBounce(caster);
    this.fx.redraw(now, this.originX, this.originY);
    if (now >= this.ghostAt) {
      this.fx.spawnAfterimage(caster);
      this.ghostAt = now + 55;
    }

    if (now >= this.nextSwipeAt) {
      this.swipe(ctx);
      this.pickDestination(ctx);
      this.nextSwipeAt = now + NINJA_TORNADO.swipeIntervalMs;
    }
    return true;
  }

  destroy(): void {
    this.fx.destroy();
    this.lastHitAt.clear();
  }

  private driveBounce(caster: NinjaBody): void {
    const dx = this.targetX - caster.x;
    const dy = this.targetY - caster.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      return;
    }
    caster.setAim(dx, dy);
    caster.body?.setDrag(0, 0);
    caster.body?.setVelocity((dx / dist) * NINJA_TORNADO.bounceSpeed, (dy / dist) * NINJA_TORNADO.bounceSpeed);
  }

  private pickDestination(ctx: AbilityContext): void {
    const living = ctx.enemies.filter(
      (enemy) =>
        !enemy.down &&
        distanceBetween(enemy.x, enemy.y, this.originX, this.originY) <= NINJA_TORNADO.radius + NINJA.bodyRadius,
    );
    if (living.length > 0) {
      const pick = living[Math.floor(Math.random() * living.length)];
      const ang = Math.random() * Math.PI * 2;
      this.targetX = Phaser.Math.Clamp(pick.x + Math.cos(ang) * 18, this.originX - NINJA_TORNADO.radius, this.originX + NINJA_TORNADO.radius);
      this.targetY = Phaser.Math.Clamp(pick.y + Math.sin(ang) * 18, this.originY - NINJA_TORNADO.radius, this.originY + NINJA_TORNADO.radius);
      return;
    }
    const ang = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * (NINJA_TORNADO.radius * 0.72);
    this.targetX = this.originX + Math.cos(ang) * dist;
    this.targetY = this.originY + Math.sin(ang) * dist;
  }

  private swipe(ctx: AbilityContext): void {
    const { caster, now, scene } = ctx;
    spawnSlash(scene, caster);
    playWorld('ninja-tornado-slash', caster);
    breakProps({
      attacker: caster,
      now,
      damage: NINJA_TORNADO.damage,
      reach: NINJA_TORNADO.radius,
      dirX: caster.aim.x,
      dirY: caster.aim.y,
      impulse: 1.4,
    });
    for (const enemy of ctx.enemies) {
      if (enemy.down) {
        continue;
      }
      if (distanceBetween(caster.x, caster.y, enemy.x, enemy.y) > NINJA_TORNADO.radius + NINJA.bodyRadius) {
        continue;
      }
      const last = this.lastHitAt.get(enemy) ?? -9999;
      if (now - last < NINJA_TORNADO.hitCooldownMs) {
        continue;
      }
      const dirX = enemy.x - caster.x;
      const dirY = enemy.y - caster.y;
      const result = resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: NINJA_TORNADO.damage,
          knockback: NINJA_TORNADO.knockback,
          staminaDamage: NINJA_TORNADO.staminaDamage,
          dirX: dirX || caster.aim.x,
          dirY: dirY || caster.aim.y,
          step: 1,
          hitReactionMs: NINJA_TORNADO.stunMs,
          stun: true,
          heavy: true,
        },
        ctx.rivalBlock,
      );
      if (result === 'hit' || result === 'blocked' || result === 'perfect-block') {
        this.lastHitAt.set(enemy, now);
      }
    }
  }
}

class TornadoFx {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly blades: Phaser.GameObjects.Graphics;
  private readonly ghosts: Phaser.GameObjects.Graphics[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly caster: NinjaBody,
  ) {
    this.ring = scene.add.graphics().setDepth(8);
    this.blades = scene.add.graphics().setDepth(14);
  }

  redraw(now: number, originX: number, originY: number): void {
    const spin = now / 70;
    this.ring.clear();
    this.ring.lineStyle(3, COLORS.yellow, 0.28);
    this.ring.strokeCircle(originX, originY, NINJA_TORNADO.radius);
    this.ring.lineStyle(2, COLORS.orange, 0.2);
    this.ring.strokeCircle(originX, originY, NINJA_TORNADO.radius * 0.7);

    this.blades.clear();
    this.blades.setPosition(this.caster.x, this.caster.y);
    for (let i = 0; i < 3; i += 1) {
      const a0 = spin + i * ((Math.PI * 2) / 3);
      const a1 = a0 + 1.15;
      const radius = 22 + i * 7;
      this.blades.lineStyle(8 - i * 2, i === 0 ? COLORS.paper : COLORS.orange, 0.7);
      this.blades.beginPath();
      this.blades.arc(0, 0, radius, a0, a1);
      this.blades.strokePath();
    }
  }

  spawnAfterimage(caster: NinjaBody): void {
    const ghost = this.scene.add.graphics().setDepth(9);
    ghost.setPosition(caster.x, caster.y);
    ghost.fillStyle(COLORS.paper, 0.28);
    ghost.fillEllipse(0, 2, 12, 18);
    ghost.fillStyle(COLORS.ink, 0.35);
    ghost.fillCircle(0, -10, 6);
    ghost.lineStyle(2, COLORS.orange, 0.55);
    ghost.beginPath();
    ghost.arc(2, 0, 16, -0.8, 0.9);
    ghost.strokePath();
    this.ghosts.push(ghost);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        ghost.destroy();
        const index = this.ghosts.indexOf(ghost);
        if (index >= 0) {
          this.ghosts.splice(index, 1);
        }
      },
    });
  }

  destroy(): void {
    this.ring.destroy();
    this.blades.destroy();
    for (const ghost of this.ghosts) {
      ghost.destroy();
    }
    this.ghosts.length = 0;
  }
}

const spawnSlash = (scene: Phaser.Scene, ninja: NinjaBody): void => {
  const graphics = scene.add.graphics().setDepth(21);
  const aim = Math.atan2(ninja.aim.y, ninja.aim.x);
  const radius = NINJA_TORNADO.radius * 0.55;
  const anim = { t: 0 };
  graphics.setPosition(ninja.x, ninja.y);
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 120,
    ease: 'Cubic.Out',
    onUpdate: () => {
      graphics.clear();
      const start = aim - 0.95;
      const end = start + 1.9 * anim.t;
      graphics.lineStyle(10, COLORS.paper, 0.55 * (1 - anim.t * 0.3));
      graphics.beginPath();
      graphics.arc(0, 0, radius, start, end);
      graphics.strokePath();
      graphics.lineStyle(3, COLORS.yellow, 0.95);
      graphics.beginPath();
      graphics.arc(0, 0, radius - 4, start, end);
      graphics.strokePath();
    },
    onComplete: () => graphics.destroy(),
  });
};
