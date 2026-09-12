import Phaser from 'phaser';
import type { NinjaBody } from '../../heroes/NinjaBody';
import type { Progression } from '../../match/Progression';
import { COLORS, FONTS, hex } from '../theme';

/** Compact world-space HP + level plate above a hero. */
export class HeroPlate {
  private readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly levelText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly body: NinjaBody,
    private readonly progression: Progression,
    player: boolean,
  ) {
    const accent = body.team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const track = scene.add.rectangle(0, 0, 78, 8, COLORS.ink, 0.92);
    track.setStrokeStyle(1.5, accent);
    this.fill = scene.add.rectangle(-39, 0, 78, 5, player ? COLORS.redBright : COLORS.paper).setOrigin(0, 0.5);
    this.levelText = scene.add
      .text(0, -12, 'LV 1', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
    this.root = scene.add.container(body.x, body.y - 48, [track, this.fill, this.levelText]).setDepth(26);
  }

  setVisible(value: boolean): void {
    this.root.setVisible(value);
  }

  sync(): void {
    if (!this.body.isPresent) {
      this.root.setVisible(false);
      return;
    }
    this.root.setVisible(true);
    this.root.setPosition(this.body.x, this.body.y - 48);
    const ratio = this.body.stats.maxHealth > 0 ? this.body.health / this.body.stats.maxHealth : 0;
    this.fill.width = Math.max(0, 78 * ratio);
    this.levelText.setText(`LV ${this.progression.level}`);
  }

  destroy(): void {
    this.root.destroy();
  }
}
