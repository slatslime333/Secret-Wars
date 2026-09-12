import Phaser from 'phaser';
import { COMBAT } from '../../../config/combat';
import { COLORS } from '../../../ui/theme';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { AbilityContext, AbilityDef, ActiveAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { NINJA_SMOKE } from './tunables';

export const smokeBombDef: AbilityDef = {
  id: 'ninja-smoke-bomb',
  name: 'Smoke Bomb',
  slot: 'ability1',
  cooldownMs: NINJA_SMOKE.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.smokeBomb,
  accent: 0x6b7c8a,
  canActivate: (ctx) => !ctx.caster.status.isBlockStunned(ctx.now) && !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => new SmokeBombAbility(ctx),
};

class SmokeBombAbility implements ActiveAbility {
  readonly id = smokeBombDef.id;
  readonly control = { move: true, attack: true, dash: true, block: true, abilities: true };
  private readonly endsAt: number;
  private readonly blastUntil: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly fx: SmokeCloud;

  constructor(ctx: AbilityContext) {
    const { caster, now } = ctx;
    const aimLen = Math.hypot(caster.aim.x, caster.aim.y) || 1;
    this.dirX = -caster.aim.x / aimLen;
    this.dirY = -caster.aim.y / aimLen;
    this.blastUntil = now + NINJA_SMOKE.blastDurationMs;
    this.endsAt = now + NINJA_SMOKE.durationMs;

    ctx.world.spawnSmoke({
      x: caster.x,
      y: caster.y,
      radius: NINJA_SMOKE.radius,
      startedAt: now,
      expandMs: NINJA_SMOKE.expandMs,
      endsAt: now + NINJA_SMOKE.durationMs,
      owner: caster,
      modifiers: {
        moveMul: NINJA_SMOKE.moveMul,
        attackSpeedMul: NINJA_SMOKE.attackSpeedMul,
        staminaDrainMul: NINJA_SMOKE.staminaDrainMul,
      },
    });

    this.fx = new SmokeCloud(ctx.scene, caster.x, caster.y, now);
    const speed = NINJA_SMOKE.blastDistance / (NINJA_SMOKE.blastDurationMs / 1000);
    caster.setSpeedCap(speed);
    caster.body?.setDrag(0, 0);
    caster.body?.setVelocity(this.dirX * speed, this.dirY * speed);
    caster.status.applyControlLock(now, NINJA_SMOKE.blastDurationMs);
    caster.grantInvulnerable(now + 90);
    caster.playEvasiveLean(this.dirX, this.dirY, NINJA_SMOKE.blastDurationMs);
    spawnCombatCallout(ctx.scene, caster.x, caster.y, 'SMOKE', 0x9aa8b5);
  }

  update(ctx: AbilityContext): boolean {
    const { caster, now } = ctx;
    this.fx.redraw(now);
    if (now < this.blastUntil) {
      const speed = NINJA_SMOKE.blastDistance / (NINJA_SMOKE.blastDurationMs / 1000);
      caster.body?.setDrag(0, 0);
      caster.body?.setVelocity(this.dirX * speed, this.dirY * speed);
      return true;
    }
    this.control.move = false;
    this.control.attack = false;
    this.control.dash = false;
    this.control.block = false;
    this.control.abilities = false;
    caster.setSpeedCap(COMBAT.physicsMaxSpeed);
    return now < this.endsAt;
  }

  destroy(): void {
    this.fx.destroy();
  }
}

/** Expanding ink-and-paper smoke — animated, not a static disc. */
class SmokeCloud {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly wisps: Phaser.GameObjects.Graphics;
  private readonly puffs: { a: number; r: number; ox: number; oy: number; spin: number }[];

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly startedAt: number,
  ) {
    this.ground = scene.add.graphics().setDepth(6);
    this.wisps = scene.add.graphics().setDepth(12);
    this.puffs = Array.from({ length: 7 }, (_, i) => ({
      a: (i / 7) * Math.PI * 2,
      r: 0.35 + (i % 3) * 0.18,
      ox: Math.cos(i * 1.7) * 4,
      oy: Math.sin(i * 2.1) * 4,
      spin: (i % 2 === 0 ? 1 : -1) * (0.9 + i * 0.08),
    }));
    this.burst(scene);
  }

  private burst(scene: Phaser.Scene): void {
    const ring = scene.add.graphics().setDepth(13);
    ring.setPosition(this.x, this.y);
    const anim = { t: 0 };
    scene.tweens.add({
      targets: anim,
      t: 1,
      duration: 220,
      ease: 'Cubic.Out',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(8 - anim.t * 5, COLORS.paper, 0.85 * (1 - anim.t));
        ring.strokeCircle(0, 0, 8 + anim.t * NINJA_SMOKE.radius * 1.15);
        ring.lineStyle(3, 0x6b7c8a, 0.7 * (1 - anim.t));
        ring.strokeCircle(0, 0, 4 + anim.t * NINJA_SMOKE.radius);
      },
      onComplete: () => ring.destroy(),
    });
  }

  redraw(now: number): void {
    const age = now - this.startedAt;
    const life = Math.min(1, age / NINJA_SMOKE.durationMs);
    const expand = Math.min(1, age / NINJA_SMOKE.expandMs);
    const eased = 1 - (1 - expand) * (1 - expand);
    const fade = age > NINJA_SMOKE.durationMs - 480 ? (NINJA_SMOKE.durationMs - age) / 480 : 1;
    const radius = NINJA_SMOKE.radius * eased;
    const swirl = age / 180;

    this.ground.clear();
    this.ground.fillStyle(COLORS.ink, 0.28 * fade);
    this.ground.fillCircle(this.x, this.y, radius * 1.05);
    this.ground.fillStyle(0x1b2430, 0.34 * fade);
    this.ground.fillCircle(this.x + Math.cos(swirl) * 3, this.y + Math.sin(swirl) * 2, radius * 0.82);

    this.wisps.clear();
    for (const puff of this.puffs) {
      const ang = puff.a + swirl * puff.spin * 0.15;
      const dist = radius * puff.r * (0.7 + 0.3 * Math.sin(swirl + puff.a));
      const px = this.x + Math.cos(ang) * dist + puff.ox;
      const py = this.y + Math.sin(ang) * dist + puff.oy - life * 6;
      const pr = 7 + radius * 0.22 * (0.7 + 0.3 * Math.cos(swirl * 1.4 + puff.a));
      this.wisps.fillStyle(0x2c3644, 0.42 * fade);
      this.wisps.fillEllipse(px, py, pr * 1.35, pr);
      this.wisps.fillStyle(COLORS.paper, 0.1 * fade);
      this.wisps.fillEllipse(px - 3, py - 3, pr * 0.45, pr * 0.32);
    }
  }

  destroy(): void {
    this.ground.destroy();
    this.wisps.destroy();
  }
}
