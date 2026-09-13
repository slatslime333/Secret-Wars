import Phaser from 'phaser';
import { audio, audioSettings } from '../audio';
import { INPUT } from '../config/input';
import { isTouchPrimary } from '../device';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { SettingSlider } from '../ui/SettingSlider';
import { COLORS, FONTS, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';

export class SettingsScene extends Phaser.Scene {
  private returning = false;
  private fullscreenButton?: ActionButton;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.returning = false;
    createBackdrop(this, { accent: COLORS.cyan });
    this.cameras.main.fadeIn(220, 7, 10, 18);

    const width = this.scale.width;
    const height = this.scale.height;
    const isPortrait = width < height;

    this.createHeader();
    this.createSliders(width, height, isPortrait);
    this.createFullscreenRow(height, isPortrait);
    this.createControlsHelp(width, height, isPortrait);
    this.createBackButton(width, height, isPortrait);
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);

    const onResize = () => {
      if (!this.returning) {
        this.scene.restart();
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    });
  }

  private createHeader(): void {
    this.add
      .text(40, 28, 'SETTINGS', {
        fontFamily: FONTS.display,
        fontSize: '36px',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0, 0);

    this.add
      .text(42, 72, 'AUDIO  //  DISPLAY  //  CONTROLS', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0, 0);
  }

  private createSliders(width: number, height: number, isPortrait: boolean): void {
    const sliderX = isPortrait ? width / 2 : Math.min(270, width * 0.28);
    const musicY = isPortrait ? Math.min(130, height * 0.16) : Math.min(128, height * 0.28);
    const sfxY = musicY + Math.min(70, height * 0.14);

    new SettingSlider(this, sliderX, musicY, {
      label: 'MUSIC',
      value: audioSettings.getMusicVolume(),
      onChange: (value) => {
        audioSettings.setMusicVolume(value);
        audio.syncMusicVolume();
      },
    });

    new SettingSlider(this, sliderX, sfxY, {
      label: 'SFX',
      value: audioSettings.getSfxVolume(),
      onChange: (value) => audioSettings.setSfxVolume(value),
      onRelease: () => audioSettings.playUiTick(),
    });
  }

  private createFullscreenRow(height: number, isPortrait: boolean): void {
    if (isTouchPrimary() || isPortrait) {
      return;
    }

    this.add
      .text(40, Math.min(258, height * 0.48), 'DISPLAY', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0, 0);

    this.fullscreenButton = new ActionButton(this, 168, Math.min(302, height * 0.58), {
      label: this.fullscreenLabel(),
      width: 250,
      height: 48,
      onPress: () => this.toggleFullscreen(),
    });

    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, this.syncFullscreenLabel, this);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.syncFullscreenLabel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, this.syncFullscreenLabel, this);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.syncFullscreenLabel, this);
    });
  }

  private fullscreenLabel(): string {
    return this.scale.isFullscreen ? 'WINDOWED' : 'FULLSCREEN';
  }

  private syncFullscreenLabel(): void {
    this.fullscreenButton?.setLabel(this.fullscreenLabel());
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
    }
  }

  private createControlsHelp(width: number, height: number, isPortrait: boolean): void {
    const cardW = isPortrait ? Math.min(360, width - 40) : Math.min(360, width * 0.4);
    const cardH = Math.min(280, isPortrait ? height * 0.36 : height - 80);
    const x = isPortrait ? (width - cardW) / 2 : Math.max(width * 0.52, width - cardW - 24);
    const y = isPortrait ? Math.min(260, height * 0.3) : Math.max(16, (height - cardH - 60) / 2);
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.ink, 0.72);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x + 10, y + 10),
        new Phaser.Geom.Point(x + cardW + 12, y + 10),
        new Phaser.Geom.Point(x + cardW - 8, y + cardH + 12),
        new Phaser.Geom.Point(x - 12, y + cardH + 12),
      ],
      true,
    );
    graphics.fillStyle(COLORS.panel, 0.96);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + cardW, y),
        new Phaser.Geom.Point(x + cardW - 22, y + cardH),
        new Phaser.Geom.Point(x - 22, y + cardH),
      ],
      true,
    );
    graphics.lineStyle(3, COLORS.cyan);
    graphics.strokePoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + cardW, y),
        new Phaser.Geom.Point(x + cardW - 22, y + cardH),
        new Phaser.Geom.Point(x - 22, y + cardH),
      ],
      true,
    );

    this.add.text(x + 22, y + 16, 'CONTROLS', {
      fontFamily: FONTS.display,
      fontSize: '20px',
      color: hex(COLORS.paper),
      letterSpacing: 3,
    });

    const { keyboard } = INPUT;
    const lines = isTouchPrimary()
      ? [
          'Left stick  move',
          'Right stick  aim / attack',
          'Hold SHIELD to block',
          'DASH next to SHIELD',
          'Ability buttons around AIM',
          'Ultimate between the sticks',
          'EDIT BUTTONS  move / resize',
        ]
      : [
          `${keyboard.up}${keyboard.left}${keyboard.down}${keyboard.right} / arrows  move`,
          'Mouse  aim',
          `${keyboard.attack} / click  attack`,
          `${keyboard.block}  hold shield    ${keyboard.dash}  dash`,
          `${keyboard.ability1} ability 1   ${keyboard.ability2} ability 2   ${keyboard.ultimate} ultimate`,
          'ESC  back / menu',
          'EDIT BUTTONS  move / resize',
        ];

    this.add.text(x + 22, y + 48, lines.join('\n'), {
      fontFamily: FONTS.body,
      fontSize: '13px',
      fontStyle: 'bold',
      color: hex(COLORS.paper),
      lineSpacing: 5,
    });
  }

  private createBackButton(width: number, height: number, isPortrait: boolean): void {
    const btnX = isPortrait ? width / 2 : 140;
    const editX = isPortrait ? width / 2 : 340;
    const editY = isPortrait ? height - 100 : height - 48;
    new ActionButton(this, editX, editY, {
      label: 'EDIT BUTTONS',
      width: isPortrait ? 220 : 200,
      height: 52,
      onPress: () => {
        if (this.returning) {
          return;
        }
        this.returning = true;
        fadeToScene(this, 'ControlLayout');
      },
    });
    new ActionButton(this, btnX, height - 48, {
      label: 'BACK',
      width: 180,
      height: 52,
      primary: true,
      onPress: () => this.returnToMenu(),
    });
  }

  private returnToMenu(): void {
    if (this.returning) {
      return;
    }
    this.returning = true;
    fadeToScene(this, 'MainMenu');
  }
}
