import Phaser from 'phaser';
import { INPUT } from '../config/input';
import { COLORS, FONTS, hex } from '../ui/theme';

export type VirtualAimPadOptions = {
  label: string;
  accent: number;
  radius?: number;
  deadzone?: number;
  onPress?: () => void;
  onRelease?: (aim: Phaser.Math.Vector2) => void;
};

/**
 * Button-sized directional pad. Press-and-hold to keep the action on, drag
 * around the control to aim. Built so any hero can reuse it for a directional
 * ability without turning the whole screen into a joystick.
 */
export class VirtualAimPad {
  private readonly scene: Phaser.Scene;
  private readonly accent: number;
  private readonly deadzone: number;
  private readonly onPress?: () => void;
  private readonly onRelease?: (aim: Phaser.Math.Vector2) => void;
  private readonly pixel = new Phaser.Math.Vector2();
  private readonly vector = new Phaser.Math.Vector2();
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private x: number;
  private y: number;
  private radius: number;
  private pointerId?: number;
  private recovered = 1;
  private held = false;
  private dimmed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: VirtualAimPadOptions) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.accent = options.accent;
    this.radius = options.radius ?? 30;
    this.deadzone = options.deadzone ?? INPUT.aimPadDeadzone;
    this.onPress = options.onPress;
    this.onRelease = options.onRelease;

    this.art = scene.add.graphics().setScrollFactor(0).setDepth(114);
    this.fill = scene.add.graphics().setScrollFactor(0).setDepth(115);
    this.drawArt();

    this.knob = scene.add
      .circle(x, y, this.radius * 0.32, COLORS.ink, 0.88)
      .setStrokeStyle(2, options.accent, 0.95)
      .setScrollFactor(0)
      .setDepth(116)
      .setVisible(false);

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
      .setDepth(117);

    this.zone = scene.add
      .zone(x, y, this.radius * 2, this.radius * 2)
      .setInteractive(
        new Phaser.Geom.Circle(this.radius, this.radius, this.radius),
        Phaser.Geom.Circle.Contains,
      )
      .setScrollFactor(0)
      .setDepth(118);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
  }

  get active(): boolean {
    return this.pointerId !== undefined;
  }

  getValue(): Phaser.Math.Vector2 {
    return this.vector.clone();
  }

  aiming(): boolean {
    return this.active && this.vector.length() >= this.deadzone;
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.label.setFontSize(Math.max(9, Math.round(12 * (radius / 30))));
    this.knob.setRadius(radius * 0.32);
    this.zone.setSize(radius * 2, radius * 2);
    this.zone.setInteractive(
      new Phaser.Geom.Circle(radius, radius, radius),
      Phaser.Geom.Circle.Contains,
    );
    this.drawArt();
    this.redrawFill();
    this.syncKnob();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.drawArt();
    this.redrawFill();
    this.label.setPosition(x, y);
    this.zone.setPosition(x, y);
    this.syncKnob();
  }

  setHeldVisual(held: boolean): void {
    if (this.held === held) {
      return;
    }
    this.held = held;
    this.drawArt();
  }

  setRecovered(ratio: number): void {
    this.recovered = Phaser.Math.Clamp(ratio, 0, 1);
    this.redrawFill();
  }

  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    this.label.setAlpha(dimmed ? 0.4 : 1);
    this.knob.setAlpha(dimmed ? 0.4 : 1);
  }

  destroy(): void {
    this.stopListening();
    this.zone.off(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    this.art.destroy();
    this.fill.destroy();
    this.knob.destroy();
    this.label.destroy();
    this.zone.destroy();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.dimmed || this.pointerId !== undefined) {
      return;
    }
    this.pointerId = pointer.id;
    this.knob.setVisible(true);
    this.label.setAlpha(0.35);
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.updateVector(pointer);
    this.onPress?.();
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) {
      return;
    }
    this.updateVector(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) {
      return;
    }
    const released = this.vector.clone();
    this.pointerId = undefined;
    this.pixel.set(0, 0);
    this.vector.set(0, 0);
    this.knob.setVisible(false);
    this.knob.setPosition(this.x, this.y);
    this.label.setAlpha(this.dimmed ? 0.4 : 1);
    this.stopListening();
    this.onRelease?.(released);
  }

  private stopListening(): void {
    this.scene.input?.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  private updateVector(pointer: Phaser.Input.Pointer): void {
    this.pixel.set(pointer.x - this.x, pointer.y - this.y);
    if (this.pixel.length() > this.radius) {
      this.pixel.setLength(this.radius);
    }
    this.vector.set(this.pixel.x / this.radius, this.pixel.y / this.radius);
    this.syncKnob();
  }

  private syncKnob(): void {
    this.knob.setPosition(this.x + this.pixel.x, this.y + this.pixel.y);
  }

  private drawArt(): void {
    const r = this.radius;
    this.art.clear();
    this.art.fillStyle(COLORS.ink, 0.75);
    this.art.fillCircle(this.x + 4, this.y + 5, r + 2);
    this.art.fillStyle(this.held ? this.accent : COLORS.panel, this.held ? 0.35 : 0.96);
    this.art.fillCircle(this.x, this.y, r);
    this.art.lineStyle(3, this.accent);
    this.art.strokeCircle(this.x, this.y, r);
    this.art.lineStyle(1, COLORS.paper, this.held ? 0.35 : 0.16);
    this.art.lineBetween(this.x - r + 8, this.y, this.x + r - 8, this.y);
    this.art.lineBetween(this.x, this.y - r + 8, this.x, this.y + r - 8);
  }

  private redrawFill(): void {
    this.fill.clear();
    if (this.recovered >= 0.999) {
      return;
    }
    const remaining = 1 - this.recovered;
    this.fill.fillStyle(COLORS.ink, 0.62);
    this.fill.beginPath();
    this.fill.moveTo(this.x, this.y);
    this.fill.arc(
      this.x,
      this.y,
      this.radius - 2,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * remaining,
      false,
    );
    this.fill.closePath();
    this.fill.fillPath();
  }
}
