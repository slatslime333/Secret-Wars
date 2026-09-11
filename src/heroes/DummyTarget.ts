import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { NINJA } from '../config/ninja';
import { COLORS, FONTS, hex } from '../ui/theme';

export class DummyTarget {
  readonly view: Phaser.GameObjects.Container;
  readonly body: Phaser.Physics.Arcade.Body;
  health = NINJA.maxHealth;
  private readonly art: Phaser.GameObjects.Graphics;
  private resetAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.view = scene.add.container(x, y);
    this.view.setSize(COMBAT.dummyRadius * 2, COMBAT.dummyRadius * 2);
    this.view.setDepth(8);
    this.art = scene.add.graphics();
    const label = scene.add
      .text(0, 28, 'DUMMY', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.view.add([this.art, label]);
    this.draw(false);

    scene.physics.add.existing(this.view);
    this.body = this.view.body as Phaser.Physics.Arcade.Body;
    this.body.setCircle(COMBAT.dummyRadius, 0, 0);
    this.body.setOffset(-COMBAT.dummyRadius, -COMBAT.dummyRadius);
    this.body.setCollideWorldBounds(true);
    this.body.setDrag(900, 900);
    this.body.setImmovable(false);
  }

  get x(): number {
    return this.view.x;
  }

  get y(): number {
    return this.view.y;
  }

  get down(): boolean {
    return this.health <= 0;
  }

  takeHit(damage: number, dirX: number, dirY: number): void {
    if (this.down) {
      return;
    }
    this.health = Math.max(0, this.health - damage);
    const length = Math.hypot(dirX, dirY) || 1;
    this.body.setVelocity(
      (dirX / length) * NINJA.knockbackPower,
      (dirY / length) * NINJA.knockbackPower,
    );
    this.draw(true);
    this.view.scene.time.delayedCall(COMBAT.hitStunMs, () => {
      if (!this.down) {
        this.draw(false);
      }
    });
    if (this.down) {
      this.resetAt = this.view.scene.time.now + COMBAT.dummyResetMs;
      this.draw(true);
    }
  }

  update(now: number): void {
    if (this.down && this.resetAt > 0 && now >= this.resetAt) {
      this.health = NINJA.maxHealth;
      this.resetAt = 0;
      this.draw(false);
    }
  }

  private draw(hit: boolean): void {
    const g = this.art;
    g.clear();
    g.fillStyle(COLORS.ink, 0.4);
    g.fillEllipse(0, 16, 24, 8);
    g.fillStyle(hit ? COLORS.paper : 0x3a2228);
    g.fillRect(-12, -18, 24, 34);
    g.fillStyle(this.down ? COLORS.muted : COLORS.red);
    g.fillRect(-14, -8, 28, 8);
    g.lineStyle(3, hit ? COLORS.orange : COLORS.redBright);
    g.strokeRect(-12, -18, 24, 34);
    g.fillStyle(COLORS.paper, 0.85);
    g.fillCircle(0, -8, 4);
  }
}
