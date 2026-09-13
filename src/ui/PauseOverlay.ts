import Phaser from 'phaser';
import { audio, audioSettings } from '../audio';
import type { HeroStatLine } from '../match/CombatStatsTracker';
import { ActionButton } from './ActionButton';
import { ScrollPanel } from './layout/ScrollPanel';
import { applyGameplayCamera, measureViewport } from './layout/viewport';
import { adoptHud } from './layout/hudCamera';
import { addScoreboardSized } from './ScoreboardView';
import { cameraPrefs } from '../config/cameraPrefs';
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
  private scroller?: ScrollPanel;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: PauseHandlers,
  ) {
    this.root = scene.add.container(0, 0).setDepth(230).setScrollFactor(0).setVisible(false);
    adoptHud(scene, this.root);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  show(lines: HeroStatLine[]): void {
    this.scroller?.destroy();
    this.scroller = undefined;
    this.root.removeAll(true);
    const frame = measureViewport(this.scene.scale.width, this.scene.scale.height);
    const width = frame.width;
    const height = frame.height;
    const inset = frame.contentInset;
    const showFov = height >= 480;
    const footerH = showFov ? 220 : 168;
    const headerH = 72;

    const veil = this.scene.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.92);
    veil.setInteractive();
    const title = this.scene.add
      .text(width / 2, inset.top, 'PAUSED', {
        fontFamily: FONTS.display,
        fontSize: frame.isPortrait ? '24px' : '32px',
        color: hex(COLORS.yellow),
        letterSpacing: 4,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);
    const sub = this.scene.add
      .text(width / 2, inset.top + 36, 'SCOREBOARD  //  SETTINGS', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'bold',
        color: hex(COLORS.muted),
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);

    this.root.add([veil, title, sub]);

    const scrollY = inset.top + headerH;
    const scrollH = Math.max(80, height - scrollY - footerH - inset.bottom);
    this.scroller = new ScrollPanel(this.scene, inset.left, scrollY, width - inset.left - inset.right, scrollH, {
      depth: 231,
      scrollFactor: 0,
    });
    const board = addScoreboardSized(this.scene, this.scroller.content, lines, 0, width - inset.left - inset.right);
    this.scroller.setContentSize(board.width, board.height + 8);
    this.root.add(this.scroller.root);

    const sliderX = width / 2;
    const sliderY = height - inset.bottom - (showFov ? 170 : 118);
    const trackWidth = Math.min(320, width - inset.left - inset.right - 80);
    const music = new SettingSlider(this.scene, sliderX, sliderY, {
      label: 'MUSIC',
      value: audioSettings.getMusicVolume(),
      screenSpace: true,
      trackWidth,
      onChange: (value) => {
        audioSettings.setMusicVolume(value);
        audio.syncMusicVolume();
      },
    });
    music.setScrollFactor(0).setDepth(232);
    const sfx = new SettingSlider(this.scene, sliderX, sliderY + 52, {
      label: 'SFX',
      value: audioSettings.getSfxVolume(),
      screenSpace: true,
      trackWidth,
      onChange: (value) => audioSettings.setSfxVolume(value),
      onRelease: () => audioSettings.playUiTick(),
    });
    sfx.setScrollFactor(0).setDepth(232);
    const pauseSliders: Phaser.GameObjects.GameObject[] = [music, sfx];
    if (showFov) {
      const fov = new SettingSlider(this.scene, sliderX, sliderY + 104, {
        label: 'CAMERA / FOV',
        value: cameraPrefs.getFov(),
        screenSpace: true,
        trackWidth,
        onChange: (value) => {
          cameraPrefs.setFov(value);
          applyGameplayCamera(this.scene.cameras.main, width, height);
        },
      });
      fov.setScrollFactor(0).setDepth(232);
      pauseSliders.push(fov);
    }
    this.root.add(pauseSliders);

    const btnW = Math.min(190, (width - inset.left - inset.right - 16) / 2);
    const btnY = height - inset.bottom - 28;
    const continueBtn = new ActionButton(this.scene, width / 2 - btnW / 2 - 8, btnY, {
      label: 'CONTINUE',
      width: btnW,
      height: 44,
      primary: true,
      compact: true,
      attachToScene: false,
      onPress: () => this.handlers.onContinue(),
    });
    continueBtn.setScrollFactor(0).setDepth(231);
    const exitBtn = new ActionButton(this.scene, width / 2 + btnW / 2 + 8, btnY, {
      label: 'EXIT',
      width: btnW,
      height: 44,
      compact: true,
      attachToScene: false,
      onPress: () => this.handlers.onExit(),
    });
    exitBtn.setScrollFactor(0).setDepth(231);
    this.root.add([continueBtn, exitBtn]);
    adoptHud(this.scene, this.root);
    this.root.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.scroller?.destroy();
    this.scroller = undefined;
    this.root.removeAll(true);
    this.root.setVisible(false);
    this.visible = false;
  }

  destroy(): void {
    this.scroller?.destroy();
    this.root.destroy();
  }
}
