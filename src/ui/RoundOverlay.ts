import Phaser from 'phaser';
import { ActionButton } from './ActionButton';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, hex } from './theme';

type RoundOverlayOptions = {
  onRestart: () => void;
  onMenu: () => void;
};

/** KO banner with RESTART / MENU. Viewport-fixed over the pit. */
export class RoundOverlay {
  private locked = false;
  private readonly root: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: RoundOverlayOptions,
  ) {
    this.root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(180).setScrollFactor(0);
    this.root.setVisible(false);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  lock(winner: 'ninja' | 'rival'): void {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.scene.time.delayedCall(320, () => this.reveal(winner));
  }

  private reveal(winner: 'ninja' | 'rival'): void {
    const win = winner === 'ninja';
    const dim = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.62);
    dim.setInteractive();
    const title = this.scene.add
      .text(0, -70, win ? 'KO' : 'DOWN', {
        fontFamily: FONTS.display,
        fontSize: '54px',
        color: hex(win ? COLORS.yellow : COLORS.redBright),
        letterSpacing: 8,
        stroke: hex(COLORS.ink),
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    const sub = this.scene.add
      .text(0, -18, win ? 'NINJA WINS' : 'RIVAL WINS', {
        fontFamily: FONTS.body,
        fontSize: '16px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const hint = this.scene.add
      .text(0, 118, 'R RESTART    ESC MENU', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5);

    this.root.add([dim, title, sub, hint]);
    this.root.setVisible(true);

    const restart = new ActionButton(this.scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, {
      label: 'RESTART',
      width: 240,
      height: 52,
      primary: true,
      onPress: () => this.options.onRestart(),
    });
    const menu = new ActionButton(this.scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 92, {
      label: 'MENU',
      width: 200,
      height: 44,
      onPress: () => this.options.onMenu(),
    });
    restart.setScrollFactor(0).setDepth(200);
    menu.setScrollFactor(0).setDepth(200);
    this.scene.cameras.main.flash(180, 246, 241, 222, false);
  }
}
