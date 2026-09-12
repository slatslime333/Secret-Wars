import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { NinjaBody } from '../heroes/NinjaBody';

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
  private readonly style: 'spark' | 'slug' | 'arrow';

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private readonly vx: number,
    private readonly vy: number,
    private readonly radius: number,
    lifetimeMs: number,
    color: number,
    style: 'spark' | 'slug' | 'arrow' = 'spark',
  ) {
    this.style = style;
    this.endsAt = scene.time.now + lifetimeMs;
    this.view = scene.add.container(x, y).setDepth(15);
    if (style === 'arrow') {
      this.body = scene.add.circle(0, 0, radius + 0.6, color, 1);
      this.body.setStrokeStyle(1.4, 0x2a1c10, 1);
      const shaft = scene.add.rectangle(0, 0, radius * 6, 2.4, 0xd4a050, 1);
      shaft.setStrokeStyle(1, 0x3a2410, 0.9);
      shaft.setRotation(Math.atan2(vy, vx));
      this.view.add(shaft);
    } else {
      this.body = scene.add.circle(0, 0, radius, color, style === 'slug' ? 0.95 : 0.88);
      this.body.setStrokeStyle(2, style === 'slug' ? 0x2a2010 : 0xdff4ff, 1);
    }
    this.sparks = scene.add.graphics();
    this.view.add(this.body);
    this.view.add(this.sparks);
  }

  update(now: number, dt: number, enemies: NinjaBody[]): ProjectileHit | 'dead' | null {
    if (!this.alive) {
      return 'dead';
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.view.setPosition(this.x, this.y);
    this.flicker += 1;
    if (this.style === 'spark') {
      this.drawSparks();
    }
    if (
      now >= this.endsAt ||
      this.x < 0 ||
      this.y < 0 ||
      this.x > ARENA.width ||
      this.y > ARENA.height
    ) {
      this.destroy();
      return 'dead';
    }
    for (const enemy of enemies) {
      if (enemy.down) {
        continue;
      }
      if (Math.hypot(enemy.x - this.x, enemy.y - this.y) <= this.radius + enemy.stats.bodyRadius) {
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
    this.view.destroy();
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
