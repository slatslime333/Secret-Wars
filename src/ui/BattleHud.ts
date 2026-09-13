import Phaser from 'phaser';
import { BlockController } from '../combat/BlockController';
import { DashController } from '../combat/DashController';
import { isTouchPrimary } from '../device';
import { NinjaBody } from '../heroes/NinjaBody';
import { layoutHudChrome } from './layout/hudChrome';
import { measureViewport } from './layout/viewport';
import { isPcCombatHud, layoutPcCombatHud } from './pcCombatHud';
import { COLORS, FONTS, hex } from './theme';

export class BattleHud {
  private readonly ninjaFill: Phaser.GameObjects.Rectangle;
  private readonly shieldFill: Phaser.GameObjects.Rectangle;
  private readonly staminaFill: Phaser.GameObjects.Rectangle;
  private readonly hpTrack: Phaser.GameObjects.Rectangle;
  private readonly staminaTrack: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly foeFill: Phaser.GameObjects.Rectangle;
  private readonly foeShieldFill: Phaser.GameObjects.Rectangle;
  private readonly foeStaminaFill: Phaser.GameObjects.Rectangle;
  private readonly foeBar: Phaser.GameObjects.Container;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly verbText: Phaser.GameObjects.Text;
  private readonly foeCaption: Phaser.GameObjects.Text;
  private readonly touch: boolean;
  private barWidth = 224;

  constructor(scene: Phaser.Scene) {
    this.touch = isTouchPrimary();
    const width = scene.scale.width;
    const height = scene.scale.height;
    this.hpTrack = scene.add.rectangle(148, 56, 224, 10, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.staminaTrack = scene.add.rectangle(148, 70, 224, 8, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.shieldFill = scene.add.rectangle(36, 56, 0, 10, COLORS.green).setOrigin(0, 0.5);
    this.shieldFill.setScrollFactor(0).setDepth(102);
    this.ninjaFill = scene.add.rectangle(36, 56, 224, 10, COLORS.redBright).setOrigin(0, 0.5);
    this.ninjaFill.setScrollFactor(0).setDepth(103);
    this.staminaFill = scene.add.rectangle(36, 70, 224, 8, COLORS.cyan).setOrigin(0, 0.5);
    this.staminaFill.setScrollFactor(0).setDepth(102);
    this.hpText = scene.add
      .text(36, 42, '', {
        fontFamily: FONTS.body,
        fontSize: '18px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);

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
      .text(width - 30, 82, this.touch ? 'HOLD SHIELD   DASH 3/3' : 'WASD MOVE   SPACE SHIELD   SHIFT DASH   Q E F  ·  CLICK TO AIM', {
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
    this.foeShieldFill = scene.add.rectangle(-36, 0, 0, 6, COLORS.green).setOrigin(0, 0.5);
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
    this.foeBar.add([track, this.foeShieldFill, this.foeFill, foeStaminaTrack, this.foeStaminaFill, this.foeCaption]);
    this.foeBar.setVisible(false);
    this.layout(width, height);
  }

  layout(width: number, height: number): void {
    this.comboText.setX(width / 2);
    if (!isPcCombatHud()) {
      const chrome = layoutHudChrome(measureViewport(width, height));
      this.barWidth = chrome.bars.width;
      const cx = chrome.bars.x + chrome.bars.width / 2;
      this.hpTrack.setPosition(cx, chrome.bars.hpY).setSize(chrome.bars.width, chrome.bars.hpH);
      this.staminaTrack.setPosition(cx, chrome.bars.staminaY).setSize(chrome.bars.width, chrome.bars.stamH);
      this.ninjaFill.setPosition(chrome.bars.x, chrome.bars.hpY).setSize(this.ninjaFill.width || chrome.bars.width, chrome.bars.hpH);
      this.shieldFill.setPosition(chrome.bars.x, chrome.bars.hpY).setSize(this.shieldFill.width || 0, chrome.bars.hpH);
      this.staminaFill.setPosition(chrome.bars.x, chrome.bars.staminaY).setSize(this.staminaFill.width || chrome.bars.width, chrome.bars.stamH);
      this.hpText.setVisible(false);
      this.comboText.setY(chrome.comboY).setFontSize(chrome.titleVisible ? 18 : 15);
      this.verbText.setVisible(chrome.verbVisible);
      this.verbText.setPosition(width - 30, chrome.bars.xpY).setOrigin(1, 0);
      return;
    }
    const hud = layoutPcCombatHud(width, height);
    this.barWidth = hud.barWidth;
    this.hpTrack.setPosition(hud.barLeft + hud.barWidth / 2, hud.hpY).setSize(hud.barWidth, hud.hpHeight);
    this.staminaTrack.setPosition(hud.barLeft + hud.barWidth / 2, hud.staminaY).setSize(hud.barWidth, hud.staminaHeight);
    this.ninjaFill.setPosition(hud.barLeft, hud.hpY).setSize(this.ninjaFill.width || hud.barWidth, hud.hpHeight);
    this.shieldFill.setPosition(hud.barLeft, hud.hpY).setSize(this.shieldFill.width || 0, hud.hpHeight);
    this.staminaFill.setPosition(hud.barLeft, hud.staminaY).setSize(this.staminaFill.width || hud.barWidth, hud.staminaHeight);
    this.hpText.setVisible(true).setPosition(hud.barLeft, hud.hpY - 22).setOrigin(0, 0.5);
    this.verbText.setVisible(true).setPosition(width / 2, hud.hpY - 42).setOrigin(0.5, 1);
  }

  placeCombo(x: number, y: number): void {
    this.comboText.setPosition(x, y);
  }

  setVisible(visible: boolean): void {
    this.hpTrack.setVisible(visible);
    this.staminaTrack.setVisible(visible);
    this.ninjaFill.setVisible(visible);
    this.shieldFill.setVisible(visible);
    this.staminaFill.setVisible(visible);
    this.hpText.setVisible(visible && isPcCombatHud());
    this.comboText.setVisible(visible);
    this.verbText.setVisible(visible && !this.touch);
    if (!visible) {
      this.foeBar.setVisible(false);
    }
  }

  sync(
    ninja: NinjaBody,
    rival: NinjaBody | undefined,
    now: number,
    comboStep: number,
    block: BlockController,
    dash: DashController,
    spectator = false,
  ): void {
    const maxHp = Math.max(1, ninja.stats.maxHealth);
    const hpRatio = ninja.health / maxHp;
    const shield = ninja.shieldAmount(now);
    const shieldRatio = shield / maxHp;
    this.ninjaFill.width = this.barWidth * hpRatio;
    if (hpRatio >= 0.999) {
      this.shieldFill.x = this.ninjaFill.x;
      this.shieldFill.width = this.barWidth + this.barWidth * shieldRatio;
      this.shieldFill.height = this.ninjaFill.height;
    } else {
      this.shieldFill.x = this.ninjaFill.x + this.ninjaFill.width;
      this.shieldFill.width = this.barWidth * Math.min(shieldRatio, 1 - hpRatio + shieldRatio);
      this.shieldFill.height = this.ninjaFill.height;
    }
    this.shieldFill.setVisible(shield > 0);
    const stamRatio = ninja.stamina / ninja.stats.maxStamina;
    this.staminaFill.width = this.barWidth * stamRatio;
    this.staminaFill.setFillStyle(ninja.staminaDeniedRecently(now) ? COLORS.orange : COLORS.cyan);
    const hpLabel = shield > 0
      ? `${Math.max(0, Math.ceil(ninja.health))} +${Math.ceil(shield)} / ${ninja.stats.maxHealth}`
      : `${Math.max(0, Math.ceil(ninja.health))} / ${ninja.stats.maxHealth}`;
    this.hpText.setText(hpLabel);

    if (!rival) {
      this.foeBar.setVisible(false);
    } else {
      this.foeBar.setVisible(true);
      this.foeBar.setPosition(rival.x, rival.y - 44);
      const foeMax = Math.max(1, rival.stats.maxHealth);
      const foeHp = rival.health / foeMax;
      const foeShield = rival.shieldAmount(now) / foeMax;
      this.foeFill.width = Math.max(0, 72 * foeHp);
      if (foeHp >= 0.999 && foeShield > 0) {
        this.foeShieldFill.x = -36;
        this.foeShieldFill.width = 72 + 72 * foeShield;
      } else {
        this.foeShieldFill.x = -36 + this.foeFill.width;
        this.foeShieldFill.width = Math.max(0, 72 * foeShield);
      }
      this.foeShieldFill.setVisible(foeShield > 0);
      this.foeStaminaFill.width = Math.max(0, 72 * (rival.stamina / rival.stats.maxStamina));
    }

    this.comboText.setText(comboLabel(comboStep));
    this.comboText.setColor(hex(comboStep === 3 ? COLORS.yellow : COLORS.orange));
    if (spectator) {
      this.verbText.setText('');
      return;
    }
    const idleShield = this.touch ? 'HOLD SHIELD' : 'HOLD SPACE SHIELD';
    const shieldBit = block.isActive(now) ? (block.isPerfect(now) ? 'PERFECT' : 'SHIELD') : idleShield;
    const dashBit = dash.isActive(now)
      ? 'DASHING'
      : this.touch
        ? `DASH ${dash.chargeCount}/${dash.maxCharges}`
        : `SHIFT DASH ${dash.chargeCount}/${dash.maxCharges}`;
    const abilityBit = this.touch ? '' : '   Q E F AIM  ·  LMB FIRE';
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
