import Phaser from 'phaser';
import { ABILITY_ICON } from '../heroes/abilities/icons';
import { AbilitySlotState } from '../heroes/abilities/types';
import { COLORS, FONTS, hex } from './theme';

/**
 * Compact PC cooldown cluster. Mobile uses the large thumb buttons instead.
 */
export class AbilityTray {
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly overlays: Phaser.GameObjects.Graphics[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly keys: Phaser.GameObjects.Text[] = [];
  private readonly rings: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private scale = 1,
  ) {
    this.rings = scene.add.graphics().setScrollFactor(0).setDepth(112);
    const keyHints = ['Q', 'E', 'F'];
    for (let i = 0; i < 3; i += 1) {
      const icon = scene.add.image(0, 0, ABILITY_ICON.smokeBomb).setScrollFactor(0).setDepth(113).setVisible(false);
      const overlay = scene.add.graphics().setScrollFactor(0).setDepth(114);
      const label = scene.add
        .text(0, 0, '', {
          fontFamily: FONTS.display,
          fontSize: '10px',
          color: hex(COLORS.paper),
          stroke: hex(COLORS.ink),
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(115);
      const key = scene.add
        .text(0, 0, keyHints[i], {
          fontFamily: FONTS.body,
          fontSize: '9px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(115);
      this.icons.push(icon);
      this.overlays.push(overlay);
      this.labels.push(label);
      this.keys.push(key);
    }
  }

  layout(x: number, y: number, scale: number): void {
    this.x = x;
    this.y = y;
    this.scale = scale;
  }

  setVisible(visible: boolean): void {
    this.rings.setVisible(visible);
    this.icons.forEach((icon) => icon.setVisible(visible));
    this.overlays.forEach((overlay) => overlay.setVisible(visible));
    this.labels.forEach((label) => label.setVisible(visible));
    this.keys.forEach((key) => key.setVisible(visible));
  }

  sync(states: AbilitySlotState[]): void {
    const gap = 52 * this.scale;
    const radius = 18 * this.scale;
    this.rings.clear();
    states.forEach((state, i) => {
      const px = this.x + i * gap;
      const py = this.y;
      const icon = this.icons[i];
      icon.setTexture(state.def.iconKey).setVisible(true).setPosition(px, py);
      icon.setDisplaySize(radius * 2, radius * 2);
      icon.setAlpha(state.consumed ? 0.28 : state.ready ? 1 : 0.45);
      this.keys[i].setPosition(px, py + radius + 2).setScale(this.scale);
      this.labels[i].setPosition(px, py).setScale(this.scale);
      this.rings.fillStyle(COLORS.ink, 0.55);
      this.rings.fillCircle(px, py, radius + 3);
      const ring = state.consumed ? COLORS.muted : state.def.accent;
      this.rings.lineStyle(state.def.slot === 'ultimate' && state.ready ? 3 : 2, ring, state.ready ? 1 : 0.5);
      this.rings.strokeCircle(px, py, radius + 2);

      const overlay = this.overlays[i];
      overlay.clear();
      if (state.consumed) {
        overlay.lineStyle(2, COLORS.redBright, 0.9);
        overlay.beginPath();
        overlay.moveTo(px - 7, py - 7);
        overlay.lineTo(px + 7, py + 7);
        overlay.strokePath();
        this.labels[i].setText('');
        return;
      }
      if (!state.ready && state.cooldownRemainingMs > 0) {
        overlay.fillStyle(COLORS.ink, 0.6);
        overlay.beginPath();
        overlay.moveTo(px, py);
        overlay.arc(px, py, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.cooldownRatio);
        overlay.closePath();
        overlay.fillPath();
        this.labels[i].setText((state.cooldownRemainingMs / 1000).toFixed(state.cooldownRemainingMs >= 10000 ? 0 : 1));
      } else {
        this.labels[i].setText('');
      }
    });
  }

  destroy(): void {
    this.rings.destroy();
    this.icons.forEach((icon) => icon.destroy());
    this.overlays.forEach((overlay) => overlay.destroy());
    this.labels.forEach((label) => label.destroy());
    this.keys.forEach((key) => key.destroy());
  }
}
