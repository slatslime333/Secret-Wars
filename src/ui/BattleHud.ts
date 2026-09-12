import Phaser from 'phaser';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { isTouchPrimary } from '../device';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS, FONTS, hex } from './theme';

export class BattleHud {
  private readonly ninjaFill: Phaser.GameObjects.Rectangle;
  private readonly staminaFill: Phaser.GameObjects.Rectangle;
  private readonly ammoFill: Phaser.GameObjects.Rectangle;
  private readonly ammoText: Phaser.GameObjects.Text;
  private readonly foeFill: Phaser.GameObjects.Rectangle;
  private readonly foeStaminaFill: Phaser.GameObjects.Rectangle;
  private readonly foeBar: Phaser.GameObjects.Container;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly verbText: Phaser.GameObjects.Text;
  private readonly foeCaption: Phaser.GameObjects.Text;
  private readonly touch: boolean;

  constructor(scene: Phaser.Scene) {
    this.touch = isTouchPrimary();
    const width = scene.scale.width;
    scene.add.rectangle(148, 56, 224, 10, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.ninjaFill = scene.add.rectangle(36, 56, 224, 10, COLORS.redBright).setOrigin(0, 0.5);
    this.ninjaFill.setScrollFactor(0).setDepth(102);

    scene.add.rectangle(148, 70, 224, 8, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.staminaFill = scene.add.rectangle(36, 70, 224, 8, COLORS.cyan).setOrigin(0, 0.5);
    this.staminaFill.setScrollFactor(0).setDepth(102);

    scene.add.rectangle(148, 84, 224, 6, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.ammoFill = scene.add.rectangle(36, 84, 224, 6, COLORS.orange).setOrigin(0, 0.5);
    this.ammoFill.setScrollFactor(0).setDepth(102);

    this.ammoText = scene.add
      .text(36, 94, 'ATTACK 7/7', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(102);

    this.comboText = scene.add
      .text(width / 2, 22, '', {
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
      .text(width - 30, 82, this.touch ? 'HOLD SHIELD   DASH 3/3' : 'HOLD K SHIELD   L DASH   Q/E/F ABILITIES', {
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
    const foeStaminaTrack = scene.add.rectangle(0, 9, 72, 6, COLORS.ink, 1);
    foeStaminaTrack.setStrokeStyle(1, COLORS.cyanDark);
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
    this.foeBar.add([track, this.foeFill, foeStaminaTrack, this.foeStaminaFill, this.foeCaption]);
    this.foeBar.setVisible(false);
  }

  layout(width: number): void {
    this.comboText.setX(width / 2);
    this.verbText.setX(width - 30);
  }

  sync(
    ninja: NinjaBody,
    rival: NinjaBody | undefined,
    now: number,
    comboStep: number,
    block: BlockController,
    dash: DashController,
  ): void {
    this.ninjaFill.width = 224 * (ninja.health / ninja.stats.maxHealth);
    this.staminaFill.width = 224 * (ninja.stamina / ninja.stats.maxStamina);
    this.staminaFill.setFillStyle(ninja.staminaDeniedRecently(now) ? COLORS.orange : COLORS.cyan);

    const ammo = ninja.ammoDisplay(now);
    this.ammoFill.width = 224 * (ammo.reloading ? ammo.reloadRatio : ammo.current / ammo.max);
    this.ammoFill.setFillStyle(ammo.reloading ? COLORS.yellow : COLORS.orange);
    this.ammoText.setText(`ATTACK ${ammo.reloading ? 0 : ammo.current}/${ammo.max}`);
    this.ammoText.setColor(hex(ammo.reloading ? COLORS.yellow : COLORS.paper));

    if (!rival) {
      this.foeBar.setVisible(false);
    } else {
      this.foeBar.setVisible(true);
      this.foeBar.setPosition(rival.x, rival.y - 44);
      this.foeFill.width = Math.max(0, 72 * (rival.health / rival.stats.maxHealth));
      this.foeStaminaFill.width = Math.max(0, 72 * (rival.stamina / rival.stats.maxStamina));
    }

    this.comboText.setText(comboLabel(comboStep));
    this.comboText.setColor(hex(comboStep === 3 ? COLORS.yellow : COLORS.orange));
    const idleShield = this.touch ? 'HOLD SHIELD' : 'HOLD K SHIELD';
    const shieldBit = block.isActive(now) ? (block.isPerfect(now) ? 'PERFECT' : 'SHIELD') : idleShield;
    const dashBit = dash.isActive(now)
      ? 'DASHING'
      : this.touch
        ? `DASH ${dash.chargeCount}/${dash.maxCharges}`
        : `L DASH ${dash.chargeCount}/${dash.maxCharges}`;
    const abilityBit = this.touch ? '' : '   Q E F';
    this.verbText.setText(`${shieldBit}   ${dashBit}${abilityBit}`);
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
