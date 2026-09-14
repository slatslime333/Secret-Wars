import Phaser from 'phaser';
import { audio } from '../audio';
import { AbilitySlotState } from '../heroes/abilities/types';
import { adoptHud, hudPointer } from './layout/hudCamera';
import { COLORS, FONTS, hex, TOUCH_CONTROL_ALPHA } from './theme';

type AbilityButtonOptions = {
  onPress: () => void;
  ultimate?: boolean;
};

/**
 * Thumb-sized ability control with the custom icon, cooldown wedge, and
 * a clear consumed state for the once-per-match ultimate.
 */
export class AbilityButton {
  private x: number;
  private y: number;
  private radius: number;
  private readonly ultimate: boolean;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly scene: Phaser.Scene;
  private ready = true;
  private consumed = false;
  private pressed = false;
  private lastPressAt = -999;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    iconKey: string,
    options: AbilityButtonOptions,
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.ultimate = Boolean(options.ultimate);

    this.art = scene.add.graphics().setScrollFactor(0).setDepth(114);
    this.icon = scene.add.image(x, y, iconKey).setScrollFactor(0).setDepth(115);
    this.overlay = scene.add.graphics().setScrollFactor(0).setDepth(116);
    this.timer = scene.add
      .text(x, y + radius * 0.08, '', {
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
      .zone(x, y, radius * 2.4, radius * 2.4)
      .setOrigin(0.5, 0.5)
      .setInteractive(new Phaser.Geom.Circle(radius * 1.2, radius * 1.2, radius * 1.2), Phaser.Geom.Circle.Contains)
      .setScrollFactor(0)
      .setDepth(118);
    this.firePress = options.onPress;
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onSceneDown, this);
    this.drawArt();
    this.fitIcon();
    adoptHud(scene, this.art, this.overlay, this.icon, this.timer, this.zone);
  }

  private firePress: () => void;

  private onSceneDown(pointer: Phaser.Input.Pointer): void {
    if (!this.zone.visible || !this.zone.input) {
      return;
    }
    const point = hudPointer(this.scene, pointer);
    if (Math.hypot(point.x - this.x, point.y - this.y) <= this.radius * 1.2) {
      this.onDown();
    }
  }

  private onDown(): void {
    if (this.scene.time.now - this.lastPressAt < 80) {
      return;
    }
    this.lastPressAt = this.scene.time.now;
    this.flashPress();
    audio.unlock();
    audio.play('ui-click');
    this.firePress();
  }

  setRadius(radius: number): void {
    this.radius = radius;
    this.zone.setSize(radius * 2.4, radius * 2.4);
    this.zone.setInteractive(new Phaser.Geom.Circle(radius * 1.2, radius * 1.2, radius * 1.2), Phaser.Geom.Circle.Contains);
    this.timer.setFontSize(Math.max(14, Math.round(20 * (radius / 30))));
    this.drawArt();
    this.fitIcon();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.icon.setPosition(x, y);
    this.timer.setPosition(x, y + this.radius * 0.08);
    this.zone.setPosition(x, y);
    this.drawArt();
  }

  setIcon(iconKey: string): void {
    this.icon.setTexture(iconKey);
    this.fitIcon();
  }

  sync(state: AbilitySlotState): void {
    this.ready = state.ready;
    this.consumed = state.consumed;
    this.icon.setAlpha(state.consumed ? 0.28 : state.ready ? 1 : 0.45);
    this.icon.setTint(state.consumed ? 0x667088 : 0xffffff);
    if (state.consumed) {
      this.timer.setText('');
    } else if (state.def.chargeMode === 'meter' && state.meter < 1) {
      this.timer.setText(`${Math.round(state.meter * 100)}`);
    } else if (state.maxCharges > 1 && state.ready) {
      this.timer.setText(`${state.charges}`);
    } else if (!state.ready && state.cooldownRemainingMs > 0) {
      this.timer.setText(String(Math.max(1, Math.ceil(state.cooldownRemainingMs / 1000))));
    } else if (state.maxCharges > 1) {
      this.timer.setText(`${state.charges}`);
    } else {
      this.timer.setText('');
    }
    this.drawArt();
    this.drawOverlay(state);
  }

  setDimmed(dimmed: boolean): void {
    if (dimmed) {
      this.icon.setAlpha(Math.min(this.icon.alpha, 0.32));
    }
  }

  setVisible(visible: boolean): void {
    this.art.setVisible(visible);
    this.overlay.setVisible(visible);
    this.icon.setVisible(visible);
    this.timer.setVisible(visible);
    this.zone.setVisible(visible);
    if (visible) {
      this.zone.setInteractive(
        new Phaser.Geom.Circle(this.radius * 1.2, this.radius * 1.2, this.radius * 1.2),
        Phaser.Geom.Circle.Contains,
      );
    } else {
      this.zone.disableInteractive();
    }
  }

  destroy(): void {
    this.scene.input?.off(Phaser.Input.Events.POINTER_DOWN, this.onSceneDown, this);
    this.art.destroy();
    this.overlay.destroy();
    this.icon.destroy();
    this.timer.destroy();
    this.zone.destroy();
  }

  private flashPress(): void {
    this.pressed = true;
    this.drawArt();
    this.scene.time.delayedCall(90, () => {
      this.pressed = false;
      this.drawArt();
    });
  }

  private fitIcon(): void {
    this.icon.setDisplaySize(this.radius * 1.55, this.radius * 1.55);
  }

  private drawArt(): void {
    const r = this.radius;
    this.art.clear();
    this.art.fillStyle(COLORS.ink, 0.45 * TOUCH_CONTROL_ALPHA);
    this.art.fillCircle(this.x + 4, this.y + 5, r + 2);
    const fill = this.ultimate && this.ready && !this.consumed ? 0x3a2a12 : COLORS.panel;
    this.art.fillStyle(fill, (this.pressed ? 0.5 : 0.58) * TOUCH_CONTROL_ALPHA);
    this.art.fillCircle(this.x, this.y, r);
    const ring = this.consumed
      ? COLORS.muted
      : this.ultimate
        ? this.ready
          ? COLORS.yellow
          : COLORS.orange
        : this.ready
          ? COLORS.paper
          : COLORS.muted;
    this.art.lineStyle(this.ultimate ? 4 : 3, ring, (this.ready ? 1 : 0.55) * TOUCH_CONTROL_ALPHA);
    this.art.strokeCircle(this.x, this.y, r);
    if (this.ultimate && this.ready && !this.consumed) {
      this.art.lineStyle(2, COLORS.orange, 0.85);
      this.art.strokeCircle(this.x, this.y, r + 4);
    }
  }

  private drawOverlay(state: AbilitySlotState): void {
    this.overlay.clear();
    if (state.consumed) {
      this.overlay.fillStyle(COLORS.ink, 0.55);
      this.overlay.fillCircle(this.x, this.y, this.radius - 2);
      this.overlay.lineStyle(3, COLORS.redBright, 0.85);
      const cut = this.radius * 0.42;
      this.overlay.beginPath();
      this.overlay.moveTo(this.x - cut, this.y - cut);
      this.overlay.lineTo(this.x + cut, this.y + cut);
      this.overlay.strokePath();
      return;
    }
    if (state.def.chargeMode === 'meter' && state.meter < 1) {
      this.overlay.fillStyle(COLORS.ink, 0.62 * TOUCH_CONTROL_ALPHA);
      this.overlay.beginPath();
      this.overlay.moveTo(this.x, this.y);
      this.overlay.arc(
        this.x,
        this.y,
        this.radius - 2,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (1 - state.meter),
        false,
      );
      this.overlay.closePath();
      this.overlay.fillPath();
      return;
    }
    if (state.cooldownRatio <= 0) {
      return;
    }
    this.overlay.fillStyle(COLORS.ink, 0.62 * TOUCH_CONTROL_ALPHA);
    this.overlay.beginPath();
    this.overlay.moveTo(this.x, this.y);
    this.overlay.arc(
      this.x,
      this.y,
      this.radius - 2,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * state.cooldownRatio,
      false,
    );
    this.overlay.closePath();
    this.overlay.fillPath();
  }
}
