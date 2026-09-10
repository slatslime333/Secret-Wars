import Phaser from 'phaser';
import { ActionButton } from '../ui/ActionButton';
import { createBackdrop } from '../ui/createBackdrop';
import { COLORS, FONTS, GAME_WIDTH, hex } from '../ui/theme';

export class PlaceholderScene extends Phaser.Scene {
  constructor() {
    super('Placeholder');
  }

  create(): void {
    createBackdrop(this, { accent: COLORS.redBright });
    this.cameras.main.fadeIn(220, 7, 10, 18);

    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.panel, 0.9);
    graphics.fillPoints(
      [
        new Phaser.Geom.Point(190, 110),
        new Phaser.Geom.Point(790, 110),
        new Phaser.Geom.Point(748, 400),
        new Phaser.Geom.Point(150, 400),
      ],
      true,
    );
    graphics.lineStyle(3, COLORS.redBright);
    graphics.strokePoints(
      [
        new Phaser.Geom.Point(190, 110),
        new Phaser.Geom.Point(790, 110),
        new Phaser.Geom.Point(748, 400),
        new Phaser.Geom.Point(150, 400),
      ],
      true,
    );

    this.add
      .text(GAME_WIDTH / 2, 178, 'BATTLE PROTOTYPE', {
        fontFamily: FONTS.display,
        fontSize: '40px',
        fontStyle: 'italic',
        color: hex(COLORS.paper),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        260,
        'HOME SCREEN COMPLETE\\nRECTANGLE FIGHTERS DEPLOY NEXT',
        {
          fontFamily: FONTS.body,
          fontSize: '17px',
          fontStyle: 'bold',
          color: hex(COLORS.muted),
          align: 'center',
          lineSpacing: 12,
          letterSpacing: 2,
        },
      )
      .setOrigin(0.5);

    new ActionButton(this, GAME_WIDTH / 2, 346, {
      label: 'RETURN HOME',
      width: 270,
      height: 58,
      onPress: () => this.returnHome(),
    });

    this.input.keyboard?.once('keydown-ESC', () => this.returnHome());
  }

  private returnHome(): void {
    this.cameras.main.fadeOut(180, 7, 10, 18);
    this.time.delayedCall(190, () => this.scene.start('Home'));
  }
}
