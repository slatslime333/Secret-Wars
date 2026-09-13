import Phaser from 'phaser';
import { INPUT } from '../config/input';
import { AbilitySlotState } from '../heroes/abilities/types';
import { adoptHud, hudPointer } from '../ui/layout/hudCamera';
import { COLORS, FONTS, hex, TOUCH_CONTROL_ALPHA } from '../ui/theme';

export type VirtualAimPadOptions = {
  label: string;
  accent: number;
  radius?: number;
  deadzone?: number;
  iconKey?: string;
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
  private readonly icon?: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;
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

    if (options.iconKey) {
      this.icon = scene.add.image(x, y, options.iconKey).setScrollFactor(0).setDepth(116);
      this.fitIcon();
    }

    this.label = scene.add
      .text(x, y, options.iconKey ? '' : options.label, {
        fontFamily: FONTS.display,
        fontSize: '12px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(117)
      .setVisible(!options.iconKey);

    this.timer = scene.add
      .text(x, y + this.radius * 0.08, '', {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(117);

    this.zone = scene.add
      .zone(x, y, this.radius * 2.4, this.radius * 2.4)
      .setOrigin(0.5, 0.5)
      .setInteractive(
        new Phaser.Geom.Circle(this.radius * 1.2, this.radius * 1.2, this.radius * 1.2),
        Phaser.Geom.Circle.Contains,
      )
      .setScrollFactor(0)
      .setDepth(118);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onSceneDown, this);
    adoptHud(scene, this.art, this.fill, this.knob, this.label, this.timer, this.zone, ...(this.icon ? [this.icon] : []));
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
    this.timer.setFontSize(Math.max(14, Math.round(20 * (radius / 30))));
    this.timer.setPosition(this.x, this.y + radius * 0.08);
    this.knob.setRadius(radius * 0.32);
    this.zone.setSize(radius * 2.4, radius * 2.4);
    this.zone.setInteractive(
      new Phaser.Geom.Circle(radius * 1.2, radius * 1.2, radius * 1.2),
      Phaser.Geom.Circle.Contains,
    );
    this.drawArt();
    this.redrawFill();
    this.fitIcon();
    this.syncKnob();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.drawArt();
    this.redrawFill();
    this.label.setPosition(x, y);
    this.timer.setPosition(x, y + this.radius * 0.08);
    this.icon?.setPosition(x, y);
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

  sync(state: AbilitySlotState): void {
    this.icon?.setAlpha(state.consumed ? 0.28 : state.ready ? 1 : 0.45);
    this.icon?.setTint(state.consumed ? 0x667088 : 0xffffff);
    if (state.consumed) {
      this.timer.setText('');
    } else if (state.maxCharges > 1 && state.ready) {
      this.timer.setText(`${state.charges}`);
    } else if (!state.ready && state.cooldownRemainingMs > 0) {
      this.timer.setText(String(Math.max(1, Math.ceil(state.cooldownRemainingMs / 1000))));
    } else if (state.maxCharges > 1) {
      this.timer.setText(`${state.charges}`);
    } else {
      this.timer.setText('');
    }
  }

  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    this.label.setAlpha(dimmed ? 0.4 : 1);
    this.timer.setAlpha(dimmed ? 0.7 : 1);
    this.knob.setAlpha(dimmed ? 0.4 : 1);
    if (this.icon && this.icon.alpha > 0.32) {
      this.icon.setAlpha(dimmed ? 0.32 : 1);
    }
  }

  setVisible(visible: boolean): void {
    this.art.setVisible(visible);
    this.fill.setVisible(visible);
    this.icon?.setVisible(visible);
    this.label.setVisible(visible && !this.icon);
    this.timer.setVisible(visible);
    this.zone.setVisible(visible);
    if (!visible) {
      this.knob.setVisible(false);
      this.zone.disableInteractive();
      return;
    }
    this.zone.setInteractive(
      new Phaser.Geom.Circle(this.radius * 1.2, this.radius * 1.2, this.radius * 1.2),
      Phaser.Geom.Circle.Contains,
    );
  }

  destroy(): void {
    this.stopListening();
    this.scene.input?.off(Phaser.Input.Events.POINTER_DOWN, this.onSceneDown, this);
    this.zone.off(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    this.art.destroy();
    this.fill.destroy();
    this.knob.destroy();
    this.icon?.destroy();
    this.label.destroy();
    this.timer.destroy();
    this.zone.destroy();
  }

  private onSceneDown(pointer: Phaser.Input.Pointer): void {
    if (this.dimmed || this.pointerId !== undefined || !this.zone.visible || !this.zone.input) {
      return;
    }
    const point = hudPointer(this.scene, pointer);
    if (Math.hypot(point.x - this.x, point.y - this.y) <= this.radius * 1.2) {
      this.onDown(pointer);
    }
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.dimmed || this.pointerId !== undefined) {
      return;
    }
    this.pointerId = pointer.id;
    this.knob.setVisible(true);
    this.label.setAlpha(0.35);
    this.icon?.setAlpha(0.35);
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
    this.icon?.setAlpha(this.dimmed ? 0.32 : 1);
    this.stopListening();
    this.onRelease?.(released);
  }

  private stopListening(): void {
    this.scene.input?.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  private updateVector(pointer: Phaser.Input.Pointer): void {
    const point = hudPointer(this.scene, pointer);
    this.pixel.set(point.x - this.x, point.y - this.y);
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
    this.art.fillStyle(COLORS.ink, 0.45 * TOUCH_CONTROL_ALPHA);
    this.art.fillCircle(this.x + 4, this.y + 5, r + 2);
    this.art.fillStyle(this.held ? this.accent : COLORS.panel, (this.held ? 0.28 : 0.58) * TOUCH_CONTROL_ALPHA);
    this.art.fillCircle(this.x, this.y, r);
    this.art.lineStyle(3, this.accent, TOUCH_CONTROL_ALPHA);
    this.art.strokeCircle(this.x, this.y, r);
    if (!this.icon) {
      this.art.lineStyle(1, COLORS.paper, (this.held ? 0.35 : 0.16) * TOUCH_CONTROL_ALPHA);
      this.art.lineBetween(this.x - r + 8, this.y, this.x + r - 8, this.y);
      this.art.lineBetween(this.x, this.y - r + 8, this.x, this.y + r - 8);
    }
  }

  private redrawFill(): void {
    this.fill.clear();
    if (this.recovered >= 0.999) {
      return;
    }
    const remaining = 1 - this.recovered;
    this.fill.fillStyle(COLORS.ink, 0.62 * TOUCH_CONTROL_ALPHA);
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

  private fitIcon(): void {
    this.icon?.setDisplaySize(this.radius * 1.55, this.radius * 1.55);
  }
}
