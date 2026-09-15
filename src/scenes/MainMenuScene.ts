import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { createLogo } from '../ui/createLogo';
import { COLORS, FONTS, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';
import { audio, playHeroSelect } from '../audio';
import { HERO_IDS, getSelectedHeroId, setSelectedHeroId, type HeroId } from '../heroes/roster';
import { clamp, measureViewport, resetUiCamera } from '../ui/layout/viewport';
import { ScrollPanel } from '../ui/layout/ScrollPanel';

export class MainMenuScene extends Phaser.Scene {
  private buttons: ActionButton[] = [];
  private focusIndex = 0;
  private leaving = false;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.leaving = false;
    resetUiCamera(this);
    createBackdrop(this, { accent: COLORS.cyan, embers: true });
    this.cameras.main.fadeIn(260, 7, 10, 18);

    const frame = measureViewport(this.scale.width, this.scale.height);
    const width = frame.width;
    const height = frame.height;
    const isPortrait = frame.isPortrait;

    this.createHeader(width, height, isPortrait);
    this.createMissionCard(width, height, isPortrait);
    this.createNavigation(width, height, isPortrait);
    this.createFooter(width, height);
    this.bindKeyboard();

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart();
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private createHeader(width: number, height: number, isPortrait: boolean): void {
    if (isPortrait) {
      const logoY = Math.min(90, height * 0.1);
      createLogo(this, width / 2, logoY, Math.min(0.4, width / 900));
      const barW = Math.min(360, width - 60);
      const startX = (width - barW) / 2;
      const barY = logoY + 60;
      const graphics = this.add.graphics();
      graphics.fillStyle(COLORS.cyan);
      graphics.fillRect(startX, barY, barW * 0.8, 4);
      graphics.fillStyle(COLORS.redBright);
      graphics.fillRect(startX + barW * 0.8, barY, barW * 0.2, 4);

      this.add
        .text(width / 2, barY + 11, 'COMMAND SCREEN', {
          fontFamily: FONTS.body,
          fontSize: '12px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          letterSpacing: 4,
        })
        .setOrigin(0.5, 0);
      return;
    }

    const leftCenterX = Math.max(185, Math.min(220, width * 0.22));
    const logoY = Math.min(107, height * 0.2);
    createLogo(this, leftCenterX, logoY, Math.min(0.43, height / 1250));

    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.cyan);
    graphics.fillRect(leftCenterX - 155, logoY + 70, 318, 4);
    graphics.fillStyle(COLORS.redBright);
    graphics.fillRect(leftCenterX + 163, logoY + 70, 68, 4);

    this.add
      .text(leftCenterX - 151, logoY + 83, 'COMMAND SCREEN', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 4,
      })
      .setOrigin(0, 0);
  }

  private createNavigation(width: number, height: number, isPortrait: boolean): void {
    const inset = measureViewport(width, height).contentInset;
    if (isPortrait) {
      const showExit = !isTouchPrimary();
      const playH = Math.min(50, height * 0.06);
      const gap = 7;
      const heights = [playH, playH - 4, playH - 4, 44];
      if (showExit) {
        heights.push(40);
      }
      const stackH = heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1);
      const startY = height - Math.max(22, inset.bottom + 16) - stackH + heights[0] / 2;
      const btnW = Math.min(340, width - 60);
      let y = startY;
      const place = (label: string, h: number, widthScale: number, primary: boolean, onPress: () => void) => {
        const button = new ActionButton(this, width / 2, y, {
          label,
          width: btnW - widthScale,
          height: h,
          primary,
          onPress,
        });
        y += h + gap;
        return button;
      };
      this.buttons = [
        place('PLAY', heights[0], 0, true, () => this.openPlay()),
        place('SIMULATOR', heights[1], 10, false, () => this.openSimulator()),
        place('PLAY TEST', heights[2], 10, false, () => this.openPlayTest()),
        place('SETTINGS', heights[3], 30, false, () => this.openSettings()),
      ];
      if (showExit) {
        this.buttons.push(place('EXIT', heights[4], 60, false, () => this.exitGame()));
      }
    } else {
      const leftCenterX = Math.max(185, Math.min(220, width * 0.22));
      const playY = height * 0.42;
      const step = Math.min(52, height * 0.088);
      this.buttons = [
        new ActionButton(this, leftCenterX + 25, playY, {
          label: 'PLAY',
          width: Math.min(330, width * 0.36),
          height: Math.min(58, height * 0.1),
          primary: true,
          onPress: () => this.openPlay(),
        }),
        new ActionButton(this, leftCenterX + 23, playY + step, {
          label: 'SIMULATOR',
          width: Math.min(320, width * 0.35),
          height: Math.min(50, height * 0.09),
          onPress: () => this.openSimulator(),
        }),
        new ActionButton(this, leftCenterX + 21, playY + step * 2, {
          label: 'PLAY TEST',
          width: Math.min(310, width * 0.34),
          height: Math.min(48, height * 0.085),
          onPress: () => this.openPlayTest(),
        }),
        new ActionButton(this, leftCenterX + 17, playY + step * 3, {
          label: 'SETTINGS',
          width: Math.min(290, width * 0.32),
          height: Math.min(44, height * 0.08),
          onPress: () => this.openSettings(),
        }),
      ];

      if (!isTouchPrimary()) {
        this.buttons.push(
          new ActionButton(this, leftCenterX + 9, playY + step * 4, {
            label: 'EXIT',
            width: Math.min(250, width * 0.28),
            height: Math.min(40, height * 0.07),
            onPress: () => this.exitGame(),
          }),
        );
      }
    }

    this.focusIndex = 0;
    this.updateFocus();
  }

  private createMissionCard(width: number, height: number, isPortrait: boolean): void {
    let x: number;
    let y: number;
    let cardW: number;
    let cardH: number;

    if (isPortrait) {
      cardW = Math.min(420, width - 40);
      cardH = Math.min(340, height * 0.38);
      x = (width - cardW) / 2;
      y = Math.min(175, height * 0.2);
    } else {
      cardW = Math.min(540, width * 0.56);
      cardH = Math.min(370, height - 40);
      x = Math.max(width * 0.5, width - cardW - 24);
      y = Math.max(12, (height - cardH) / 2);
    }
    const graphics = this.add.graphics();

    graphics.fillStyle(COLORS.ink, 0.8);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x + 12, y + 12),
        new Phaser.Geom.Point(x + cardW + 12, y + 12),
        new Phaser.Geom.Point(x + cardW - 30, y + cardH + 12),
        new Phaser.Geom.Point(x - 24, y + cardH + 12),
      ],
      true,
    );
    graphics.fillStyle(COLORS.panel, 0.96);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + cardW, y),
        new Phaser.Geom.Point(x + cardW - 42, y + cardH),
        new Phaser.Geom.Point(x - 36, y + cardH),
      ],
      true,
    );
    graphics.lineStyle(3, COLORS.cyan);
    graphics.strokePoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + cardW, y),
        new Phaser.Geom.Point(x + cardW - 42, y + cardH),
        new Phaser.Geom.Point(x - 36, y + cardH),
      ],
      true,
    );

    graphics.fillStyle(COLORS.red);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + cardW, y),
        new Phaser.Geom.Point(x + cardW - 10, y + 58),
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

    this.add.text(x + 27, y + 91, 'DRAFT MATCH', {
      fontFamily: FONTS.display,
      fontSize: '28px',
      color: hex(COLORS.paper),
      letterSpacing: 1,
    });
    this.add.text(x + 28, y + 128, '3 LANES  //  4:00  //  WAVES', {
      fontFamily: FONTS.body,
      fontSize: '17px',
      fontStyle: 'bold',
      color: hex(COLORS.cyan),
      letterSpacing: 3,
    });

    this.createTeamMarks(x + 28, y + 168);
    this.createHeroPick(x + 16, y + 214, cardW - 32);

    this.add.text(x + 28, y + 265, 'COMMAND', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex(COLORS.orange),
      letterSpacing: 3,
    });
    this.add.text(x + 28, y + 288, 'PLAY starts the draft match.', {
      fontFamily: FONTS.body,
      fontSize: '16px',
      fontStyle: 'bold',
      color: hex(COLORS.paper),
    });
    this.add.text(x + 28, y + 312, 'SIMULATOR watches a CPU 3v3.', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: hex(COLORS.muted),
    });
    this.add.text(x + 28, y + 332, 'PLAY TEST keeps the combat sandbox.', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: hex(COLORS.muted),
    });
  }

  private createHeroPick(x: number, y: number, innerW = 360): void {
    this.add.text(x, y - 18, 'FIGHTER', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex(COLORS.muted),
      letterSpacing: 3,
    });
    const n = HERO_IDS.length;
    const gap = 5;
    const bw = Math.round(clamp((innerW - gap * (n - 1)) / n, 72, 88));
    const total = n * bw + gap * (n - 1);
    const step = bw + gap;
    const make = (id: HeroId, ox: number, oy: number, parent?: ScrollPanel) => {
      const button = new ActionButton(this, ox, oy, {
        label: id === 'rope' ? 'ROPE' : id.toUpperCase(),
        width: bw,
        height: 34,
        compact: true,
        fontSize: bw < 64 ? '11px' : '13px',
        letterSpacing: 0,
        primary: getSelectedHeroId() === id,
        attachToScene: !parent,
        onPress: () => {
          audio.unlock();
          playHeroSelect(id);
          setSelectedHeroId(id);
          this.scene.restart();
        },
      });
      parent?.add(button);
    };
    if (total <= innerW) {
      HERO_IDS.forEach((id, index) => make(id, x + bw / 2 + index * step, y + 10));
      return;
    }
    const row = new ScrollPanel(this, x, y - 8, innerW, 44, { axis: 'x' });
    HERO_IDS.forEach((id, index) => make(id, bw / 2 + index * step, 22, row));
    row.setContentSize(total + 8, 44);
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

  private createFooter(width: number, height: number): void {
    const inset = measureViewport(width, height).contentInset;
    if (height > width) {
      return;
    }
    const y = height - Math.max(17, inset.bottom + 8);
    this.add
      .text(Math.max(28, inset.left), y, isTouchPrimary() ? 'TAP TO SELECT' : '↑↓ SELECT   ENTER CONFIRM', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0, 1);

    this.add
      .text(width - Math.max(28, inset.right), y, 'BUILD 00.06 // DRAFT MATCH', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(1, 1);
  }

  private bindKeyboard(): void {
    this.input.keyboard?.on('keydown-UP', this.onUp, this);
    this.input.keyboard?.on('keydown-DOWN', this.onDown, this);
    this.input.keyboard?.on('keydown-ENTER', this.onEnter, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-UP', this.onUp, this);
      this.input.keyboard?.off('keydown-DOWN', this.onDown, this);
      this.input.keyboard?.off('keydown-ENTER', this.onEnter, this);
    });
  }

  private onUp(): void {
    this.moveFocus(-1);
  }

  private onDown(): void {
    this.moveFocus(1);
  }

  private onEnter(): void {
    this.buttons[this.focusIndex]?.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_UP);
  }

  private moveFocus(direction: number): void {
    this.focusIndex = Phaser.Math.Wrap(this.focusIndex + direction, 0, this.buttons.length);
    this.updateFocus();
  }

  private updateFocus(): void {
    this.buttons.forEach((button, index) => button.setFocused(index === this.focusIndex));
  }

  private openPlay(): void {
    this.leaveTo('CharacterSelect');
  }

  private openSimulator(): void {
    this.leaveTo('SimulatorSetup');
  }

  private openPlayTest(): void {
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
    fadeToScene(this, sceneName, 220);
  }

  private exitGame(): void {
    window.close();
    const width = this.scale.width;
    const height = this.scale.height;
    this.add
      .text(width / 2, height / 2, 'CLOSE THIS TAB TO EXIT', {
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
