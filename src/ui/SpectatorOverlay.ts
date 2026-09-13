import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { ActionButton } from './ActionButton';
import { COLORS, FONTS, hex } from './theme';
import { measureViewport } from './layout/viewport';

export type SpectatorOverlayState = {
  remainingMs: number;
  simulator: boolean;
  mode: 'free' | 'lock';
  watchingName: string;
  watchingSide: string;
};

const PLATE_WIDTH = 268;
const PLATE_HEIGHT = 74;
const MARGIN = 16;

/** Compact spectate chrome. Bottom-right so the fight and move stick stay clear. */
export class SpectatorOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly plate: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly watching: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly prevButton: ActionButton;
  private readonly nextButton: ActionButton;

  constructor(
    scene: Phaser.Scene,
    handlers: { onPrev: () => void; onNext: () => void },
  ) {
    this.root = scene.add.container(0, 0).setDepth(160).setScrollFactor(0).setVisible(false);
    this.plate = scene.add
      .rectangle(0, 0, PLATE_WIDTH, PLATE_HEIGHT, COLORS.ink, 0.78)
      .setStrokeStyle(1, COLORS.paper, 0.35);
    this.title = scene.add
      .text(0, 0, 'SPECTATING', {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.watching = scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        letterSpacing: 1,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.hint = scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.prevButton = new ActionButton(scene, 0, 0, {
      label: 'PREV',
      width: 68,
      height: 24,
      compact: true,
      attachToScene: false,
      onPress: handlers.onPrev,
    });
    this.nextButton = new ActionButton(scene, 0, 0, {
      label: 'NEXT',
      width: 68,
      height: 24,
      compact: true,
      attachToScene: false,
      onPress: handlers.onNext,
    });
    this.root.add([this.plate, this.title, this.watching, this.hint, this.prevButton, this.nextButton]);
  }

  sync(state: SpectatorOverlayState, width: number, height: number): void {
    this.root.setVisible(true);
    const frame = measureViewport(width, height);
    const plateW = Math.min(PLATE_WIDTH, width - frame.contentInset.left - frame.contentInset.right - 8);
    const plateH = state.remainingMs > 0 ? 82 : PLATE_HEIGHT;
    const margin = Math.max(MARGIN, frame.contentInset.right);
    const cx = width - margin - plateW / 2;
    const bottom = height - Math.max(MARGIN, frame.contentInset.bottom) - (frame.isMobile ? 8 : 0);
    this.plate.setPosition(cx, bottom - plateH / 2);
    this.plate.setSize(plateW, plateH);
    this.prevButton.setPosition(cx - 40, bottom - 14);
    this.nextButton.setPosition(cx + 40, bottom - 14);
    this.hint.setPosition(cx, bottom - 36);
    this.watching.setPosition(cx, bottom - 50);
    this.title.setPosition(cx, bottom - (state.remainingMs > 0 ? 66 : 62));

    if (state.remainingMs > 0) {
      const seconds = Math.max(0, Math.ceil(state.remainingMs / 1000));
      this.title.setText(`RESPAWN  ${seconds}`);
    } else {
      this.title.setText(state.simulator ? 'SIMULATOR' : 'SPECTATING');
    }

    if (state.mode === 'lock' && state.watchingName) {
      this.watching.setText(`${state.watchingName.toUpperCase()}  ·  ${state.watchingSide.toUpperCase()}`);
    } else {
      this.watching.setText('FREE ROAM');
    }

    this.hint.setText(isTouchPrimary() ? 'STICK PANS  ·  PREV NEXT' : 'WASD PANS  ·  [ ] TAB');
  }

  hide(): void {
    this.root.setVisible(false);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
