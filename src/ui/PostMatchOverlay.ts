import Phaser from 'phaser';
import { audio } from '../audio';
import { MATCH } from '../config/match';
import type { TeamId } from '../config/hero';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import type { TeamScore } from '../match/ScoreManager';
import { ActionButton } from './ActionButton';
import { ScrollPanel } from './layout/ScrollPanel';
import { measureViewport } from './layout/viewport';
import { adoptHud } from './layout/hudCamera';
import { ScoreboardPanel, scoreboardPanelWidth } from './ScoreboardView';
import { COLORS, FONTS, hex } from './theme';

export type PostMatchHandlers = {
  onRematch: () => void;
  onMenu: () => void;
};

export class PostMatchOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private visible = false;
  private scroller?: ScrollPanel;

  constructor(private readonly scene: Phaser.Scene, private readonly handlers: PostMatchHandlers) {
    this.root = scene.add.container(0, 0).setDepth(240).setScrollFactor(0).setVisible(false);
    adoptHud(scene, this.root);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  show(winner: TeamId | 'draw' | null, playerTeam: TeamId, lines: HeroStatLine[], score?: TeamScore): void {
    this.scroller?.destroy();
    this.scroller = undefined;
    this.root.removeAll(true);
    const frame = measureViewport(this.scene.scale.width, this.scene.scale.height);
    const width = frame.width;
    const height = frame.height;
    const inset = frame.contentInset;
    const result =
      winner === 'draw' || winner === null
        ? 'DRAW'
        : winner === playerTeam
          ? 'VICTORY'
          : 'DEFEAT';
    const resultColor = result === 'VICTORY' ? COLORS.cyan : result === 'DEFEAT' ? COLORS.redBright : COLORS.yellow;

    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.82);
    const title = this.scene.add
      .text(width / 2, inset.top + 8, result, {
        fontFamily: FONTS.display,
        fontSize: frame.isPortrait ? '28px' : '34px',
        color: hex(resultColor),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);
    const sub = this.scene.add
      .text(width / 2, inset.top + 42, 'MATCH REPORT', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);
    this.root.add([veil, title, sub]);

    const footerH = 72;
    const scrollY = inset.top + 78;
    const scrollH = Math.max(80, height - scrollY - footerH - inset.bottom);
    const areaW = width - inset.left - inset.right;
    const boardW = scoreboardPanelWidth(areaW);
    const boardX = inset.left + Math.round((areaW - boardW) / 2);
    this.scroller = new ScrollPanel(this.scene, boardX, scrollY, boardW, scrollH, {
      depth: 241,
      scrollFactor: 0,
    });
    const board = new ScoreboardPanel(
      this.scene,
      this.scroller.content,
      boardW,
      0,
      () => Boolean(this.scroller?.wasDragged),
    );
    board.onResizeContent((h) => this.scroller?.setContentSize(board.size.width, h + 8));
    board.render(lines, score ? { score, remainingMs: 0, finished: true } : undefined);
    this.scroller.setContentSize(board.size.width, board.size.height + 8);
    this.root.add(this.scroller.root);

    const btnW = Math.min(190, (width - inset.left - inset.right - 16) / 2);
    const btnY = height - inset.bottom - 28;
    const rematch = new ActionButton(this.scene, width / 2 - btnW / 2 - 8, btnY, {
      label: 'REMATCH',
      width: btnW,
      height: 48,
      primary: true,
      compact: true,
      onPress: () => this.handlers.onRematch(),
    });
    rematch.setScrollFactor(0).setDepth(241);
    rematch.disableInteractive();
    rematch.setVisible(false);
    const menu = new ActionButton(this.scene, width / 2 + btnW / 2 + 8, btnY, {
      label: 'MENU',
      width: btnW,
      height: 48,
      compact: true,
      onPress: () => this.handlers.onMenu(),
    });
    menu.setScrollFactor(0).setDepth(241);
    menu.disableInteractive();
    menu.setVisible(false);
    this.root.add([rematch, menu]);
    adoptHud(this.scene, this.root);
    this.root.setVisible(true);
    this.visible = true;
    audio.play(result === 'VICTORY' ? 'ui-victory' : result === 'DEFEAT' ? 'ui-defeat' : 'ui-draw');
    this.scene.time.delayedCall(MATCH.postMatch.actionDelayMs, () => {
      if (!this.visible) {
        return;
      }
      rematch.setVisible(true);
      menu.setVisible(true);
      rematch.setInteractive({ useHandCursor: true });
      menu.setInteractive({ useHandCursor: true });
    });
  }

  destroy(): void {
    this.scroller?.destroy();
    this.root.destroy();
  }
}
