import Phaser from 'phaser';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { createLogo } from '../ui/createLogo';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, hex } from '../ui/theme';

export class MainMenuScene extends Phaser.Scene {
  private buttons: ActionButton[] = [];
  private focusIndex = 0;
  private leaving = false;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.leaving = false;
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
      new ActionButton(this, 210, 286, {
        label: 'PLAY',
        width: 330,
        height: 78,
        primary: true,
        onPress: () => this.openBattle(),
      }),
      new ActionButton(this, 202, 378, {
        label: 'SETTINGS',
        width: 290,
        height: 58,
        onPress: () => this.openSettings(),
      }),
    ];

    if (!this.sys.game.device.input.touch) {
      this.buttons.push(
        new ActionButton(this, 194, 454, {
          label: 'EXIT',
          width: 250,
          height: 48,
          onPress: () => this.exitGame(),
        }),
      );
    }

    this.focusIndex = 0;
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

    this.add.text(x + 27, y + 91, 'ARENA TRIAL', {
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: hex(COLORS.paper),
      letterSpacing: 1,
    });
    this.add.text(x + 28, y + 128, '1 VS 1  //  COMBAT TEST', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: hex(COLORS.cyan),
      letterSpacing: 3,
    });

    this.createTeamMarks(x + 28, y + 191);

    this.add.text(x + 28, y + 285, 'DEMO 1 DIRECTIVE', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex(COLORS.orange),
      letterSpacing: 3,
    });
    this.add.text(x + 28, y + 308, 'Enter the pit. Test the war.', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: hex(COLORS.paper),
    });
    this.add.text(x + 28, y + 335, 'One hero. One foe. Core combat.', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: hex(COLORS.muted),
    });
  }

  private createTeamMarks(x: number, y: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(COLORS.cyanDark);
    graphics.fillTriangle(x + 40, y + 34, x + 57, y, x + 74, y + 34);
    graphics.lineStyle(2, COLORS.cyan);
    graphics.strokeTriangle(x + 40, y + 34, x + 57, y, x + 74, y + 34);

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

    graphics.fillStyle(COLORS.red);
    graphics.fillTriangle(x + 242, y, x + 259, y + 34, x + 276, y);
    graphics.lineStyle(2, COLORS.redBright);
    graphics.strokeTriangle(x + 242, y, x + 259, y + 34, x + 276, y);
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
      .text(GAME_WIDTH - 28, GAME_HEIGHT - 17, 'BUILD 00.02 // DEMO 1 SHELL', {
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
      this.buttons[this.focusIndex].emit(Phaser.Input.Events.GAMEOBJECT_POINTER_UP);
    });
  }

  private moveFocus(direction: number): void {
    this.focusIndex = Phaser.Math.Wrap(this.focusIndex + direction, 0, this.buttons.length);
    this.updateFocus();
  }

  private updateFocus(): void {
    this.buttons.forEach((button, index) => button.setFocused(index === this.focusIndex));
  }

  private openBattle(): void {
    this.leaveTo('Battle');
  }

  private openSettings(): void {
    this.leaveTo('Settings');
  }

  private leaveTo(sceneName: string): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.cameras.main.fadeOut(220, 7, 10, 18);
    this.time.delayedCall(230, () => this.scene.start(sceneName));
  }

  private exitGame(): void {
    window.close();
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'CLOSE THIS TAB TO EXIT', {
        fontFamily: FONTS.display,
        fontSize: '22px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(30);
  }
}
