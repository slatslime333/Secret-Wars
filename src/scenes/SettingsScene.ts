import Phaser from 'phaser';
import { audioSettings } from '../audio/AudioSettings';
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
    this.createSliders(width, isPortrait);
    this.createFullscreenRow(isPortrait);
    this.createControlsHelp(width, isPortrait);
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

  private createSliders(width: number, isPortrait: boolean): void {
    const sliderX = isPortrait ? width / 2 : 270;
    const musicY = isPortrait ? 130 : 128;
    const sfxY = isPortrait ? 198 : 198;

    new SettingSlider(this, sliderX, musicY, {
      label: 'MUSIC',
      value: audioSettings.getMusicVolume(),
      onChange: (value) => audioSettings.setMusicVolume(value),
    });

    new SettingSlider(this, sliderX, sfxY, {
      label: 'SFX',
      value: audioSettings.getSfxVolume(),
      onChange: (value) => audioSettings.setSfxVolume(value),
      onRelease: () => audioSettings.playUiTick(),
    });
  }

  private createFullscreenRow(isPortrait: boolean): void {
    if (isTouchPrimary() || isPortrait) {
      return;
    }

    this.add
      .text(40, 258, 'DISPLAY', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0, 0);

    this.fullscreenButton = new ActionButton(this, 168, 302, {
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

  private createControlsHelp(width: number, isPortrait: boolean): void {
    const cardW = isPortrait ? Math.min(360, width - 40) : 360;
    const x = isPortrait ? (width - cardW) / 2 : Math.max(540, width - cardW - 40);
    const y = isPortrait ? 260 : 108;
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.ink, 0.72);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x + 10, y + 10),
        new Phaser.Geom.Point(x + cardW + 12, y + 10),
        new Phaser.Geom.Point(x + cardW - 8, y + 292),
        new Phaser.Geom.Point(x - 12, y + 292),
      ],
      true,
    );
    graphics.fillStyle(COLORS.panel, 0.96);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + cardW, y),
        new Phaser.Geom.Point(x + cardW - 22, y + 280),
        new Phaser.Geom.Point(x - 22, y + 280),
      ],
      true,
    );
    graphics.lineStyle(3, COLORS.cyan);
    graphics.strokePoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + cardW, y),
        new Phaser.Geom.Point(x + cardW - 22, y + 280),
        new Phaser.Geom.Point(x - 22, y + 280),
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
        ]
      : [
          `${keyboard.up}${keyboard.left}${keyboard.down}${keyboard.right} / arrows  move`,
          'Mouse  aim',
          `${keyboard.attack} / click  attack`,
          `${keyboard.block}  hold shield    ${keyboard.dash}  dash`,
          'ESC  back / menu',
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
