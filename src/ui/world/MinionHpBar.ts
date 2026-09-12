import Phaser from 'phaser';
import type { NinjaBody } from '../../heroes/NinjaBody';
import { COLORS } from '../theme';

/** Small team-tinted HP pip above a minion. */
export class MinionHpBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, private readonly body: NinjaBody) {
    const accent = body.team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const track = scene.add.rectangle(0, 0, 28, 4, COLORS.ink, 0.85);
    track.setStrokeStyle(1, accent, 0.8);
    this.fill = scene.add.rectangle(-14, 0, 28, 2, accent).setOrigin(0, 0.5);
    this.root = scene.add.container(body.x, body.y - 22, [track, this.fill]).setDepth(22);
  }

  sync(): void {
    if (this.body.down || !this.body.isPresent) {
      this.root.setVisible(false);
      return;
    }
    this.root.setVisible(true);
    this.root.setPosition(this.body.x, this.body.y - 22);
    const ratio = this.body.stats.maxHealth > 0 ? this.body.health / this.body.stats.maxHealth : 0;
    this.fill.width = Math.max(0, 28 * ratio);
  }

  destroy(): void {
    this.root.destroy();
  }
}
