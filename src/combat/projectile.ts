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
  private alive = true;
  private readonly endsAt: number;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private readonly vx: number,
    private readonly vy: number,
    private readonly radius: number,
    lifetimeMs: number,
    color: number,
  ) {
    this.endsAt = scene.time.now + lifetimeMs;
    this.view = scene.add.container(x, y).setDepth(15);
    this.body = scene.add.circle(0, 0, radius, color, 0.9);
    this.body.setStrokeStyle(2, 0xdff4ff, 1);
    this.view.add(this.body);
  }

  update(now: number, dt: number, enemies: NinjaBody[]): ProjectileHit | 'dead' | null {
    if (!this.alive) {
      return 'dead';
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.view.setPosition(this.x, this.y);
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
}
