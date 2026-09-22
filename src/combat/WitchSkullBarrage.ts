import Phaser from 'phaser';
import { playWorld } from '../audio';
import { hitReactionFor, hitStopFor } from '../config/combat';
import { WITCH_SKULL } from '../heroes/abilities/witch/tunables';
import { NinjaBody } from '../heroes/NinjaBody';
import { resolveAbilityHit } from '../heroes/abilities/resolveAbilityHit';
import { BlockController } from './BlockController';
import { Projectile } from './projectile';

type HoverSkull = {
  view: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  spawned: boolean;
  fired: boolean;
};

/**
 * One four-skull light attack. Stamina is spent by QuickAttack before this starts.
 */
export class WitchSkullBarrage {
  private readonly hovers: HoverSkull[] = [];
  private readonly shots: Projectile[] = [];
  private finishedFiring = false;
  private dead = false;
  readonly startedAt: number;
  private readonly aimX: number;
  private readonly aimY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    caster: NinjaBody,
    now: number,
  ) {
    this.startedAt = now;
    const len = Math.hypot(caster.aim.x, caster.aim.y) || 1;
    this.aimX = caster.aim.x / len;
    this.aimY = caster.aim.y / len;
    caster.status.applyCommitSlow(now, WITCH_SKULL.sequenceMs, WITCH_SKULL.commitSlowMul);
    caster.playCustomAttack(now, WITCH_SKULL.sequenceMs, (frac) => ({
      staffRaise: frac < 0.72 ? Math.min(1, frac / 0.18) : Math.max(0.2, 1 - (frac - 0.72) * 2),
      armLiftRight: 0.35 + Math.sin(frac * Math.PI) * 0.2,
      armLiftLeft: 0.08,
      swayX: this.aimX * 3 * Math.sin(Math.min(1, frac * 1.4) * Math.PI),
    }));
    playWorld('witch-light', caster);
    for (let i = 0; i < WITCH_SKULL.count; i += 1) {
      const art = scene.add.graphics();
      const view = scene.add.container(caster.x, caster.y, [art]).setDepth(16).setVisible(false);
      this.hovers.push({ view, art, x: caster.x, y: caster.y, spawned: false, fired: false });
    }
  }

  get firingDone(): boolean {
    return this.finishedFiring || this.dead;
  }

  update(
    now: number,
    dt: number,
    caster: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): boolean {
    if (this.dead) {
      return false;
    }
    if (caster.down || !caster.isPresent) {
      this.destroy();
      return false;
    }
    this.tickSpawn(now, caster);
    this.tickFire(now, caster);
    this.tickShots(now, dt, caster, enemies, defenderBlock);
    if (this.finishedFiring && this.shots.length === 0) {
      this.destroyHovers();
      return false;
    }
    return true;
  }

  destroy(): void {
    this.dead = true;
    this.finishedFiring = true;
    this.destroyHovers();
    for (const shot of this.shots) {
      shot.destroy();
    }
    this.shots.length = 0;
  }

  private tickSpawn(now: number, caster: NinjaBody): void {
    const px = -this.aimY;
    const py = this.aimX;
    for (let i = 0; i < this.hovers.length; i += 1) {
      const hover = this.hovers[i];
      if (!hover.spawned && now >= this.startedAt + i * WITCH_SKULL.spawnGapMs) {
        hover.spawned = true;
        hover.view.setVisible(true);
        playWorld('witch-skull-spawn', caster);
      }
      if (!hover.spawned || hover.fired) {
        continue;
      }
      const slot = i - (WITCH_SKULL.count - 1) / 2;
      hover.x = caster.x + this.aimX * WITCH_SKULL.spawnForward + px * slot * WITCH_SKULL.wallSpread;
      hover.y = caster.y + this.aimY * WITCH_SKULL.spawnForward + py * slot * WITCH_SKULL.wallSpread;
      hover.view.setPosition(hover.x, hover.y);
      drawHoverSkull(hover.art, now + i * 40);
    }
  }

  private tickFire(now: number, caster: NinjaBody): void {
    if (this.finishedFiring) {
      return;
    }
    for (let i = 0; i < this.hovers.length; i += 1) {
      const hover = this.hovers[i];
      const fireAt = this.startedAt + WITCH_SKULL.fireDelayMs + i * WITCH_SKULL.fireGapMs;
      if (!hover.spawned || hover.fired || now < fireAt) {
        continue;
      }
      hover.fired = true;
      hover.view.setVisible(false);
      playWorld('witch-skull-fire', caster);
      const shot = new Projectile(
        this.scene,
        hover.x,
        hover.y,
        this.aimX * WITCH_SKULL.speed,
        this.aimY * WITCH_SKULL.speed,
        WITCH_SKULL.radius,
        WITCH_SKULL.lifetimeMs,
        0xf0ead8,
        'skull',
        caster.stats.attackRange,
        { x: caster.x, y: caster.y },
      );
      shot.team = caster.team;
      this.shots.push(shot);
    }
    if (this.hovers.every((hover) => hover.fired)) {
      this.finishedFiring = true;
      this.destroyHovers();
    }
  }

  private tickShots(
    now: number,
    dt: number,
    caster: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i];
      const result = shot.update(now, dt, enemies);
      if (!result) {
        continue;
      }
      this.shots.splice(i, 1);
      if (result === 'dead') {
        continue;
      }
      playWorld('witch-skull-impact', result.target);
      const kind = resolveAbilityHit(
        this.scene,
        now,
        caster,
        result.target,
        {
          rawDamage: Math.max(1, Math.round(caster.stats.attackDamage * WITCH_SKULL.damageMul)),
          knockback: caster.stats.knockbackPower * WITCH_SKULL.knockbackMul,
          staminaDamage: WITCH_SKULL.staminaDamage,
          dirX: this.aimX,
          dirY: this.aimY,
          step: 1,
          heavy: false,
          hitReactionMs: hitReactionFor(1, 'witch'),
          hitStopMs: hitStopFor(1, 'witch'),
          sourceKind: 'light',
        },
        defenderBlock,
      );
      if (kind === 'hit') {
        result.target.status.applySlow(now, WITCH_SKULL.hitSlowMs, WITCH_SKULL.hitSlowMul);
      }
    }
  }

  private destroyHovers(): void {
    for (const hover of this.hovers) {
      hover.view.destroy();
    }
    this.hovers.length = 0;
  }
}

const drawHoverSkull = (g: Phaser.GameObjects.Graphics, now: number): void => {
  g.clear();
  const pulse = 0.7 + Math.sin(now / 50) * 0.15;
  g.fillStyle(0x9b4dff, 0.35 * pulse);
  g.fillCircle(0, 0, 8);
  g.fillStyle(0xf0ead8, 1);
  g.fillCircle(0, 0, 5);
  g.fillStyle(0x1a1014, 1);
  g.fillCircle(-1.7, -0.6, 1.3);
  g.fillCircle(1.7, -0.6, 1.3);
  g.fillRect(-1.2, 1.5, 2.4, 1.2);
  g.fillStyle(0x9b4dff, 1);
  g.fillCircle(-1.7, -0.6, 0.55);
  g.fillCircle(1.7, -0.6, 0.55);
};
