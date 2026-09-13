import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { COLORS, FONTS, hex } from './theme';

/** Centered respawn countdown plus a free-roam spectate hint. */
export class RespawnOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const width = scene.scale.width;
    const height = scene.scale.height;
    this.root = scene.add.container(0, 0).setDepth(160).setScrollFactor(0).setVisible(false);
    this.title = scene.add
      .text(width / 2, height / 2 - 10, 'RESPAWN  8', {
        fontFamily: FONTS.display,
        fontSize: '52px',
        color: hex(COLORS.yellow),
        letterSpacing: 6,
        stroke: hex(COLORS.ink),
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.hint = scene.add
      .text(
        width / 2,
        height / 2 + 42,
        isTouchPrimary() ? 'FREE ROAM  //  LEFT STICK' : 'FREE ROAM  //  LEFT STICK / WASD',
        {
          fontFamily: FONTS.body,
          fontSize: '14px',
          fontStyle: 'bold',
          color: hex(COLORS.paper),
          letterSpacing: 3,
          stroke: hex(COLORS.ink),
          strokeThickness: 5,
        },
      )
      .setOrigin(0.5);
    this.root.add([this.title, this.hint]);
  }

  sync(remainingMs: number, width: number, height: number): void {
    if (remainingMs <= 0) {
      this.root.setVisible(false);
      return;
    }
    this.root.setVisible(true);
    this.title.setPosition(width / 2, height / 2 - 10);
    this.hint.setPosition(width / 2, height / 2 + 42);
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    this.title.setText(`RESPAWN  ${seconds}`);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
