import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { NinjaBody } from '../heroes/NinjaBody';
import { DummyTarget } from '../heroes/DummyTarget';
import { COLORS } from '../ui/theme';

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
    const track = scene.add.rectangle(0, 0, 64, 8, COLORS.ink, 0.9).setStrokeStyle(2, COLORS.paper);
    this.dummyFill = scene.add.rectangle(-32, 0, 64, 6, COLORS.red).setOrigin(0, 0.5);
    this.dummyBar.add([track, this.dummyFill]);
  }

  sync(ninja: NinjaBody, dummy: DummyTarget): void {
    this.ninjaFill.width = 224 * (ninja.health / NINJA.maxHealth);
    this.staminaFill.width = 224 * (ninja.stamina / NINJA.maxStamina);
    this.dummyBar.setPosition(dummy.x, dummy.y - 36);
    this.dummyFill.width = Math.max(0, 64 * (dummy.health / NINJA.maxHealth));
  }
}
