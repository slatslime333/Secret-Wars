import Phaser from 'phaser';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { createLogo } from '../ui/createLogo';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, hex } from '../ui/theme';

export class HomeScene extends Phaser.Scene {
  private buttons: ActionButton[] = [];
  private focusIndex = 0;
  private modal?: Phaser.GameObjects.Container;

  constructor() {
    super('Home');
  }

  create(): void {
    createBackdrop(this, { accent: COLORS.cyan, embers: true });
    this.cameras.main.fadeIn(260, 7, 10, 18);
    this.createHeader();
    this.createMissionCard();
    this.createNavigation();
    this.createFooter();
    this.bindKeyboard();
  }

  private createHeader(): void {
    createLogo(this, 185, 107, 0.43);

    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.cyan);
    graphics.fillRect(30, 177, 318, 4);
    graphics.fillStyle(COLORS.redBright);
    graphics.fillRect(348, 177, 68, 4);

    this.add
      .text(34, 190, 'COMMAND SCREEN', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 4,
      })
      .setOrigin(0, 0);
  }

  private createNavigation(): void {
    this.buttons = [
      new ActionButton(this, 210, 277, {
        label: 'PLAY',
        width: 330,
        height: 78,
        primary: true,
        onPress: () => this.openBattle(),
      }),
      new ActionButton(this, 202, 374, {
        label: 'SETTINGS',
        width: 290,
        height: 58,
        onPress: () =>
          this.openModal(
            'SETTINGS',
            'Music, sound, display, and controls\nwill arrive with the full menu pass.',
          ),
      }),
      new ActionButton(this, 194, 446, {
        label: 'CREDITS',
        width: 250,
        height: 52,
        onPress: () =>
          this.openModal(
            'CREDITS',
            'SECRET WARS\nOriginal prototype by the Secret Wars team.',
          ),
      }),
    ];
    this.updateFocus();
  }

  private createMissionCard(): void {
    const x = 500;
    const y = 85;
    const width = 412;
    const height = 370;
    const graphics = this.add.graphics();

    graphics.fillStyle(COLORS.ink, 0.8);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x + 12, y + 12),
        new Phaser.Geom.Point(x + width + 12, y + 12),
        new Phaser.Geom.Point(x + width - 30, y + height + 12),
        new Phaser.Geom.Point(x - 24, y + height + 12),
      ],
      true,
    );
    graphics.fillStyle(COLORS.panel, 0.96);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + width, y),
        new Phaser.Geom.Point(x + width - 42, y + height),
        new Phaser.Geom.Point(x - 36, y + height),
      ],
      true,
    );
    graphics.lineStyle(3, COLORS.cyan);
    graphics.strokePoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + width, y),
        new Phaser.Geom.Point(x + width - 42, y + height),
        new Phaser.Geom.Point(x - 36, y + height),
      ],
      true,
    );

    graphics.fillStyle(COLORS.red);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + width, y),
        new Phaser.Geom.Point(x + width - 10, y + 58),
        new Phaser.Geom.Point(x - 10, y + 58),
      ],
      true,
    );

    this.add.text(x + 26, y + 16, 'NEXT BATTLE', {
      fontFamily: FONTS.display,
      fontSize: '25px',
      color: hex(COLORS.paper),
      letterSpacing: 4,
      stroke: hex(COLORS.ink),
      strokeThickness: 4,
    });

    this.add.text(x + 27, y + 91, 'STANDARD CLASH', {
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: hex(COLORS.paper),
      letterSpacing: 1,
    });
    this.add.text(x + 28, y + 128, '3 VS 3  //  03:00', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: hex(COLORS.cyan),
      letterSpacing: 3,
    });

    this.createTeamMarks(x + 28, y + 191);

    this.add.text(x + 28, y + 285, 'PROTOTYPE DIRECTIVE', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex(COLORS.orange),
      letterSpacing: 3,
    });
    this.add.text(x + 28, y + 308, 'Enter the arena. Start the war.', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: hex(COLORS.paper),
    });
    this.add.text(x + 28, y + 335, 'Character deployment begins next.', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: hex(COLORS.muted),
    });
  }

  private createTeamMarks(x: number, y: number): void {
    const graphics = this.add.graphics();

    for (let index = 0; index < 3; index += 1) {
      const offset = index * 45;
      graphics.fillStyle(COLORS.cyanDark);
      graphics.fillTriangle(x + offset, y + 34, x + offset + 17, y, x + offset + 34, y + 34);
      graphics.lineStyle(2, COLORS.cyan);
      graphics.strokeTriangle(x + offset, y + 34, x + offset + 17, y, x + offset + 34, y + 34);
    }

    this.add
      .text(x + 168, y + 17, 'VS', {
        fontFamily: FONTS.display,
        fontSize: '25px',
        fontStyle: 'italic',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    for (let index = 0; index < 3; index += 1) {
      const offset = index * 45;
      graphics.fillStyle(COLORS.red);
      graphics.fillTriangle(
        x + 202 + offset,
        y,
        x + 219 + offset,
        y + 34,
        x + 236 + offset,
        y,
      );
      graphics.lineStyle(2, COLORS.redBright);
      graphics.strokeTriangle(
        x + 202 + offset,
        y,
        x + 219 + offset,
        y + 34,
        x + 236 + offset,
        y,
      );
    }
  }

  private createFooter(): void {
    this.add
      .text(28, GAME_HEIGHT - 17, '↑↓ SELECT   ENTER CONFIRM', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0, 1);

    this.add
      .text(GAME_WIDTH - 28, GAME_HEIGHT - 17, 'BUILD 00.01 // ONLINE: OFF', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(1, 1);
  }

  private bindKeyboard(): void {
    this.input.keyboard?.on('keydown-UP', () => this.moveFocus(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveFocus(1));
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.modal) {
        this.closeModal();
        return;
      }
      this.buttons[this.focusIndex].emit(Phaser.Input.Events.GAMEOBJECT_POINTER_UP);
    });
    this.input.keyboard?.on('keydown-ESC', () => this.closeModal());
  }

  private moveFocus(direction: number): void {
    if (this.modal) {
      return;
    }
    this.focusIndex = Phaser.Math.Wrap(this.focusIndex + direction, 0, this.buttons.length);
    this.updateFocus();
  }

  private updateFocus(): void {
    this.buttons.forEach((button, index) => button.setFocused(index === this.focusIndex));
  }

  private openBattle(): void {
    if (this.modal) {
      return;
    }
    this.cameras.main.fadeOut(220, 7, 10, 18);
    this.time.delayedCall(230, () => this.scene.start('Battle'));
  }

  private openModal(title: string, copy: string): void {
    this.closeModal();

    const shade = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      COLORS.ink,
      0.82,
    );
    shade.setInteractive();

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel);
    panel.fillPoints(
      [
        new Phaser.Geom.Point(-230, -112),
        new Phaser.Geom.Point(250, -112),
        new Phaser.Geom.Point(225, 112),
        new Phaser.Geom.Point(-250, 112),
      ],
      true,
    );
    panel.lineStyle(3, COLORS.cyan);
    panel.strokePoints(
      [
        new Phaser.Geom.Point(-230, -112),
        new Phaser.Geom.Point(250, -112),
        new Phaser.Geom.Point(225, 112),
        new Phaser.Geom.Point(-250, 112),
      ],
      true,
    );

    const heading = this.add
      .text(0, -62, title, {
        fontFamily: FONTS.display,
        fontSize: '31px',
        color: hex(COLORS.paper),
        letterSpacing: 4,
      })
      .setOrigin(0.5);
    const body = this.add
      .text(0, 8, copy, {
        fontFamily: FONTS.body,
        fontSize: '17px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        align: 'center',
        lineSpacing: 9,
      })
      .setOrigin(0.5);
    const close = this.add
      .text(0, 77, 'TAP / ENTER TO CLOSE', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.cyan),
        letterSpacing: 3,
      })
      .setOrigin(0.5);

    const content = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2, [
      panel,
      heading,
      body,
      close,
    ]);
    this.modal = this.add.container(0, 0, [shade, content]).setDepth(20);
    this.modal.setAlpha(0);
    this.tweens.add({
      targets: this.modal,
      alpha: 1,
      duration: 130,
      ease: 'Stepped',
      easeParams: [3],
    });
    shade.once(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.closeModal());
  }

  private closeModal(): void {
    this.modal?.destroy(true);
    this.modal = undefined;
  }
}
