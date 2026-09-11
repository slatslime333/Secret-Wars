import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { NinjaBody } from '../heroes/NinjaBody';
import { DummyTarget } from '../heroes/DummyTarget';
import { COLORS, FONTS, hex } from '../ui/theme';

export class BattleHud {
  private readonly ninjaFill: Phaser.GameObjects.Rectangle;
  private readonly staminaFill: Phaser.GameObjects.Rectangle;
  private readonly dummyFill: Phaser.GameObjects.Rectangle;
  private readonly dummyBar: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    scene.add.rectangle(148, 56, 224, 10, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.ninjaFill = scene.add.rectangle(36, 56, 224, 10, COLORS.redBright).setOrigin(0, 0.5);
    this.ninjaFill.setScrollFactor(0).setDepth(102);

    scene.add.rectangle(148, 70, 224, 8, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.staminaFill = scene.add.rectangle(36, 70, 224, 8, COLORS.cyan).setOrigin(0, 0.5);
    this.staminaFill.setScrollFactor(0).setDepth(102);

    this.dummyBar = scene.add.container(0, 0).setDepth(20);
    const track = scene.add.rectangle(0, 0, 72, 10, COLORS.ink, 1);
    track.setStrokeStyle(2, COLORS.redBright);
    this.dummyFill = scene.add.rectangle(-36, 0, 72, 6, COLORS.paper).setOrigin(0, 0.5);
    const caption = scene.add
      .text(0, -14, 'HP', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
    this.dummyBar.add([track, this.dummyFill, caption]);
  }

  sync(ninja: NinjaBody, dummy: DummyTarget): void {
    this.ninjaFill.width = 224 * (ninja.health / NINJA.maxHealth);
    this.staminaFill.width = 224 * (ninja.stamina / NINJA.maxStamina);
    this.dummyBar.setPosition(dummy.x, dummy.y - 40);
    this.dummyFill.width = Math.max(0, 72 * (dummy.health / NINJA.maxHealth));
  }
}
