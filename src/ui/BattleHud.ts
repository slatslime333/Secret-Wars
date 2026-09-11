import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { COMBAT } from '../config/combat';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS, FONTS, GAME_WIDTH, hex } from './theme';

export class BattleHud {
  private readonly ninjaFill: Phaser.GameObjects.Rectangle;
  private readonly staminaFill: Phaser.GameObjects.Rectangle;
  private readonly foeFill: Phaser.GameObjects.Rectangle;
  private readonly foeStaminaFill: Phaser.GameObjects.Rectangle;
  private readonly foeBar: Phaser.GameObjects.Container;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly verbText: Phaser.GameObjects.Text;
  private readonly foeCaption: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    scene.add.rectangle(148, 56, 224, 10, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.ninjaFill = scene.add.rectangle(36, 56, 224, 10, COLORS.redBright).setOrigin(0, 0.5);
    this.ninjaFill.setScrollFactor(0).setDepth(102);

    scene.add.rectangle(148, 70, 224, 8, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.staminaFill = scene.add.rectangle(36, 70, 224, 8, COLORS.cyan).setOrigin(0, 0.5);
    this.staminaFill.setScrollFactor(0).setDepth(102);

    this.comboText = scene.add
      .text(GAME_WIDTH / 2, 22, '', {
        fontFamily: FONTS.display,
        fontSize: '20px',
        color: hex(COLORS.orange),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    this.verbText = scene.add
      .text(GAME_WIDTH - 30, 82, 'K BLOCK   L DASH', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(102);

    this.foeBar = scene.add.container(0, 0).setDepth(20);
    const track = scene.add.rectangle(0, 0, 72, 10, COLORS.ink, 1);
    track.setStrokeStyle(2, COLORS.redBright);
    this.foeFill = scene.add.rectangle(-36, 0, 72, 6, COLORS.paper).setOrigin(0, 0.5);
    const staminaTrack = scene.add.rectangle(0, 9, 72, 6, COLORS.ink, 1);
    staminaTrack.setStrokeStyle(1, COLORS.cyanDark);
    this.foeStaminaFill = scene.add.rectangle(-36, 9, 72, 4, COLORS.cyan).setOrigin(0, 0.5);
    this.foeCaption = scene.add
      .text(0, -14, 'RIVAL', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
    this.foeBar.add([track, this.foeFill, staminaTrack, this.foeStaminaFill, this.foeCaption]);
    this.foeBar.setVisible(false);
  }

  sync(
    ninja: NinjaBody,
    rival: NinjaBody | undefined,
    now: number,
    comboStep: number,
    block: BlockController,
    dash: DashController,
  ): void {
    this.ninjaFill.width = 224 * (ninja.health / NINJA.maxHealth);
    this.staminaFill.width = 224 * (ninja.stamina / NINJA.maxStamina);
    this.staminaFill.setFillStyle(ninja.staminaDeniedRecently(now) ? COLORS.orange : COLORS.cyan);

    if (!rival) {
      this.foeBar.setVisible(false);
    } else {
      this.foeBar.setVisible(true);
      this.foeBar.setPosition(rival.x, rival.y - 44);
      this.foeFill.width = Math.max(0, 72 * (rival.health / NINJA.maxHealth));
      this.foeStaminaFill.width = Math.max(0, 72 * (rival.stamina / NINJA.maxStamina));
    }

    this.comboText.setText(comboLabel(comboStep));
    this.comboText.setColor(hex(comboStep === 3 ? COLORS.yellow : COLORS.orange));
    const blockCd = block.cooldownRatio(now);
    const dashCd = dash.cooldownRatio(now);
    const dashSeconds = Math.ceil(COMBAT.dashCooldownMs / 1000);
    const blockSeconds = Math.ceil(COMBAT.blockCooldownMs / 1000);
    const blockBit = block.isActive(now) ? 'BLOCKING' : blockCd > 0 ? `K ${Math.ceil(blockCd * blockSeconds)}s` : 'K BLOCK';
    const dashBit = dash.isActive(now) ? 'DASHING' : dashCd > 0 ? `L ${Math.ceil(dashCd * dashSeconds)}s` : 'L DASH';
    this.verbText.setText(`${blockBit}   ${dashBit}`);
  }
}

const comboLabel = (step: number): string => {
  if (step === 1) {
    return 'HIT 1';
  }
  if (step === 2) {
    return 'HIT 2';
  }
  if (step === 3) {
    return 'FINISHER';
  }
  return '';
};
