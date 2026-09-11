import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, hex } from './theme';

type RoundOverlayOptions = {
  onRestart: () => void;
  onMenu: () => void;
};

/** KO banner with RESTART / MENU. Viewport-fixed over the pit. */
export class RoundOverlay {
  private locked = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: RoundOverlayOptions,
  ) {}

  get isLocked(): boolean {
    return this.locked;
  }

  lock(winner: 'ninja' | 'rival'): void {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.scene.time.delayedCall(180, () => this.reveal(winner));
  }

  private reveal(winner: 'ninja' | 'rival'): void {
    const win = winner === 'ninja';
    this.scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.ink, 0.62)
      .setScrollFactor(0)
      .setDepth(180);

    this.scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, win ? 'KO' : 'DOWN', {
        fontFamily: FONTS.display,
        fontSize: '54px',
        color: hex(win ? COLORS.yellow : COLORS.redBright),
        letterSpacing: 8,
        stroke: hex(COLORS.ink),
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(181);

    this.scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, win ? 'NINJA WINS' : 'RIVAL WINS', {
        fontFamily: FONTS.body,
        fontSize: '16px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(181);

    this.scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 126, 'R RESTART    ESC MENU', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(181);

    this.addTextButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, 'RESTART', COLORS.redBright, () =>
      this.options.onRestart(),
    );
    this.addTextButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 88, 'MENU', COLORS.cyan, () => this.options.onMenu());
    this.scene.cameras.main.flash(180, 246, 241, 222, false);
  }

  private addTextButton(x: number, y: number, label: string, accent: number, onPress: () => void): void {
    const button = this.scene.add
      .text(x, y, label, {
        fontFamily: FONTS.display,
        fontSize: '22px',
        color: hex(COLORS.paper),
        backgroundColor: hex(accent),
        padding: { x: 28, y: 10 },
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(190)
      .setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.POINTER_UP, onPress);
  }
}
