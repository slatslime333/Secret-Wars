import Phaser from 'phaser';
import type { HeroId } from '../heroes/roster';
import type { MatchFormat } from '../config/arena';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, hex } from '../ui/theme';
import { fittedMenuSubtitle, layoutMenuFooter, menuFooterReserve } from '../ui/layout/menuFooter';
import { measureViewport, resetUiCamera } from '../ui/layout/viewport';
import { fadeToScene } from './fadeToScene';

export type MatchFormatMode = 'play' | 'simulator';

export type MatchFormatData = {
  heroId?: HeroId;
  mode?: MatchFormatMode;
};

/** After fighter select or Simulator: 3v3 or 6v6. */
export class MatchFormatScene extends Phaser.Scene {
  private leaving = false;
  private heroId: HeroId = 'ninja';
  private mode: MatchFormatMode = 'play';

  constructor() {
    super('MatchFormat');
  }

  init(data: MatchFormatData = {}): void {
    this.heroId = data.heroId ?? 'ninja';
    this.mode = data.mode ?? 'play';
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
    const innerW = width - inset.left - inset.right;
    const portrait = frame.isPortrait;
    const footerH = menuFooterReserve(frame);

    this.add
      .text(width / 2, inset.top, 'WAR SIZE', {
        fontFamily: FONTS.display,
        fontSize: portrait ? '20px' : '24px',
        color: hex(COLORS.paper),
        letterSpacing: portrait ? 2 : 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    const subtitle = fittedMenuSubtitle(
      this,
      width / 2,
      inset.top + (portrait ? 24 : 30),
      '3V3 IS THE STANDARD WAR  //  6V6 ADDS A SECOND LINE',
      innerW,
      portrait,
    );

    const bodyTop = inset.top + (portrait ? 24 : 30) + subtitle.height + 12;
    const bodyBot = height - inset.bottom - footerH;
    const bodyH = Math.max(160, bodyBot - bodyTop);
    const stack = portrait || innerW < 500;
    if (stack) {
      const cardW = Math.min(300, innerW);
      const cardH = Math.min(120, Math.max(88, (bodyH - 12) / 2));
      const mid = bodyTop + bodyH / 2;
      this.drawChoice(width / 2, mid - cardH / 2 - 6, cardW, cardH, '3 VS 3', 'ONE OF EACH CLASS', '3v3');
      this.drawChoice(width / 2, mid + cardH / 2 + 6, cardW, cardH, '6 VS 6', 'TWO OF EACH CLASS', '6v6');
    } else {
      const cardW = Math.min(220, (innerW - 16) / 2);
      const cardH = Math.min(160, Math.max(110, bodyH - 8));
      const cy = bodyTop + bodyH / 2;
      this.drawChoice(width / 2 - cardW / 2 - 8, cy, cardW, cardH, '3 VS 3', 'ONE OF EACH CLASS', '3v3');
      this.drawChoice(width / 2 + cardW / 2 + 8, cy, cardW, cardH, '6 VS 6', 'TWO OF EACH CLASS', '6v6');
    }

    layoutMenuFooter(this, frame, [{ label: 'BACK', onPress: () => this.goBack() }]);

    this.input.keyboard?.on('keydown-ESC', () => this.goBack());
    this.input.keyboard?.on('keydown-THREE', () => this.pick('3v3'));
    this.input.keyboard?.on('keydown-SIX', () => this.pick('6v6'));

    const onResize = () => {
      if (!this.leaving) {
        this.scene.restart({ heroId: this.heroId, mode: this.mode });
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  private drawChoice(
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    title: string,
    detail: string,
    format: MatchFormat,
  ): void {
    const panel = this.add.rectangle(x, y, cardW, cardH, COLORS.panel, 0.96).setOrigin(0.5, 0.5);
    panel.setStrokeStyle(3, COLORS.cyan);
    panel.setInteractive({ useHandCursor: true });
    panel.on(Phaser.Input.Events.POINTER_UP, () => this.pick(format));
    this.add
      .text(x, y - cardH * 0.16, title, {
        fontFamily: FONTS.display,
        fontSize: cardH < 110 ? '22px' : '28px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
      })
      .setOrigin(0.5, 0.5);
    this.add
      .text(x, y + cardH * 0.18, detail, {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 1,
        align: 'center',
        wordWrap: { width: cardW - 20, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0.5);
  }

  private pick(format: MatchFormat): void {
    if (this.mode === 'simulator') {
      this.leaveTo('SimulatorSetup', { format });
      return;
    }
    this.leaveTo('RosterDraft', { heroId: this.heroId, format });
  }

  private goBack(): void {
    if (this.mode === 'simulator') {
      this.leaveTo('MainMenu');
      return;
    }
    this.leaveTo('CharacterSelect', { selected: this.heroId });
  }

  private leaveTo(sceneName: string, data?: object): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    fadeToScene(this, sceneName, 220, data);
  }
}
