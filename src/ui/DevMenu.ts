import Phaser from 'phaser';
import { COLORS, FONTS, hex } from './theme';

type DevMenuOptions = {
  onToggleCpu: () => void;
  cpuPresent: () => boolean;
};

/** Compact corner playlist tools for iterating on combat. */
export class DevMenu {
  private readonly toggle: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly action: Phaser.GameObjects.Text;
  private open = false;
  private readonly options: DevMenuOptions;

  constructor(scene: Phaser.Scene, options: DevMenuOptions) {
    this.options = options;
    const width = scene.scale.width;
    const height = scene.scale.height;

    this.toggle = scene.add
      .text(width - 12, height - 12, 'DEV', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        backgroundColor: hex(COLORS.ink),
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(220)
      .setInteractive({ useHandCursor: true });

    this.panel = scene.add
      .rectangle(width - 12, height - 48, 168, 78, COLORS.ink, 0.92)
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(221)
      .setStrokeStyle(2, COLORS.yellow)
      .setVisible(false);

    this.title = scene.add
      .text(width - 24, height - 118, 'PLAYLIST', {
        fontFamily: FONTS.display,
        fontSize: '11px',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(222)
      .setVisible(false);

    this.action = scene.add
      .text(width - 24, height - 96, cpuLabel(options.cpuPresent()), {
        fontFamily: FONTS.body,
        fontSize: '13px',
        fontStyle: 'bold',
        color: hex(COLORS.ink),
        backgroundColor: hex(COLORS.paper),
        padding: { x: 10, y: 8 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(223)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.toggle.on(Phaser.Input.Events.POINTER_UP, () => {
      this.open = !this.open;
      this.setOpen(this.open);
    });
    this.action.on(Phaser.Input.Events.POINTER_UP, () => {
      this.options.onToggleCpu();
      this.sync(this.options.cpuPresent());
    });
  }

  layout(width: number, height: number): void {
    this.toggle.setPosition(width - 12, height - 12);
    this.panel.setPosition(width - 12, height - 48);
    this.title.setPosition(width - 24, height - 118);
    this.action.setPosition(width - 24, height - 96);
  }

  sync(cpuPresent: boolean): void {
    this.action.setText(cpuLabel(cpuPresent));
  }

  close(): void {
    this.open = false;
    this.setOpen(false);
  }

  private setOpen(open: boolean): void {
    this.panel.setVisible(open);
    this.title.setVisible(open);
    this.action.setVisible(open);
    if (open) {
      this.sync(this.options.cpuPresent());
    }
  }
}

const cpuLabel = (present: boolean): string => (present ? 'REMOVE CPU' : 'SPAWN CPU');
