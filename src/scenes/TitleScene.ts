import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { createBackdrop } from '../ui/createBackdrop';
import { createLogo } from '../ui/createLogo';
import { COLORS, FONTS, hex } from '../ui/theme';
import { audio } from '../audio';
import { fadeToScene } from './fadeToScene';
import { resetUiCamera } from '../ui/layout/viewport';

export class TitleScene extends Phaser.Scene {
  private continuing = false;

  constructor() {
    super('Title');
  }

  create(): void {
    resetUiCamera(this);
    const width = this.scale.width;
    const height = this.scale.height;

    createBackdrop(this, { accent: COLORS.redBright, embers: true });
    this.createSlashAccents(width);

    const logoY = height < 600 ? height * 0.4 : height * 0.42;
    const logoScale = Math.min(1, (width - 40) / 600);
    const logo = createLogo(this, width / 2, logoY, logoScale);
    logo.setAlpha(0).setScale(logoScale * 1.18);

    this.tweens.add({
      targets: logo,
      alpha: 1,
      scale: logoScale,
      duration: 520,
      ease: 'Stepped',
      easeParams: [7],
    });

    const promptY = height < 600 ? height - 76 : height * 0.78;
    const prompt = this.add
      .text(width / 2, promptY, this.getContinuePrompt(), {
        fontFamily: FONTS.display,
        fontSize: '21px',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const barWidth = Math.min(420, width - 40);
    const promptBar = this.add.rectangle(width / 2, promptY, barWidth, 44, COLORS.ink, 0.82);
    promptBar.setStrokeStyle(2, COLORS.redBright);
    prompt.setDepth(1);

    this.tweens.add({
      targets: [prompt, promptBar],
      alpha: 0.35,
      duration: 680,
      ease: 'Stepped',
      easeParams: [4],
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(24, height - 22, 'PRE-ALPHA // DEMO 1', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0, 1);

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.continue());
    this.input.keyboard?.once('keydown-ENTER', () => this.continue());
    this.input.keyboard?.once('keydown-SPACE', () => this.continue());

    const onResize = () => {
      if (!this.continuing) {
        this.scene.restart();
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private getContinuePrompt(): string {
    return isTouchPrimary() ? 'TAP TO CONTINUE' : 'CLICK OR PRESS ENTER';
  }

  private continue(): void {
    if (this.continuing) {
      return;
    }

    this.continuing = true;
    audio.unlock();
    audio.startMusic();
    audio.play('ui-confirm');
    this.cameras.main.flash(90, 246, 241, 222);
    fadeToScene(this, 'MainMenu', 260);
  }

  private createSlashAccents(width: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.paper, 0.06);
    for (let x = -130; x < width + 100; x += 150) {
      graphics.fillPoints(
        [
          new Phaser.Geom.Point(x, 85),
          new Phaser.Geom.Point(x + 96, 62),
          new Phaser.Geom.Point(x + 66, 100),
          new Phaser.Geom.Point(x - 28, 120),
        ],
        true,
      );
    }
  }
}
