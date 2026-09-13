import Phaser from 'phaser';
import { audio } from '../audio';
import { ABILITY_ICON } from '../heroes/abilities/icons';
import { AbilitySlot, AbilitySlotState } from '../heroes/abilities/types';
import { isPcCombatHud, PC_COMBAT_HUD } from './pcCombatHud';
import { COLORS, FONTS, hex } from './theme';

export type AbilityTrayHandlers = {
  onSlotPress?: (slot: AbilitySlot) => void;
  aimingSlot?: () => AbilitySlot | null;
};

/**
 * Compact PC cooldown cluster. Mobile uses the large thumb buttons instead.
 */
export class AbilityTray {
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly overlays: Phaser.GameObjects.Graphics[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly keys: Phaser.GameObjects.Text[] = [];
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly slots: AbilitySlot[] = ['ability1', 'ability2', 'ultimate'];
  private readonly handlers?: AbilityTrayHandlers;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private scale = 1,
    handlers?: AbilityTrayHandlers,
  ) {
    this.handlers = handlers;
    this.rings = scene.add.graphics().setScrollFactor(0).setDepth(112);
    const keyHints = ['Q', 'E', 'F'];
    for (let i = 0; i < 3; i += 1) {
      const icon = scene.add.image(0, 0, ABILITY_ICON.smokeBomb).setScrollFactor(0).setDepth(113).setVisible(false);
      const overlay = scene.add.graphics().setScrollFactor(0).setDepth(114);
      const label = scene.add
        .text(0, 0, '', {
          fontFamily: FONTS.display,
          fontSize: '20px',
          color: hex(COLORS.paper),
          stroke: hex(COLORS.ink),
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(115);
      const key = scene.add
        .text(0, 0, keyHints[i], {
          fontFamily: FONTS.body,
          fontSize: '14px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(115);
      icon.setInteractive({ useHandCursor: true, cursor: 'pointer' });
      icon.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.();
        audio.unlock();
        audio.play('ui-click');
        this.handlers?.onSlotPress?.(this.slots[i]);
      });
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
    const gap = isPcCombatHud() ? PC_COMBAT_HUD.abilityGap : 52 * this.scale;
    const radius = isPcCombatHud() ? PC_COMBAT_HUD.abilityRadius : 18 * this.scale;
    const aiming = this.handlers?.aimingSlot?.() ?? null;
    this.rings.clear();
    states.forEach((state, i) => {
      const px = this.x + i * gap;
      const py = this.y;
      const icon = this.icons[i];
      icon.setTexture(state.def.iconKey).setVisible(true).setPosition(px, py);
      icon.setDisplaySize(radius * 2, radius * 2);
      icon.setInteractive(new Phaser.Geom.Circle(icon.width / 2, icon.height / 2, Math.max(icon.width, icon.height) / 2 + 4), Phaser.Geom.Circle.Contains);
      icon.setAlpha(state.consumed ? 0.28 : state.ready ? 1 : 0.45);
      this.keys[i].setPosition(px, py + radius + 6).setScale(isPcCombatHud() ? 1.15 : this.scale);
      this.labels[i].setPosition(px, py).setScale(isPcCombatHud() ? 1.1 : this.scale);
      this.rings.fillStyle(COLORS.ink, 0.62);
      this.rings.fillCircle(px, py, radius + 4);
      const aimed = aiming === state.def.slot;
      const ring = state.consumed ? COLORS.muted : aimed ? COLORS.yellow : state.def.accent;
      this.rings.lineStyle(aimed || (state.def.slot === 'ultimate' && state.ready) ? 4 : 2.5, ring, state.ready || aimed ? 1 : 0.5);
      this.rings.strokeCircle(px, py, radius + 3);

      const overlay = this.overlays[i];
      overlay.clear();
      if (state.consumed) {
        overlay.lineStyle(2, COLORS.redBright, 0.9);
        overlay.beginPath();
        overlay.moveTo(px - 8, py - 8);
        overlay.lineTo(px + 8, py + 8);
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
        this.labels[i].setText(String(Math.max(1, Math.ceil(state.cooldownRemainingMs / 1000))));
      } else {
        this.labels[i].setText(aimed ? 'AIM' : '');
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
