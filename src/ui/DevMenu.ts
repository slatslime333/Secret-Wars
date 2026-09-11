import Phaser from 'phaser';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, hex } from './theme';

type DevMenuOptions = {
  onToggleCpu: () => void;
  cpuPresent: () => boolean;
};

/** Compact corner playlist tools for iterating on combat. */
export class DevMenu {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly button: Phaser.GameObjects.Text;
  private open = false;

  constructor(scene: Phaser.Scene, options: DevMenuOptions) {
    const toggle = scene.add
      .text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'DEV', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        backgroundColor: hex(COLORS.ink),
        padding: { x: 8, y: 5 },
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true });

    this.button = scene.add
      .text(0, 18, cpuLabel(options.cpuPresent()), {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.ink),
        backgroundColor: hex(COLORS.paper),
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    const title = scene.add
      .text(0, 0, 'PLAYLIST', {
        fontFamily: FONTS.display,
        fontSize: '10px',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
      })
      .setOrigin(1, 0);

    this.panel = scene.add.container(GAME_WIDTH - 10, GAME_HEIGHT - 42, [title, this.button]);
    this.panel.setScrollFactor(0).setDepth(161).setVisible(false);

    toggle.on(Phaser.Input.Events.POINTER_UP, () => {
      this.open = !this.open;
      this.panel.setVisible(this.open);
      this.sync(options.cpuPresent());
    });
    this.button.on(Phaser.Input.Events.POINTER_UP, () => {
      options.onToggleCpu();
      this.sync(options.cpuPresent());
    });
  }

  sync(cpuPresent: boolean): void {
    this.button.setText(cpuLabel(cpuPresent));
  }
}

const cpuLabel = (present: boolean): string => (present ? 'REMOVE CPU' : 'SPAWN CPU');
