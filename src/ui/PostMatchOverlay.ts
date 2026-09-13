import Phaser from 'phaser';
import { audio } from '../audio';
import { MATCH } from '../config/match';
import type { TeamId } from '../config/hero';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import { ActionButton } from './ActionButton';
import { addScoreboard } from './ScoreboardView';
import { COLORS, FONTS, hex } from './theme';

export type PostMatchHandlers = {
  onRematch: () => void;
  onMenu: () => void;
};

export class PostMatchOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene, private readonly handlers: PostMatchHandlers) {
    this.root = scene.add.container(0, 0).setDepth(240).setScrollFactor(0).setVisible(false);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  show(winner: TeamId | 'draw' | null, playerTeam: TeamId, lines: HeroStatLine[]): void {
    this.root.removeAll(true);
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const result =
      winner === 'draw' || winner === null
        ? 'DRAW'
        : winner === playerTeam
          ? 'VICTORY'
          : 'DEFEAT';
    const resultColor = result === 'VICTORY' ? COLORS.cyan : result === 'DEFEAT' ? COLORS.redBright : COLORS.yellow;

    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.82);
    const title = this.scene.add
      .text(width / 2, 36, result, {
        fontFamily: FONTS.display,
        fontSize: '34px',
        color: hex(resultColor),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);
    const sub = this.scene.add
      .text(width / 2, 76, 'MATCH REPORT', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.root.add([veil, title, sub]);
    addScoreboard(this.scene, this.root, lines, 104, width);

    const rematch = new ActionButton(this.scene, width / 2 - 110, height - 48, {
      label: 'REMATCH',
      width: 190,
      height: 48,
      primary: true,
      compact: true,
      onPress: () => this.handlers.onRematch(),
    });
    rematch.setScrollFactor(0).setDepth(241);
    rematch.disableInteractive();
    rematch.setVisible(false);
    const menu = new ActionButton(this.scene, width / 2 + 110, height - 48, {
      label: 'MENU',
      width: 190,
      height: 48,
      compact: true,
      onPress: () => this.handlers.onMenu(),
    });
    menu.setScrollFactor(0).setDepth(241);
    menu.disableInteractive();
    menu.setVisible(false);
    this.root.add([rematch, menu]);
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
    this.root.destroy();
  }
}
