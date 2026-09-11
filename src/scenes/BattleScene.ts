import Phaser from 'phaser';
import { ActionButton } from '../ui/ActionButton';
import { createArena } from '../ui/createArena';
import { COLORS, FONTS, GAME_WIDTH, hex } from '../ui/theme';
import { fadeToScene } from './fadeToScene';

/**
 * Phase 1 battle shell. PLAY lands here. Combat systems arrive in later phases.
 */
export class BattleScene extends Phaser.Scene {
  private returning = false;

  constructor() {
    super('Battle');
  }

  create(): void {
    createArena(this);
    this.cameras.main.fadeIn(220, 7, 10, 18);
    this.createChrome();
    this.input.keyboard?.once('keydown-ESC', () => this.returnToMenu());
  }

  private createChrome(): void {
    const bar = this.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH, 44, COLORS.ink, 0.82);
    bar.setStrokeStyle(2, COLORS.paper);

    this.add
      .text(22, 22, 'SECRET WARS  //  COMBAT TEST', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(GAME_WIDTH / 2, 270, 'ARENA ONLINE', {
        fontFamily: FONTS.display,
        fontSize: '28px',
        fontStyle: 'italic',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.add
      .text(GAME_WIDTH / 2, 304, 'Fighters deploy next.', {
        fontFamily: FONTS.body,
        fontSize: '14px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    new ActionButton(this, GAME_WIDTH - 108, 22, {
      label: 'MENU',
      width: 150,
      height: 40,
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
