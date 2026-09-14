import Phaser from 'phaser';
import type { NinjaBody } from '../../heroes/NinjaBody';
import type { Progression } from '../../match/Progression';
import { COLORS, FONTS, hex } from '../theme';

/** Compact world-space HP + level plate above a hero. */
export class HeroPlate {
  private readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly shieldFill: Phaser.GameObjects.Rectangle;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly rageTrack: Phaser.GameObjects.Rectangle;
  private readonly rageFill: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    private readonly body: NinjaBody,
    private readonly progression: Progression,
    player: boolean,
  ) {
    const accent = body.team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const track = scene.add.rectangle(0, 0, 78, 8, COLORS.ink, 0.92);
    track.setStrokeStyle(1.5, accent);
    this.shieldFill = scene.add.rectangle(-39, 0, 0, 5, COLORS.green).setOrigin(0, 0.5);
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
    this.root = scene.add.container(body.x, body.y - 48, [track, this.shieldFill, this.fill, this.levelText]).setDepth(26);
    this.rageTrack = scene.add.rectangle(0, 8, 78, 4, COLORS.ink, 0.9);
    this.rageFill = scene.add.rectangle(-39, 8, 0, 3, 0xff6a18).setOrigin(0, 0.5);
    this.root.add([this.rageTrack, this.rageFill]);
    this.rageTrack.setVisible(false);
    this.rageFill.setVisible(false);
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
    const maxHp = Math.max(1, this.body.stats.maxHealth);
    const ratio = this.body.health / maxHp;
    const shield = this.body.shieldAmount() / maxHp;
    this.fill.width = Math.max(0, 78 * ratio);
    if (ratio >= 0.999 && shield > 0) {
      this.shieldFill.x = -39;
      this.shieldFill.width = 78 + 78 * shield;
    } else {
      this.shieldFill.x = -39 + this.fill.width;
      this.shieldFill.width = Math.max(0, 78 * shield);
    }
    this.shieldFill.setVisible(shield > 0);
    const showRage = this.body.heroId === 'demon';
    this.rageTrack.setVisible(showRage);
    this.rageFill.setVisible(showRage);
    if (showRage) {
      this.rageFill.width = Math.max(0, 78 * this.body.demonRage);
    }
    this.levelText.setText(`LV ${this.progression.level}`);
  }

  destroy(): void {
    this.root.destroy();
  }
}
