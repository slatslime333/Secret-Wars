import Phaser from 'phaser';
import { adoptHud, hudPointer } from '../ui/layout/hudCamera';
import { COLORS, TOUCH_CONTROL_ALPHA } from '../ui/theme';

type VirtualThumbstickOptions = {
  label: string;
  accent: number;
  radius: number;
};

/**
 * Viewport-fixed analog stick. Bind/unbind pointer move/up only while held
 * so scene shutdown cannot touch a destroyed input plugin.
 */
export class VirtualThumbstick {
  private readonly scene: Phaser.Scene;
  private originX: number;
  private originY: number;
  private radius: number;
  private readonly accent: number;
  private readonly vector = new Phaser.Math.Vector2();
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private pointerId?: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: VirtualThumbstickOptions) {
    this.scene = scene;
    this.originX = x;
    this.originY = y;
    this.radius = options.radius;
    this.accent = options.accent;

    this.base = scene.add.graphics().setScrollFactor(0).setDepth(110);
    this.drawBase();

    this.knob = scene.add
      .circle(x, y, this.radius * 0.4, COLORS.ink, 0.52 * TOUCH_CONTROL_ALPHA)
      .setStrokeStyle(3, options.accent, 0.95 * TOUCH_CONTROL_ALPHA)
      .setScrollFactor(0)
      .setDepth(112);

    this.label = scene.add
      .text(x, y + this.radius + 12, options.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f6f1de',
        letterSpacing: 2,
        stroke: '#070a12',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(112);

    const hit = this.radius * 2.6;
    this.zone = scene.add
      .zone(x, y, hit, hit)
      .setOrigin(0.5, 0.5)
      .setInteractive(new Phaser.Geom.Circle(hit / 2, hit / 2, this.radius * 1.35), Phaser.Geom.Circle.Contains)
      .setScrollFactor(0)
      .setDepth(113);

    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onSceneDown, this);
    adoptHud(scene, this.base, this.knob, this.label, this.zone);
  }

  private drawBase(): void {
    this.base.clear();
    this.base.fillStyle(COLORS.ink, 0.38 * TOUCH_CONTROL_ALPHA);
    this.base.fillCircle(this.originX, this.originY, this.radius + 10);
    this.base.lineStyle(3, this.accent, 0.75 * TOUCH_CONTROL_ALPHA);
    this.base.strokeCircle(this.originX, this.originY, this.radius + 3);
    this.base.lineStyle(1, COLORS.paper, 0.22 * TOUCH_CONTROL_ALPHA);
    this.base.strokeCircle(this.originX, this.originY, this.radius - 16);
    this.base.lineBetween(this.originX - this.radius + 14, this.originY, this.originX + this.radius - 14, this.originY);
    this.base.lineBetween(this.originX, this.originY - this.radius + 14, this.originX, this.originY + this.radius - 14);
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.knob.setRadius(radius * 0.4);
    this.label.setFontSize(Math.max(9, Math.round(11 * (radius / 68))));
    const hit = radius * 2.6;
    this.zone.setSize(hit, hit);
    this.zone.setInteractive(
      new Phaser.Geom.Circle(hit / 2, hit / 2, radius * 1.35),
      Phaser.Geom.Circle.Contains,
    );
    this.drawBase();
    this.label.setPosition(this.originX, this.originY + radius + 12);
  }

  setPosition(x: number, y: number): void {
    this.originX = x;
    this.originY = y;
    this.drawBase();
    if (!this.active) {
      this.knob.setPosition(x, y);
    }
    this.label.setPosition(x, y + this.radius + 12);
    this.zone.setPosition(x, y);
  }

  get active(): boolean {
    return this.pointerId !== undefined;
  }

  getValue(): Phaser.Math.Vector2 {
    return this.vector.clone();
  }

  private onSceneDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== undefined || !this.zone.visible || !this.zone.input) {
      return;
    }
    const point = hudPointer(this.scene, pointer);
    if (Math.hypot(point.x - this.originX, point.y - this.originY) <= this.radius * 1.35) {
      this.onDown(pointer);
    }
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== undefined) {
      return;
    }
    this.pointerId = pointer.id;
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.updateVector(pointer);
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
    this.pointerId = undefined;
    this.vector.set(0, 0);
    this.knob.setPosition(this.originX, this.originY);
    this.stopListening();
  }

  private stopListening(): void {
    this.scene.input?.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
  }

  private updateVector(pointer: Phaser.Input.Pointer): void {
    const point = hudPointer(this.scene, pointer);
    this.vector.set(point.x - this.originX, point.y - this.originY);
    if (this.vector.length() > this.radius) {
      this.vector.setLength(this.radius);
    }
    this.knob.setPosition(this.originX + this.vector.x, this.originY + this.vector.y);
    this.vector.scale(1 / this.radius);
  }

  destroy(): void {
    this.stopListening();
    this.scene.input?.off(Phaser.Input.Events.POINTER_DOWN, this.onSceneDown, this);
    this.base.destroy();
    this.knob.destroy();
    this.label.destroy();
    this.zone.destroy();
  }

  setLabel(text: string): void {
    this.label.setText(text);
  }

  setVisible(visible: boolean): void {
    this.base.setVisible(visible);
    this.knob.setVisible(visible);
    this.label.setVisible(visible);
    this.zone.setVisible(visible);
    if (visible) {
      const hit = this.radius * 2.6;
      this.zone.setInteractive(
        new Phaser.Geom.Circle(hit / 2, hit / 2, this.radius * 1.35),
        Phaser.Geom.Circle.Contains,
      );
    } else {
      this.pointerId = undefined;
      this.vector.set(0, 0);
      this.knob.setPosition(this.originX, this.originY);
      this.stopListening();
      this.zone.disableInteractive();
    }
  }
}
