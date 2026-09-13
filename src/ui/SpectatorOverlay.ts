import Phaser from 'phaser';
import { ActionButton } from './ActionButton';
import { COLORS, FONTS, hex } from './theme';
import { adoptHud } from './layout/hudCamera';
import { layoutSpectatorPlate } from './layout/hudChrome';
import { measureViewport } from './layout/viewport';

export type SpectatorOverlayState = {
  remainingMs: number;
  simulator: boolean;
  mode: 'free' | 'lock';
  watchingName: string;
  watchingSide: string;
};

/** Compact spectate chrome. Right side, just above the health cluster. */
export class SpectatorOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly plate: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly watching: Phaser.GameObjects.Text;
  private readonly prevButton: ActionButton;
  private readonly nextButton: ActionButton;

  constructor(
    scene: Phaser.Scene,
    handlers: { onPrev: () => void; onNext: () => void },
  ) {
    this.root = scene.add.container(0, 0).setDepth(148).setScrollFactor(0).setVisible(false);
    this.plate = scene.add
      .rectangle(0, 0, 148, 46, COLORS.ink, 0.72)
      .setStrokeStyle(1, COLORS.paper, 0.3);
    this.title = scene.add
      .text(0, 0, 'SPECTATE', {
        fontFamily: FONTS.display,
        fontSize: '11px',
        color: hex(COLORS.yellow),
        letterSpacing: 1,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.watching = scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.body,
        fontSize: '9px',
        color: hex(COLORS.paper),
        letterSpacing: 0,
        stroke: hex(COLORS.ink),
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.prevButton = new ActionButton(scene, 0, 0, {
      label: 'PREV',
      width: 50,
      height: 18,
      compact: true,
      fontSize: '11px',
      letterSpacing: 1,
      attachToScene: false,
      onPress: handlers.onPrev,
    });
    this.nextButton = new ActionButton(scene, 0, 0, {
      label: 'NEXT',
      width: 50,
      height: 18,
      compact: true,
      fontSize: '11px',
      letterSpacing: 1,
      attachToScene: false,
      onPress: handlers.onNext,
    });
    this.root.add([this.plate, this.title, this.watching, this.prevButton, this.nextButton]);
    adoptHud(scene, this.root);
  }

  sync(state: SpectatorOverlayState, width: number, height: number): void {
    this.root.setVisible(true);
    const slot = layoutSpectatorPlate(measureViewport(width, height));
    this.plate.setPosition(slot.cx, slot.cy);
    this.plate.setSize(slot.width, slot.height);
    this.title.setPosition(slot.cx, slot.titleY);
    this.watching.setPosition(slot.cx, slot.watchingY);
    this.prevButton.setPosition(slot.prevX, slot.buttonY);
    this.nextButton.setPosition(slot.nextX, slot.buttonY);

    if (state.remainingMs > 0) {
      const seconds = Math.max(0, Math.ceil(state.remainingMs / 1000));
      this.title.setText(`RESPAWN  ${seconds}`);
    } else {
      this.title.setText(state.simulator ? 'SIMULATOR' : 'SPECTATE');
    }

    if (state.mode === 'lock' && state.watchingName) {
      const name = state.watchingName.toUpperCase();
      this.watching.setText(`${name} · ${state.watchingSide.toUpperCase()}`);
    } else {
      this.watching.setText('FREE ROAM');
    }
  }

  hide(): void {
    this.root.setVisible(false);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
