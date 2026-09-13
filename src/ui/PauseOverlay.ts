import Phaser from 'phaser';
import { audio, audioSettings } from '../audio';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import { ActionButton } from './ActionButton';
import { addScoreboard } from './ScoreboardView';
import { SettingSlider } from './SettingSlider';
import { COLORS, FONTS, hex } from './theme';

export type PauseHandlers = {
  onContinue: () => void;
  onExit: () => void;
};

/** Full-screen pause: live scoreboard, audio settings, CONTINUE / EXIT. */
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

    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.92);
    veil.setInteractive();
    const title = this.scene.add
      .text(width / 2, 22, 'PAUSED', {
        fontFamily: FONTS.display,
        fontSize: '32px',
        color: hex(COLORS.yellow),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);
    const sub = this.scene.add
      .text(width / 2, 58, 'SCOREBOARD  //  SETTINGS', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.root.add([veil, title, sub]);
    addScoreboard(this.scene, this.root, lines, 86, width);

    const sliderX = width / 2;
    const sliderY = height - 168;
    const music = new SettingSlider(this.scene, sliderX, sliderY, {
      label: 'MUSIC',
      value: audioSettings.getMusicVolume(),
      screenSpace: true,
      trackWidth: Math.min(320, width - 160),
      onChange: (value) => {
        audioSettings.setMusicVolume(value);
        audio.syncMusicVolume();
      },
    });
    music.setScrollFactor(0).setDepth(232);
    const sfx = new SettingSlider(this.scene, sliderX, sliderY + 58, {
      label: 'SFX',
      value: audioSettings.getSfxVolume(),
      screenSpace: true,
      trackWidth: Math.min(320, width - 160),
      onChange: (value) => audioSettings.setSfxVolume(value),
      onRelease: () => audioSettings.playUiTick(),
    });
    sfx.setScrollFactor(0).setDepth(232);
    this.root.add([music, sfx]);

    const continueBtn = new ActionButton(this.scene, width / 2 - 110, height - 40, {
      label: 'CONTINUE',
      width: 190,
      height: 44,
      primary: true,
      compact: true,
      attachToScene: false,
      onPress: () => this.handlers.onContinue(),
    });
    continueBtn.setScrollFactor(0).setDepth(231);
    const exitBtn = new ActionButton(this.scene, width / 2 + 110, height - 40, {
      label: 'EXIT',
      width: 190,
      height: 44,
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
