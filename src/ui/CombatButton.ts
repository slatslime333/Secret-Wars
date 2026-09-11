import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';

type CombatButtonOptions = {
  label: string;
  accent: number;
  onPress: () => void;
};

/**
 * Thumb-sized battle button with a cooldown pie.
 * Viewport-fixed; press is a tap, not a hold.
 */
export class CombatButton {
  private readonly x: number;
  private readonly y: number;
  private readonly pie: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private cooldownEndsAt = 0;
  private cooldownDuration = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, options: CombatButtonOptions) {
    this.x = x;
    this.y = y;

    const art = scene.add.graphics().setScrollFactor(0).setDepth(114);
    art.fillStyle(COLORS.ink, 0.75);
    art.fillCircle(x + 4, y + 5, 32);
    art.fillStyle(COLORS.panel, 0.96);
    art.fillCircle(x, y, 30);
    art.lineStyle(3, options.accent);
    art.strokeCircle(x, y, 30);

    this.pie = scene.add.graphics().setScrollFactor(0).setDepth(115);
    this.label = scene.add
      .text(x, y, options.label, {
        fontFamily: FONTS.display,
        fontSize: '12px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(116);

    const zone = scene.add
      .zone(x, y, 64, 64)
      .setInteractive(new Phaser.Geom.Circle(32, 32, 32), Phaser.Geom.Circle.Contains)
      .setScrollFactor(0)
      .setDepth(117);
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (scene.time.now < this.cooldownEndsAt) {
        return;
      }
      options.onPress();
    });
  }

  startCooldown(durationMs: number, now: number): void {
    this.cooldownDuration = durationMs;
    this.cooldownEndsAt = now + durationMs;
  }

  sync(now: number): void {
    this.pie.clear();
    if (now >= this.cooldownEndsAt) {
      this.label.setAlpha(1);
      return;
    }
    const ratio = (this.cooldownEndsAt - now) / this.cooldownDuration;
    this.pie.fillStyle(COLORS.ink, 0.72);
    this.pie.beginPath();
    this.pie.moveTo(this.x, this.y);
    this.pie.arc(this.x, this.y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
    this.pie.closePath();
    this.pie.fillPath();
    this.label.setAlpha(0.45);
  }
}
