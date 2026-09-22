import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { NinjaBody } from '../heroes/NinjaBody';
import { battlefieldOf } from '../map';
import type { TeamId } from '../config/hero';
import { registerProjectile, unregisterProjectile } from './projectileRegistry';

let nextShotToken = 1;

export type ProjectileHit = {
  target: NinjaBody;
  x: number;
  y: number;
};

/**
 * Simple traveling circle. Heroes supply visuals and on-hit behavior.
 * Dies at arena bounds or lifetime — no extra short range cap.
 */
export class Projectile {
  readonly view: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Arc;
  private readonly sparks: Phaser.GameObjects.Graphics;
  private alive = true;
  private readonly endsAt: number;
  private flicker = 0;
  private readonly style: 'spark' | 'slug' | 'arrow' | 'rope' | 'skull' | 'flame';
  private readonly originX: number;
  private readonly originY: number;
  private readonly maxRange: number;
  team?: TeamId;
  /** Ability shots pass their own damage. 0 uses the owner's light-attack damage. */
  worldDamage = 0;
  private readonly token = nextShotToken++;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private readonly vx: number,
    private readonly vy: number,
    private readonly radius: number,
    lifetimeMs: number,
    color: number,
    style: 'spark' | 'slug' | 'arrow' | 'rope' | 'skull' | 'flame' = 'spark',
    maxRange = Number.POSITIVE_INFINITY,
    rangeFrom?: { x: number; y: number },
    team?: TeamId,
    private readonly hitLift = 0,
  ) {
    this.style = style;
    this.originX = rangeFrom?.x ?? x;
    this.originY = rangeFrom?.y ?? y;
    this.maxRange = maxRange;
    this.team = team;
    this.endsAt = scene.time.now + lifetimeMs;
    this.view = scene.add.container(x, y).setDepth(15);
    if (style === 'arrow') {
      this.body = scene.add.circle(0, 0, radius + 0.6, color, 1);
      this.body.setStrokeStyle(1.4, 0x2a1c10, 1);
      const shaft = scene.add.rectangle(0, 0, radius * 6, 2.4, 0xd4a050, 1);
      shaft.setStrokeStyle(1, 0x3a2410, 0.9);
      shaft.setRotation(Math.atan2(vy, vx));
      this.view.add(shaft);
    } else if (style === 'rope') {
      this.body = scene.add.circle(0, 0, 2.2, 0xc4894a, 1);
      this.body.setStrokeStyle(1.2, 0x5a3014, 1);
    } else if (style === 'skull') {
      this.body = scene.add.circle(0, 0, radius, 0xf0ead8, 1);
      this.body.setStrokeStyle(1.4, 0x3a2430, 1);
    } else {
      this.body = scene.add.circle(0, 0, radius, color, style === 'slug' ? 0.95 : 0.88);
      this.body.setStrokeStyle(2, style === 'slug' ? 0x2a2010 : 0xdff4ff, 1);
    }
    this.sparks = scene.add.graphics();
    this.view.add(this.body);
    this.view.add(this.sparks);
    registerProjectile(this);
  }

  pose(): { x: number; y: number; vx: number; vy: number; radius: number; team?: TeamId } {
    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy, radius: this.radius, team: this.team };
  }

  update(now: number, dt: number, enemies: NinjaBody[]): ProjectileHit | 'dead' | null {
    if (!this.alive) {
      return 'dead';
    }
    const prevX = this.x;
    const prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.view.setPosition(this.x, this.y);
    this.flicker += 1;
    if (this.style === 'spark') {
      this.drawSparks();
    } else if (this.style === 'rope') {
      this.drawRope();
    } else if (this.style === 'skull') {
      this.drawSkull();
    } else if (this.style === 'flame') {
      this.drawFlame();
    }
    const traveled = Math.hypot(this.x - this.originX, this.y - this.originY);
    const map = battlefieldOf(this.view.scene);
    const hitProp = map?.environment.absorbShot({
      x0: prevX,
      y0: prevY,
      x1: this.x,
      y1: this.y,
      radius: this.radius,
      team: this.team,
      damage: this.worldDamage,
      token: this.token,
    });
    if (
      now >= this.endsAt ||
      traveled >= this.maxRange ||
      this.x < 0 ||
      this.y < 0 ||
      this.x > ARENA.width ||
      this.y > ARENA.height ||
      hitProp ||
      map?.query.blocksProjectile(this.x, this.y, this.radius)
    ) {
      this.destroy();
      return 'dead';
    }
    for (const enemy of enemies) {
      if (enemy.down) {
        continue;
      }
      if (Math.hypot(enemy.x - this.x, enemy.y - this.hitLift - this.y) <= this.radius + enemy.stats.bodyRadius) {
        const hit = { target: enemy, x: this.x, y: this.y };
        this.destroy();
        return hit;
      }
    }
    return null;
  }

  destroy(): void {
    if (!this.alive) {
      return;
    }
    this.alive = false;
    unregisterProjectile(this);
    this.view.destroy();
  }

  private drawSkull(): void {
    const g = this.sparks;
    g.clear();
    g.fillStyle(0x9b4dff, 0.28);
    g.fillCircle(0, 0, this.radius + 3);
    g.fillStyle(0xf0ead8, 1);
    g.fillCircle(0, 0, this.radius);
    g.fillStyle(0x1a1014, 1);
    g.fillCircle(-1.6, -0.6, 1.2);
    g.fillCircle(1.6, -0.6, 1.2);
    g.fillRect(-1.1, 1.4, 2.2, 1.1);
    g.fillStyle(0x9b4dff, 0.9);
    g.fillCircle(-1.6, -0.6, 0.55);
    g.fillCircle(1.6, -0.6, 0.55);
  }

  private drawRope(): void {
    const ang = Math.atan2(this.vy, this.vx);
    const tx = Math.cos(ang);
    const ty = Math.sin(ang);
    const len = 20;
    const g = this.sparks;
    g.clear();
    g.lineStyle(4, 0x5a3014, 1);
    g.lineBetween(-tx * len, -ty * len, tx * 6, ty * 6);
    g.lineStyle(2.2, 0xc4894a, 1);
    g.lineBetween(-tx * (len - 1), -ty * (len - 1), tx * 4, ty * 4);
    g.fillStyle(0x8a5228, 1);
    g.fillCircle(0, 0, 2.4);
    g.fillStyle(0xd4a06a, 0.9);
    g.fillCircle(tx * 2, ty * 2, 1.4);
  }

  private drawFlame(): void {
    const g = this.sparks;
    g.clear();
    const t = this.flicker;
    g.fillStyle(0xff3a10, 0.35);
    g.fillCircle(0, 0, this.radius + 3.4);
    g.fillStyle(0xff7a20, 0.95);
    g.fillCircle(0, 0, this.radius + 0.6);
    g.fillStyle(0xfff080, 0.95);
    g.fillCircle(-0.6, -0.8, this.radius * 0.55);
    for (let i = 0; i < 3; i += 1) {
      const ang = (t * 0.5 + i * 2.1) % (Math.PI * 2);
      g.fillStyle(i % 2 === 0 ? 0xffc030 : 0xff6a18, 0.8);
      g.fillEllipse(Math.cos(ang) * 3.2, Math.sin(ang) * 3.2, 3.4, 5.2);
    }
  }

  private drawSparks(): void {
    this.sparks.clear();
    const t = this.flicker;
    for (let i = 0; i < 4; i += 1) {
      const ang = (t * 0.45 + i * 1.7) % (Math.PI * 2);
      const inner = this.radius * 0.35;
      const outer = this.radius + 4 + ((t + i * 3) % 5);
      this.sparks.lineStyle(i % 2 === 0 ? 2 : 1.2, i % 2 === 0 ? 0xdff4ff : 0x7ecbff, 0.9);
      this.sparks.lineBetween(
        Math.cos(ang) * inner,
        Math.sin(ang) * inner,
        Math.cos(ang) * outer,
        Math.sin(ang) * outer,
      );
    }
  }
}
