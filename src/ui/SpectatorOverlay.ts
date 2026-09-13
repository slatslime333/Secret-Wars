import Phaser from 'phaser';
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

const makeChip = (
  scene: Phaser.Scene,
  label: string,
  onPress: () => void,
): Phaser.GameObjects.Container => {
  const bg = scene.add.rectangle(0, 0, 52, 18, COLORS.panel, 0.95).setStrokeStyle(1, COLORS.cyan, 0.85);
  const text = scene.add
    .text(0, -1, label, {
      fontFamily: FONTS.display,
      fontSize: '10px',
      color: hex(COLORS.paper),
      letterSpacing: 1,
      stroke: hex(COLORS.ink),
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  const chip = scene.add.container(0, 0, [bg, text]);
  chip.setSize(52, 18);
  chip.setInteractive({ useHandCursor: true });
  chip.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => chip.setScale(0.96));
  chip.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
    chip.setScale(1);
    onPress();
  });
  chip.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => chip.setScale(1));
  return chip;
};

/** Compact spectate chrome. Right side, just above the health cluster. */
export class SpectatorOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly plate: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly prevButton: Phaser.GameObjects.Container;
  private readonly nextButton: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    handlers: { onPrev: () => void; onNext: () => void },
  ) {
    this.root = scene.add.container(0, 0).setDepth(148).setScrollFactor(0).setVisible(false);
    this.plate = scene.add
      .rectangle(0, 0, 148, 44, COLORS.ink, 0.72)
      .setStrokeStyle(1, COLORS.paper, 0.3);
    this.title = scene.add
      .text(0, 0, 'SPECTATE', {
        fontFamily: FONTS.display,
        fontSize: '10px',
        color: hex(COLORS.yellow),
        letterSpacing: 1,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.prevButton = makeChip(scene, 'PREV', handlers.onPrev);
    this.nextButton = makeChip(scene, 'NEXT', handlers.onNext);
    this.root.add([this.plate, this.title, this.prevButton, this.nextButton]);
    adoptHud(scene, this.root);
  }

  sync(state: SpectatorOverlayState, width: number, height: number): void {
    this.root.setVisible(true);
    const slot = layoutSpectatorPlate(measureViewport(width, height));
    this.plate.setPosition(slot.cx, slot.cy);
    this.plate.setSize(slot.width, slot.height);
    this.title.setPosition(slot.cx, slot.titleY);
    this.title.setFontSize(slot.width < 150 ? '9px' : '10px');
    this.title.setLetterSpacing(slot.width < 150 ? 0 : 1);
    this.prevButton.setPosition(slot.prevX, slot.buttonY);
    this.nextButton.setPosition(slot.nextX, slot.buttonY);

    let heading: string;
    if (state.remainingMs > 0) {
      heading = `R ${Math.max(0, Math.ceil(state.remainingMs / 1000))}`;
    } else {
      heading = state.simulator ? 'SIM' : 'SPEC';
    }
    const watch =
      state.mode === 'lock' && state.watchingName ? state.watchingName.toUpperCase().slice(0, 6) : 'FREE';
    this.title.setText(`${heading} · ${watch}`);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
