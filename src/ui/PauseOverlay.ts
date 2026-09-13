import Phaser from 'phaser';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import { ActionButton } from './ActionButton';
import { addScoreboard } from './ScoreboardView';
import { COLORS, FONTS, hex } from './theme';

export type PauseHandlers = {
  onContinue: () => void;
  onExit: () => void;
};

/** Full-screen pause: live scoreboard plus CONTINUE / EXIT. */
export class PauseOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: PauseHandlers,
  ) {
    this.root = scene.add.container(0, 0).setDepth(230).setScrollFactor(0).setVisible(false);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  show(lines: HeroStatLine[]): void {
    this.root.removeAll(true);
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.82);
    veil.setInteractive();
    const title = this.scene.add
      .text(width / 2, 28, 'PAUSED', {
        fontFamily: FONTS.display,
        fontSize: '32px',
        color: hex(COLORS.yellow),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);
    const sub = this.scene.add
      .text(width / 2, 66, 'SCOREBOARD', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.root.add([veil, title, sub]);
    addScoreboard(this.scene, this.root, lines, 96, width);

    const continueBtn = new ActionButton(this.scene, width / 2 - 110, height - 48, {
      label: 'CONTINUE',
      width: 190,
      height: 48,
      primary: true,
      compact: true,
      attachToScene: false,
      onPress: () => this.handlers.onContinue(),
    });
    continueBtn.setScrollFactor(0).setDepth(231);
    const exitBtn = new ActionButton(this.scene, width / 2 + 110, height - 48, {
      label: 'EXIT',
      width: 190,
      height: 48,
      compact: true,
      attachToScene: false,
      onPress: () => this.handlers.onExit(),
    });
    exitBtn.setScrollFactor(0).setDepth(231);
    this.root.add([continueBtn, exitBtn]);
    this.root.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.root.removeAll(true);
    this.root.setVisible(false);
    this.visible = false;
  }

  destroy(): void {
    this.root.destroy();
  }
}
