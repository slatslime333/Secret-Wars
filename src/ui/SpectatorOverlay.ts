import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { ActionButton } from './ActionButton';
import { COLORS, FONTS, hex } from './theme';

export type SpectatorOverlayState = {
  remainingMs: number;
  simulator: boolean;
  mode: 'free' | 'lock';
  watchingName: string;
  watchingSide: string;
};

/** Respawn countdown (when needed) plus free-roam / lock-on spectate chrome. */
export class SpectatorOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly watching: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly prevButton: ActionButton;
  private readonly nextButton: ActionButton;

  constructor(
    scene: Phaser.Scene,
    handlers: { onPrev: () => void; onNext: () => void },
  ) {
    const width = scene.scale.width;
    const height = scene.scale.height;
    this.root = scene.add.container(0, 0).setDepth(160).setScrollFactor(0).setVisible(false);
    this.title = scene.add
      .text(width / 2, height / 2 - 36, 'SPECTATING', {
        fontFamily: FONTS.display,
        fontSize: '42px',
        color: hex(COLORS.yellow),
        letterSpacing: 5,
        stroke: hex(COLORS.ink),
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.watching = scene.add
      .text(width / 2, height / 2 + 8, '', {
        fontFamily: FONTS.display,
        fontSize: '18px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.hint = scene.add
      .text(width / 2, height / 2 + 36, '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.prevButton = new ActionButton(scene, width / 2 - 80, height / 2 + 78, {
      label: 'PREV',
      width: 110,
      height: 36,
      compact: true,
      attachToScene: false,
      onPress: handlers.onPrev,
    });
    this.nextButton = new ActionButton(scene, width / 2 + 80, height / 2 + 78, {
      label: 'NEXT',
      width: 110,
      height: 36,
      compact: true,
      attachToScene: false,
      onPress: handlers.onNext,
    });
    this.root.add([this.title, this.watching, this.hint, this.prevButton, this.nextButton]);
  }

  sync(state: SpectatorOverlayState, width: number, height: number): void {
    this.root.setVisible(true);
    const titleY = state.remainingMs > 0 ? height / 2 - 46 : height / 2 - 28;
    this.title.setPosition(width / 2, titleY);
    this.watching.setPosition(width / 2, titleY + 44);
    this.hint.setPosition(width / 2, titleY + 70);
    this.prevButton.setPosition(width / 2 - 80, titleY + 112);
    this.nextButton.setPosition(width / 2 + 80, titleY + 112);

    if (state.remainingMs > 0) {
      const seconds = Math.max(0, Math.ceil(state.remainingMs / 1000));
      this.title.setText(`RESPAWN  ${seconds}`);
    } else {
      this.title.setText(state.simulator ? 'SIMULATOR' : 'SPECTATING');
    }

    if (state.mode === 'lock' && state.watchingName) {
      this.watching.setText(`WATCHING  ${state.watchingName.toUpperCase()}  (${state.watchingSide})`);
    } else {
      this.watching.setText('FREE ROAM');
    }

    this.hint.setText(
      isTouchPrimary()
        ? 'LEFT STICK PANS  //  PREV NEXT LOCK'
        : 'WASD PANS  //  [ ] OR TAB LOCK',
    );
  }

  hide(): void {
    this.root.setVisible(false);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
