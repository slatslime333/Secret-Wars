import Phaser from 'phaser';
import { isTouchPrimary } from '../device';
import { formatMatchClock } from '../match/MatchManager';
import type { MatchSnapshot } from '../match/MatchManager';
import type { TeamScore } from '../match/ScoreManager';
import type { Progression } from '../match/Progression';
import { layoutHudChrome } from './layout/hudChrome';
import { adoptHud } from './layout/hudCamera';
import { measureViewport } from './layout/viewport';
import { layoutPcCombatHud, PC_COMBAT_HUD } from './pcCombatHud';
import { COLORS, FONTS, hex } from './theme';

/** Live match chrome: clock, score, player level / XP. */
export class MatchHud {
  private readonly timer: Phaser.GameObjects.Text;
  private readonly phase: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly xpFill: Phaser.GameObjects.Rectangle;
  private readonly xpText: Phaser.GameObjects.Text;
  private readonly xpTrack: Phaser.GameObjects.Rectangle;
  private barWidth = 224;

  constructor(scene: Phaser.Scene) {
    const width = scene.scale.width;
    this.timer = scene.add
      .text(width / 2, 46, '3:00', {
        fontFamily: FONTS.display,
        fontSize: '22px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(104);

    this.phase = scene.add
      .text(width / 2, 70, '', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.yellow),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(104);

    this.score = scene.add
      .text(width / 2, 22, '0  —  0', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(104);

    this.xpTrack = scene.add.rectangle(148, 84, 224, 6, COLORS.inkSoft).setScrollFactor(0).setDepth(101);
    this.xpFill = scene.add.rectangle(36, 84, 224, 6, COLORS.yellow).setOrigin(0, 0.5);
    this.xpFill.setScrollFactor(0).setDepth(102);

    this.level = scene.add
      .text(36, 92, 'LV 1', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.yellow),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(102);

    this.xpText = scene.add
      .text(260, 92, '0 / 70 XP', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        fontStyle: 'bold',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(102);
    this.layout(width, scene.scale.height);
    adoptHud(scene, this.timer, this.phase, this.score, this.xpTrack, this.xpFill, this.level, this.xpText);
  }

  layout(width: number, height = 0): void {
    this.timer.setX(width / 2);
    this.phase.setX(width / 2);
    this.score.setX(width / 2);
    if (height <= 1 || isTouchPrimary()) {
      const chrome = layoutHudChrome(height > 1 ? measureViewport(width, height) : measureViewport(width));
      this.barWidth = chrome.bars.width;
      this.timer.setOrigin(0, 0).setX(chrome.match.x).setY(chrome.match.timerY).setFontSize(chrome.titleVisible ? 20 : 14);
      this.phase.setOrigin(0, 0).setX(chrome.match.x).setY(chrome.match.phaseY).setFontSize(10);
      this.score.setOrigin(0, 0).setX(chrome.match.x).setY(chrome.match.scoreY).setFontSize(chrome.titleVisible ? 16 : 13);
      const cx = chrome.bars.x + chrome.bars.width / 2;
      this.xpTrack.setPosition(cx, chrome.bars.xpY).setSize(chrome.bars.width, chrome.bars.xpH);
      this.xpFill.setPosition(chrome.bars.x, chrome.bars.xpY).setSize(this.xpFill.width || chrome.bars.width, chrome.bars.xpH);
      this.level.setPosition(chrome.bars.x, chrome.bars.xpY + 8).setOrigin(0, 0).setFontSize(10);
      this.xpText.setPosition(chrome.bars.x + chrome.bars.width, chrome.bars.xpY + 8).setOrigin(1, 0).setFontSize(10);
      return;
    }
    const hud = layoutPcCombatHud(width, height);
    this.barWidth = hud.barWidth;
    this.xpTrack.setPosition(hud.barLeft + hud.barWidth / 2, hud.xpY).setSize(hud.barWidth, PC_COMBAT_HUD.xpHeight);
    this.xpFill.setPosition(hud.barLeft, hud.xpY).setSize(this.xpFill.width || hud.barWidth, PC_COMBAT_HUD.xpHeight);
    this.level.setPosition(hud.barLeft, hud.xpY + 10).setOrigin(0, 0);
    this.xpText.setPosition(hud.barLeft + hud.barWidth, hud.xpY + 10).setOrigin(1, 0);
  }

  setVisible(visible: boolean): void {
    this.timer.setVisible(visible);
    this.phase.setVisible(visible);
    this.score.setVisible(visible);
    this.level.setVisible(visible);
    this.xpFill.setVisible(visible);
    this.xpText.setVisible(visible);
    this.xpTrack.setVisible(visible);
  }

  sync(match: MatchSnapshot, score: TeamScore, progression: Progression): void {
    this.timer.setText(formatMatchClock(match.remainingMs, match.phase));
    this.timer.setColor(hex(match.suddenDeath || match.overtime ? COLORS.yellow : COLORS.paper));
    this.phase.setText(match.phase === 'OVERTIME' ? 'OVERTIME' : match.phase === 'SUDDEN_DEATH' ? 'SUDDEN DEATH' : '');
    this.score.setText(`${score.alpha}  —  ${score.bravo}`);
    this.level.setText(`LV ${progression.level}`);
    const need = progression.xpToNext;
    this.xpText.setText(progression.atCap ? 'MAX' : `${Math.floor(progression.xp)} / ${need} XP`);
    this.xpFill.width = this.barWidth * progression.xpRatio;
  }
}
