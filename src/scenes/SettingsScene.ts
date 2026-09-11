import Phaser from 'phaser';
import { audioSettings } from '../audio/AudioSettings';
import { INPUT } from '../config/input';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { SettingSlider } from '../ui/SettingSlider';
import { COLORS, FONTS, GAME_HEIGHT, hex } from '../ui/theme';

export class SettingsScene extends Phaser.Scene {
  private returning = false;
  private fullscreenButton?: ActionButton;

  constructor() {
    super('Settings');
  }

  create(): void {
    createBackdrop(this, { accent: COLORS.cyan });
    this.cameras.main.fadeIn(220, 7, 10, 18);
    this.createHeader();
    this.createSliders();
    this.createFullscreenRow();
    this.createControlsHelp();
    this.createBackButton();
    this.input.keyboard?.once('keydown-ESC', () => this.returnToMenu());
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

  private createSliders(): void {
    new SettingSlider(this, 270, 128, {
      label: 'MUSIC',
      value: audioSettings.getMusicVolume(),
      onChange: (value) => audioSettings.setMusicVolume(value),
    });

    new SettingSlider(this, 270, 198, {
      label: 'SFX',
      value: audioSettings.getSfxVolume(),
      onChange: (value) => audioSettings.setSfxVolume(value),
      onRelease: () => audioSettings.playUiTick(),
    });
  }

  private createFullscreenRow(): void {
    if (this.sys.game.device.input.touch) {
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

  private createControlsHelp(): void {
    const x = 560;
    const y = 108;
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.ink, 0.72);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x + 10, y + 10),
        new Phaser.Geom.Point(x + 372, y + 10),
        new Phaser.Geom.Point(x + 352, y + 292),
        new Phaser.Geom.Point(x - 12, y + 292),
      ],
      true,
    );
    graphics.fillStyle(COLORS.panel, 0.96);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + 360, y),
        new Phaser.Geom.Point(x + 338, y + 280),
        new Phaser.Geom.Point(x - 22, y + 280),
      ],
      true,
    );
    graphics.lineStyle(3, COLORS.cyan);
    graphics.strokePoints(
      [
        new Phaser.Geom.Point(x, y),
        new Phaser.Geom.Point(x + 360, y),
        new Phaser.Geom.Point(x + 338, y + 280),
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
    const lines = [
      'MOBILE',
      'Left stick  move',
      'Right stick  aim / attack',
      'Block and dash near right stick',
      '',
      'PC',
      `${keyboard.up}${keyboard.left}${keyboard.down}${keyboard.right} / arrows  move`,
      'Mouse  aim',
      `${keyboard.attack} / click  attack`,
      `${keyboard.block}  block    ${keyboard.dash}  dash`,
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

  private createBackButton(): void {
    new ActionButton(this, 140, GAME_HEIGHT - 48, {
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
    this.cameras.main.fadeOut(180, 7, 10, 18);
    this.time.delayedCall(190, () => this.scene.start('MainMenu'));
  }
}
