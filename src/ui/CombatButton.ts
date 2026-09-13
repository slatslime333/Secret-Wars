import Phaser from 'phaser';
import { audio } from '../audio';
import { COLORS, FONTS, hex } from './theme';

type CombatButtonOptions = {
  label: string;
  accent: number;
  onPress: () => void;
  onRelease?: () => void;
  holdable?: boolean;
};

/**
 * Thumb-sized battle button with a recovering cooldown fill and optional charges.
 * Viewport-fixed.
 */
export class CombatButton {
  private x: number;
  private y: number;
  private radius = 30;
  private readonly accent: number;
  private readonly holdable: boolean;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly scene: Phaser.Scene;
  private charges = 0;
  private maxCharges = 0;
  private recovered = 1;
  private held = false;
  private dimmed = false;
  private readonly onRelease?: () => void;
  private pointerId?: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: CombatButtonOptions) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.accent = options.accent;
    this.holdable = Boolean(options.holdable);
    this.onRelease = options.onRelease;

    this.art = scene.add.graphics().setScrollFactor(0).setDepth(114);
    this.fill = scene.add.graphics().setScrollFactor(0).setDepth(115);
    this.pips = scene.add.graphics().setScrollFactor(0).setDepth(116);
    this.drawArt();

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
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.dimmed) {
        return;
      }
      this.pointerId = pointer.id;
      audio.unlock();
      audio.play('ui-click');
      options.onPress();
      if (this.holdable) {
        scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
        scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
      }
    });
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) {
      return;
    }
    this.pointerId = undefined;
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.onRelease?.();
  }

  private drawArt(): void {
    const r = this.radius;
    this.art.clear();
    this.art.fillStyle(COLORS.ink, 0.45);
    this.art.fillCircle(this.x + 4, this.y + 5, r + 2);
    this.art.fillStyle(this.held ? this.accent : COLORS.panel, this.held ? 0.28 : 0.58);
    this.art.fillCircle(this.x, this.y, r);
    this.art.lineStyle(3, this.accent);
    this.art.strokeCircle(this.x, this.y, r);
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.label.setFontSize(Math.max(9, Math.round(12 * (radius / 30))));
    this.zone.setSize(radius * 2, radius * 2);
    this.zone.setInteractive(
      new Phaser.Geom.Circle(radius, radius, radius),
      Phaser.Geom.Circle.Contains,
    );
    this.drawArt();
    this.redrawFill();
    this.redrawPips();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.drawArt();
    this.redrawFill();
    this.redrawPips();
    this.label.setPosition(x, y);
    this.zone.setPosition(x, y);
  }

  setCharges(current: number, max: number): void {
    this.charges = current;
    this.maxCharges = max;
    this.dimmed = max > 0 && current <= 0;
    this.redrawPips();
    this.label.setAlpha(this.dimmed ? 0.4 : 1);
  }

  /** 0 = empty / just used, 1 = fully recovered. */
  setRecovered(ratio: number): void {
    this.recovered = Phaser.Math.Clamp(ratio, 0, 1);
    this.redrawFill();
  }

  setHeldVisual(held: boolean): void {
    if (this.held === held) {
      return;
    }
    this.held = held;
    this.drawArt();
  }

  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    this.label.setAlpha(dimmed ? 0.4 : 1);
  }

  setVisible(visible: boolean): void {
    this.art.setVisible(visible);
    this.fill.setVisible(visible);
    this.pips.setVisible(visible);
    this.label.setVisible(visible);
    this.zone.setVisible(visible);
    if (visible) {
      this.zone.setInteractive(
        new Phaser.Geom.Circle(this.radius, this.radius, this.radius),
        Phaser.Geom.Circle.Contains,
      );
    } else {
      this.zone.disableInteractive();
    }
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

    this.fill.lineStyle(3, this.accent, 0.9);
    this.fill.beginPath();
    this.fill.arc(
      this.x,
      this.y,
      this.radius - 4,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * this.recovered,
      false,
    );
    this.fill.strokePath();
  }

  private redrawPips(): void {
    this.pips.clear();
    if (this.maxCharges <= 1) {
      return;
    }
    const spacing = Math.max(8, this.radius * 0.34);
    const startX = this.x - ((this.maxCharges - 1) * spacing) / 2;
    const y = this.y + this.radius + 8;
    for (let i = 0; i < this.maxCharges; i += 1) {
      const filled = i < this.charges;
      this.pips.fillStyle(filled ? this.accent : COLORS.ink, filled ? 0.95 : 0.7);
      this.pips.fillCircle(startX + i * spacing, y, 3.5);
      this.pips.lineStyle(1, COLORS.paper, 0.55);
      this.pips.strokeCircle(startX + i * spacing, y, 3.5);
    }
  }

  destroy(): void {
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input?.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
  }
}
