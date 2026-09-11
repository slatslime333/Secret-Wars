import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

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
  private readonly originX: number;
  private readonly originY: number;
  private readonly radius: number;
  private readonly vector = new Phaser.Math.Vector2();
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly zone: Phaser.GameObjects.Zone;
  private pointerId?: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: VirtualThumbstickOptions) {
    this.scene = scene;
    this.originX = x;
    this.originY = y;
    this.radius = options.radius;

    const base = scene.add.graphics().setScrollFactor(0).setDepth(110);
    base.fillStyle(COLORS.ink, 0.62);
    base.fillCircle(x, y, this.radius + 10);
    base.lineStyle(3, options.accent, 0.75);
    base.strokeCircle(x, y, this.radius + 3);
    base.lineStyle(1, COLORS.paper, 0.22);
    base.strokeCircle(x, y, this.radius - 16);
    base.lineBetween(x - this.radius + 14, y, x + this.radius - 14, y);
    base.lineBetween(x, y - this.radius + 14, x, y + this.radius - 14);

    this.knob = scene.add
      .circle(x, y, this.radius * 0.4, COLORS.ink, 0.82)
      .setStrokeStyle(3, options.accent, 0.95)
      .setScrollFactor(0)
      .setDepth(112);

    scene.add
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

    const hit = this.radius * 2.4;
    this.zone = scene.add
      .zone(x, y, hit, hit)
      .setInteractive(new Phaser.Geom.Circle(hit / 2, hit / 2, this.radius * 1.15), Phaser.Geom.Circle.Contains)
      .setScrollFactor(0)
      .setDepth(113);

    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
  }

  get active(): boolean {
    return this.pointerId !== undefined;
  }

  getValue(): Phaser.Math.Vector2 {
    return this.vector.clone();
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
    this.vector.set(pointer.x - this.originX, pointer.y - this.originY);
    if (this.vector.length() > this.radius) {
      this.vector.setLength(this.radius);
    }
    this.knob.setPosition(this.originX + this.vector.x, this.originY + this.vector.y);
    this.vector.scale(1 / this.radius);
  }

  destroy(): void {
    this.stopListening();
  }
}
