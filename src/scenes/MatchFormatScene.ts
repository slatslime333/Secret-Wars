import Phaser from 'phaser';
import type { HeroId } from '../heroes/roster';
import type { MatchFormat } from '../config/arena';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { measureViewport, resetUiCamera } from '../ui/layout/viewport';
import { fadeToScene } from './fadeToScene';

export type MatchFormatData = {
  heroId?: HeroId;
};

/** After fighter select: 3v3 or 6v6. */
export class MatchFormatScene extends Phaser.Scene {
  private leaving = false;
  private heroId: HeroId = 'ninja';

  constructor() {
    super('MatchFormat');
  }

  init(data: MatchFormatData = {}): void {
    this.heroId = data.heroId ?? 'ninja';
  }

  create(): void {
    this.leaving = false;
    resetUiCamera(this);
    createBackdrop(this, { accent: COLORS.yellow, embers: true });
    this.cameras.main.fadeIn(220, 7, 10, 18);

    const frame = measureViewport(this.scale.width, this.scale.height);
    const width = frame.width;
    const height = frame.height;
    const inset = frame.contentInset;

    this.add
      .text(width / 2, inset.top, 'WAR SIZE', {
        fontFamily: FONTS.display,
        fontSize: '24px',
        color: hex(COLORS.paper),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(width / 2, inset.top + 30, '3V3 IS THE STANDARD WAR  //  6V6 ADDS A SECOND LINE', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0);

    this.drawChoice(width / 2 - 130, height / 2 - 20, '3 VS 3', '6 FIGHTERS  //  STANDARD MAP', '3v3');
    this.drawChoice(width / 2 + 130, height / 2 - 20, '6 VS 6', '12 FIGHTERS  //  MAP +65%', '6v6');

    new ActionButton(this, inset.left + 70, height - inset.bottom - 28, {
      label: 'BACK',
      width: 140,
      height: 40,
      compact: true,
      onPress: () => this.leaveTo('CharacterSelect', { selected: this.heroId }),
    });

    this.input.keyboard?.on('keydown-ESC', () => this.leaveTo('CharacterSelect', { selected: this.heroId }));
    this.input.keyboard?.on('keydown-THREE', () => this.pick('3v3'));
    this.input.keyboard?.on('keydown-SIX', () => this.pick('6v6'));

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart({ heroId: this.heroId });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private drawChoice(x: number, y: number, title: string, detail: string, format: MatchFormat): void {
    const panel = this.add.rectangle(x, y, 220, 160, COLORS.panel, 0.96).setOrigin(0.5, 0.5);
    panel.setStrokeStyle(3, COLORS.cyan);
    panel.setInteractive({ useHandCursor: true });
    panel.on(Phaser.Input.Events.POINTER_UP, () => this.pick(format));
    this.add
      .text(x, y - 28, title, {
        fontFamily: FONTS.display,
        fontSize: '28px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0.5);
    this.add
      .text(x, y + 18, detail, {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0.5);
  }

  private pick(format: MatchFormat): void {
    this.leaveTo('RosterDraft', { heroId: this.heroId, format });
  }

  private leaveTo(sceneName: string, data?: object): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    fadeToScene(this, sceneName, 220, data);
  }
}
