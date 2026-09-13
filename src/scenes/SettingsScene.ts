import Phaser from 'phaser';
import { audio, audioSettings } from '../audio';
import { INPUT } from '../config/input';
import { isTouchPrimary } from '../device';
import { cameraPrefs } from '../config/cameraPrefs';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { SettingSlider } from '../ui/SettingSlider';
import { ScrollPanel } from '../ui/layout/ScrollPanel';
import { measureViewport } from '../ui/layout/viewport';
import { COLORS, FONTS, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';

export class SettingsScene extends Phaser.Scene {
  private returning = false;
  private fullscreenButton?: ActionButton;
  private bodyScroll?: ScrollPanel;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.returning = false;
    createBackdrop(this, { accent: COLORS.cyan });
    this.cameras.main.fadeIn(220, 7, 10, 18);

    const frame = measureViewport(this.scale.width, this.scale.height);
    const width = frame.width;
    const height = frame.height;
    const inset = frame.contentInset;
    const footerH = frame.isPortrait ? 120 : 64;

    this.createHeader(inset.top, frame.isPortrait);
    const scrollY = inset.top + (frame.isPortrait ? 72 : 88);
    const scrollH = Math.max(120, height - scrollY - footerH - inset.bottom);
    this.bodyScroll = new ScrollPanel(this, inset.left, scrollY, width - inset.left - inset.right, scrollH);
    this.createBody(this.bodyScroll, width - inset.left - inset.right, frame.isPortrait);
    this.createBackButton(width, height, frame.isPortrait, inset.bottom);

    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);

    const onResize = () => {
      if (!this.returning) {
        this.scene.restart();
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bodyScroll?.destroy();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    });
  }

  private createHeader(top: number, isPortrait: boolean): void {
    this.add
      .text(this.scale.width / 2, top, 'SETTINGS', {
        fontFamily: FONTS.display,
        fontSize: isPortrait ? '28px' : '36px',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(isPortrait ? 0.5 : 0, 0)
      .setX(isPortrait ? this.scale.width / 2 : 40);

    this.add
      .text(isPortrait ? this.scale.width / 2 : 42, top + 40, 'AUDIO  //  DISPLAY  //  CONTROLS', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(isPortrait ? 0.5 : 0, 0);
  }

    private createBody(scroll: ScrollPanel, innerW: number, isPortrait: boolean): void {
    const sliderX = innerW / 2;
    const music = new SettingSlider(this, sliderX, 36, {
      label: 'MUSIC',
      value: audioSettings.getMusicVolume(),
      trackWidth: Math.min(360, innerW - 80),
      onChange: (value) => {
        audioSettings.setMusicVolume(value);
        audio.syncMusicVolume();
      },
    });
    const sfx = new SettingSlider(this, sliderX, 106, {
      label: 'SFX',
      value: audioSettings.getSfxVolume(),
      trackWidth: Math.min(360, innerW - 80),
      onChange: (value) => audioSettings.setSfxVolume(value),
      onRelease: () => audioSettings.playUiTick(),
    });
    const fov = new SettingSlider(this, sliderX, 176, {
      label: 'CAMERA / FIELD OF VIEW',
      value: cameraPrefs.getFov(),
      trackWidth: Math.min(360, innerW - 80),
      onChange: (value) => cameraPrefs.setFov(value),
    });
    const fovHint = this.add.text(sliderX, 214, 'LOW ZOOMS IN          HIGH ZOOMS OUT', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: hex(COLORS.muted),
      letterSpacing: 2,
    }).setOrigin(0.5, 0);
    scroll.add(music);
    scroll.add(sfx);
    scroll.add(fov);
    scroll.add(fovHint);

    let y = 244;
    if (!isTouchPrimary() && !isPortrait) {
      const display = this.add.text(8, y, 'DISPLAY', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      });
      scroll.add(display);
      this.fullscreenButton = new ActionButton(this, 128, y + 44, {
        label: this.fullscreenLabel(),
        width: 250,
        height: 48,
        attachToScene: false,
        onPress: () => this.toggleFullscreen(),
      });
      scroll.add(this.fullscreenButton);
      this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, this.syncFullscreenLabel, this);
      this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.syncFullscreenLabel, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, this.syncFullscreenLabel, this);
        this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.syncFullscreenLabel, this);
      });
      y += 110;
    }

    y += this.createControlsHelp(scroll, innerW, y, isPortrait);
    scroll.setContentSize(innerW, y + 24);
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

  private createControlsHelp(
    scroll: ScrollPanel,
    innerW: number,
    y: number,
    isPortrait: boolean,
  ): number {
    const cardW = Math.min(isPortrait ? innerW : 420, innerW);
    const cardH = 250;
    const x = (innerW - cardW) / 2;
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
    const heading = this.add.text(x + 22, y + 16, 'CONTROLS', {
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
    const body = this.add.text(x + 22, y + 48, lines.join('\n'), {
      fontFamily: FONTS.body,
      fontSize: '13px',
      fontStyle: 'bold',
      color: hex(COLORS.paper),
      lineSpacing: 5,
    });
    scroll.add(graphics);
    scroll.add(heading);
    scroll.add(body);
    return cardH + 16;
  }

  private createBackButton(width: number, height: number, isPortrait: boolean, bottomInset: number): void {
    const btnY = height - bottomInset - 28;
    const btnX = isPortrait ? width / 2 : 140;
    const editX = isPortrait ? width / 2 : 340;
    const editY = isPortrait ? btnY - 56 : btnY;
    new ActionButton(this, editX, editY, {
      label: 'EDIT BUTTONS',
      width: isPortrait ? Math.min(220, width - 48) : 200,
      height: 52,
      onPress: () => {
        if (this.returning) {
          return;
        }
        this.returning = true;
        fadeToScene(this, 'ControlLayout');
      },
    });
    new ActionButton(this, btnX, btnY, {
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
