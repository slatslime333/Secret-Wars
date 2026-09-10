import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';

type CombatButtonOptions = {
  label: string;
  accent: number;
  onPress: () => void;
};

export class CombatButton {
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;
  private readonly accent: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly cooldownGraphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly onPress: () => void;
  private cooldownEndsAt = 0;
  private cooldownDuration = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, options: CombatButtonOptions) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.accent = options.accent;
    this.onPress = options.onPress;

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(104);
    this.cooldownGraphics = scene.add.graphics().setScrollFactor(0).setDepth(105);
    this.label = scene.add
      .text(x, y, options.label, {
        fontFamily: FONTS.display,
        fontSize: '11px',
        color: hex(COLORS.paper),
        align: 'center',
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(106);

    const zone = scene.add
      .zone(x, y, 70, 70)
      .setInteractive(new Phaser.Geom.Circle(35, 35, 35), Phaser.Geom.Circle.Contains)
      .setScrollFactor(0)
      .setDepth(107);
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.press());
    this.draw();
  }

  startCooldown(duration: number): void {
    this.cooldownDuration = duration;
    this.cooldownEndsAt = this.scene.time.now + duration;
  }

  update(): void {
    this.drawCooldown();
  }

  private press(): void {
    if (this.scene.time.now < this.cooldownEndsAt) {
      return;
    }
    this.onPress();
  }

  private draw(): void {
    this.graphics.fillStyle(COLORS.ink, 0.72);
    this.graphics.fillCircle(this.x + 4, this.y + 5, 35);
    this.graphics.fillStyle(COLORS.panel, 0.96);
    this.graphics.fillCircle(this.x, this.y, 34);
    this.graphics.lineStyle(3, this.accent);
    this.graphics.strokeCircle(this.x, this.y, 34);
    this.graphics.fillStyle(this.accent, 0.35);
    this.graphics.fillTriangle(this.x - 23, this.y - 22, this.x, this.y - 34, this.x + 23, this.y - 22);
  }

  private drawCooldown(): void {
    this.cooldownGraphics.clear();
    const remaining = Math.max(0, this.cooldownEndsAt - this.scene.time.now);
    if (remaining <= 0) {
      this.label.setAlpha(1);
      return;
    }

    const ratio = remaining / this.cooldownDuration;
    this.cooldownGraphics.fillStyle(COLORS.ink, 0.72);
    this.cooldownGraphics.beginPath();
    this.cooldownGraphics.moveTo(this.x, this.y);
    this.cooldownGraphics.arc(
      this.x,
      this.y,
      31,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * ratio,
      false,
    );
    this.cooldownGraphics.closePath();
    this.cooldownGraphics.fillPath();
    this.label.setAlpha(0.48);
  }
}
