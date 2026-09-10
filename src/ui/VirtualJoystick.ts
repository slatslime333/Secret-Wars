import Phaser from 'phaser';
import { COLORS } from './theme';

type VirtualJoystickOptions = {
  label: string;
  accent: number;
  radius?: number;
};

export class VirtualJoystick {
  readonly vector = new Phaser.Math.Vector2();
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;
  private readonly radius: number;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private pointerId?: number;
  private pressed = false;
  private released = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: VirtualJoystickOptions) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.radius = options.radius ?? 64;

    this.base = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.drawBase(options.accent);

    this.knob = scene.add
      .circle(x, y, this.radius * 0.42, COLORS.ink, 0.78)
      .setStrokeStyle(3, options.accent, 0.95)
      .setScrollFactor(0)
      .setDepth(102);

    scene.add
      .text(x, y + this.radius + 13, options.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#d9e2df',
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(102);

    const hitDiameter = this.radius * 2.35;
    this.zone = scene.add
      .zone(x, y, hitDiameter, hitDiameter)
      .setInteractive(
        new Phaser.Geom.Circle(hitDiameter / 2, hitDiameter / 2, this.radius * 1.18),
        Phaser.Geom.Circle.Contains,
      )
      .setScrollFactor(0)
      .setDepth(103);

    this.zone.on(
      Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,
      (pointer: Phaser.Input.Pointer) => this.handleDown(pointer),
    );
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handleMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handleUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get active(): boolean {
    return this.pointerId !== undefined;
  }

  consumePressed(): boolean {
    const value = this.pressed;
    this.pressed = false;
    return value;
  }

  consumeReleased(): boolean {
    const value = this.released;
    this.released = false;
    return value;
  }

  getValue(): Phaser.Math.Vector2 {
    return this.vector.lengthSq() < 0.015 ? new Phaser.Math.Vector2() : this.vector.clone();
  }

  private drawBase(accent: number): void {
    this.base.fillStyle(COLORS.ink, 0.58);
    this.base.fillCircle(this.x, this.y, this.radius + 10);
    this.base.lineStyle(3, accent, 0.68);
    this.base.strokeCircle(this.x, this.y, this.radius + 3);
    this.base.lineStyle(1, 0xf6f1de, 0.2);
    this.base.strokeCircle(this.x, this.y, this.radius - 17);
    this.base.lineBetween(this.x - this.radius + 13, this.y, this.x + this.radius - 13, this.y);
    this.base.lineBetween(this.x, this.y - this.radius + 13, this.x, this.y + this.radius - 13);
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    if (this.pointerId !== undefined) {
      return;
    }
    this.pointerId = pointer.id;
    this.pressed = true;
    this.updateVector(pointer);
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) {
      return;
    }
    this.updateVector(pointer);
  }

  private handleUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) {
      return;
    }
    this.pointerId = undefined;
    this.vector.set(0, 0);
    this.knob.setPosition(this.x, this.y);
    this.released = true;
  }

  private updateVector(pointer: Phaser.Input.Pointer): void {
    this.vector.set(pointer.x - this.x, pointer.y - this.y);
    if (this.vector.length() > this.radius) {
      this.vector.setLength(this.radius);
    }
    this.knob.setPosition(this.x + this.vector.x, this.y + this.vector.y);
    this.vector.scale(1 / this.radius);
  }

  private destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handleMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handleUp, this);
  }
}
