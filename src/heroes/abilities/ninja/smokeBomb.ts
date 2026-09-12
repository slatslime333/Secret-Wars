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

    this.fx = new SmokeCloud(
      ctx.scene,
      caster.x,
      caster.y,
      now,
      now + NINJA_SMOKE.durationMs,
      NINJA_SMOKE.radius,
    );
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
    caster.setSpeedCap(COMBAT.physicsMaxSpeed);
    return false;
  }

  destroy(): void {
    /* Smoke cloud owns its own lifetime so the blast can end cleanly. */
  }
}

/** Expanding ink-and-paper smoke — animated, not a static disc. */
class SmokeCloud {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly wisps: Phaser.GameObjects.Graphics;
  private readonly puffs: { a: number; r: number; ox: number; oy: number; spin: number }[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly startedAt: number,
    endsAt: number,
    private readonly radius: number,
  ) {
    this.ground = scene.add.graphics().setDepth(6);
    this.wisps = scene.add.graphics().setDepth(12);
    this.puffs = Array.from({ length: 11 }, (_, i) => ({
      a: (i / 11) * Math.PI * 2,
      r: 0.25 + (i % 4) * 0.2,
      ox: Math.cos(i * 1.7) * 5,
      oy: Math.sin(i * 2.1) * 5,
      spin: (i % 2 === 0 ? 1 : -1) * (0.9 + i * 0.08),
    }));
    this.burst(scene);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onTick, this);
    scene.time.delayedCall(Math.max(0, endsAt - startedAt), () => this.destroy());
  }

  private onTick(): void {
    if (!this.ground.active) {
      return;
    }
    this.redraw(this.scene.time.now);
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
        ring.strokeCircle(0, 0, 8 + anim.t * this.radius);
        ring.lineStyle(3, 0x6b7c8a, 0.7 * (1 - anim.t));
        ring.strokeCircle(0, 0, 4 + anim.t * this.radius);
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
    const radius = this.radius * eased;
    const swirl = age / 180;

    this.ground.clear();
    this.ground.fillStyle(COLORS.ink, 0.46 * fade);
    this.ground.fillCircle(this.x, this.y, radius);
    this.ground.fillStyle(0x1b2430, 0.5 * fade);
    this.ground.fillCircle(this.x + Math.cos(swirl) * 3, this.y + Math.sin(swirl) * 2, radius * 0.82);
    this.ground.lineStyle(3, 0x8fa1ac, 0.55 * fade);
    this.ground.strokeCircle(this.x, this.y, radius);
    this.ground.lineStyle(1, COLORS.paper, 0.28 * fade);
    this.ground.strokeCircle(this.x, this.y, radius);

    this.wisps.clear();
    for (let rise = 0; rise < 3; rise += 1) {
      const colY = this.y - rise * (8 + life * 6);
      this.wisps.fillStyle(0x2c3644, (0.5 - rise * 0.12) * fade);
      this.wisps.fillEllipse(this.x + Math.sin(swirl + rise) * 3, colY, radius * (0.92 - rise * 0.12), 9 + rise * 2);
    }
    for (const puff of this.puffs) {
      const ang = puff.a + swirl * puff.spin * 0.15;
      const pr = Math.min(radius * 0.28, 8 + radius * 0.18 * (0.7 + 0.3 * Math.cos(swirl * 1.4 + puff.a)));
      const dist = Math.min(radius - pr, radius * puff.r * (0.7 + 0.3 * Math.sin(swirl + puff.a)));
      const px = this.x + Math.cos(ang) * dist;
      const py = this.y + Math.sin(ang) * dist - life * 10;
      this.wisps.fillStyle(0x2c3644, 0.55 * fade);
      this.wisps.fillEllipse(px, py, pr * 1.25, pr);
      this.wisps.fillStyle(COLORS.paper, 0.14 * fade);
      this.wisps.fillEllipse(px - 3, py - 4, pr * 0.45, pr * 0.32);
    }
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onTick, this);
    this.ground.destroy();
    this.wisps.destroy();
  }
}
