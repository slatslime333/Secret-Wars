import Phaser from 'phaser';
import { createBackdrop } from '../ui/createBackdrop';
import { createLogo } from '../ui/createLogo';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, hex } from '../ui/theme';

export class TitleScene extends Phaser.Scene {
  private continuing = false;

  constructor() {
    super('Title');
  }

  create(): void {
    createBackdrop(this, { accent: COLORS.redBright, embers: true });
    this.createSlashAccents();

    const logo = createLogo(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 1);
    logo.setAlpha(0).setScale(1.18);

    this.tweens.add({
      targets: logo,
      alpha: 1,
      scale: 1,
      duration: 520,
      ease: 'Stepped',
      easeParams: [7],
    });

    this.cameras.main.shake(180, 0.006);

    const prompt = this.add
      .text(GAME_WIDTH / 2, 440, this.getContinuePrompt(), {
        fontFamily: FONTS.display,
        fontSize: '21px',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const promptBar = this.add.rectangle(GAME_WIDTH / 2, 440, 420, 44, COLORS.ink, 0.82);
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
      .text(24, GAME_HEIGHT - 22, 'PRE-ALPHA // UI PROTOTYPE', {
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
  }

  private getContinuePrompt(): string {
    return this.sys.game.device.input.touch ? 'TAP TO CONTINUE' : 'CLICK OR PRESS ENTER';
  }

  private continue(): void {
    if (this.continuing) {
      return;
    }

    this.continuing = true;
    this.cameras.main.flash(90, 246, 241, 222);
    this.cameras.main.fadeOut(260, 7, 10, 18);
    this.time.delayedCall(270, () => this.scene.start('Home'));
  }

  private createSlashAccents(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.paper, 0.06);
    for (let x = -130; x < GAME_WIDTH + 100; x += 150) {
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
