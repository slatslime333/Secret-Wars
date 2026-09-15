import Phaser from 'phaser';
import { adoptHud } from '../layout/hudCamera';
import { COLORS, FONTS, hex } from '../theme';
import {
  describeObjectiveRewards,
  formatLevelGrant,
  type ObjectiveRewardContext,
} from './format';
import type { LevelGrant } from '../../match/Progression';

type BannerKind = 'level' | 'objective';

type Banner = {
  kind: BannerKind;
  title: string;
  lines: string[];
  color: number;
};

/**
 * HUD banners for level-ups and objective rewards.
 * Status chips live on the hero nameplate (`StatusChips`).
 */
export class CombatFeedback {
  private readonly scene: Phaser.Scene;
  private queue: Banner[] = [];
  private playing = false;
  private anchor = { x: 0, y: 0 };
  private active?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setAnchor(x: number, y: number): void {
    this.anchor = { x, y };
  }

  levelUps(grants: LevelGrant[]): void {
    for (const grant of grants) {
      const copy = formatLevelGrant(grant);
      this.enqueue({
        kind: 'level',
        title: copy.headline,
        lines: [copy.level, copy.stat],
        color: COLORS.yellow,
      });
    }
  }

  objective(ctx: ObjectiveRewardContext): void {
    const copy = describeObjectiveRewards(ctx);
    if (copy.lines.length === 0) {
      return;
    }
    this.enqueue({
      kind: 'objective',
      title: copy.title,
      lines: copy.lines,
      color: COLORS.cyan,
    });
  }

  destroy(): void {
    this.queue.length = 0;
    this.playing = false;
    if (this.active) {
      this.scene.tweens.killTweensOf(this.active);
      this.active.destroy();
      this.active = undefined;
    }
  }

  private enqueue(banner: Banner): void {
    this.queue.push(banner);
    this.kick();
  }

  private kick(): void {
    if (this.playing || this.queue.length === 0) {
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      return;
    }
    this.playing = true;
    this.show(next);
  }

  private show(banner: Banner): void {
    const scene = this.scene;
    const x = this.anchor.x || scene.scale.width * 0.22;
    const y = this.anchor.y || scene.scale.height * 0.18;
    const size = banner.kind === 'level' ? 26 : 22;
    const title = scene.add
      .text(0, 0, banner.title, {
        fontFamily: FONTS.display,
        fontSize: `${size}px`,
        color: hex(banner.color),
        letterSpacing: banner.kind === 'level' ? 3 : 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 7,
        align: 'left',
      })
      .setOrigin(0, 0);
    const body = scene.add
      .text(0, title.height + 2, banner.lines.join('\n'), {
        fontFamily: FONTS.display,
        fontSize: banner.kind === 'level' ? '18px' : '16px',
        color: hex(COLORS.paper),
        letterSpacing: 2,
        stroke: hex(COLORS.ink),
        strokeThickness: 6,
        align: 'left',
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    const root = scene.add.container(x, y, [title, body]).setDepth(208).setScrollFactor(0).setScale(1.12).setAlpha(1);
    adoptHud(scene, root);
    this.active = root;
    const hold = banner.kind === 'level' ? 980 : 1100;
    scene.tweens.add({
      targets: root,
      scale: 1,
      duration: 140,
      ease: 'Quad.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: root,
          alpha: 0,
          y: y - 14,
          duration: 420,
          delay: hold,
          ease: 'Quad.easeIn',
          onComplete: () => {
            root.destroy();
            if (this.active === root) {
              this.active = undefined;
            }
            this.playing = false;
            this.kick();
          },
        });
      },
    });
  }
}
