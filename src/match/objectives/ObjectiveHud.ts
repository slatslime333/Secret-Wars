import Phaser from 'phaser';
import type { TeamId } from '../../config/hero';
import { OBJECTIVE, type ObjectiveKind } from '../../config/objective';
import { adoptHud } from '../../ui/layout/hudCamera';
import { COLORS, FONTS, hex } from '../../ui/theme';
import type { ObjectiveUiState } from './types';

const TEAM_COLOR: Record<TeamId, number> = {
  alpha: COLORS.cyan,
  bravo: COLORS.redBright,
};

const TITLE: Record<ObjectiveKind, string> = {
  capture_zone: 'CAPTURE ZONE!',
  golden_piggy: 'GOLDEN PIGGY BANK!',
};

const edgePoint = (sx: number, sy: number, w: number, h: number, m: number): { x: number; y: number } => {
  if (sx >= m && sx <= w - m && sy >= m && sy <= h - m) {
    return { x: sx, y: sy };
  }
  const cx = w / 2;
  const cy = h / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const hits: number[] = [];
  if (dx > 0) {
    hits.push((w - m - cx) / dx);
  } else if (dx < 0) {
    hits.push((m - cx) / dx);
  }
  if (dy > 0) {
    hits.push((h - m - cy) / dy);
  } else if (dy < 0) {
    hits.push((m - cy) / dy);
  }
  const t = hits.filter((n) => n > 0).sort((a, b) => a - b)[0] ?? 1;
  return { x: cx + dx * t, y: cy + dy * t };
};

/**
 * Short-lived spawn banner + edge arrow. World bars live on the objective.
 */
export class ObjectiveHud {
  private readonly banner: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Triangle;
  private readonly scene: Phaser.Scene;
  private hideBannerAt = 0;
  private hideArrowAt = 0;
  private targetX = 0;
  private targetY = 0;
  private active = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.banner = scene.add
      .text(scene.scale.width / 2, scene.scale.height * 0.2, '', {
        fontFamily: FONTS.display,
        fontSize: '34px',
        color: hex(COLORS.yellow),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(205)
      .setVisible(false);
    this.arrow = scene.add
      .triangle(0, 0, 0, -14, -11, 12, 11, 12, COLORS.yellow)
      .setStrokeStyle(2, COLORS.ink, 0.95)
      .setScrollFactor(0)
      .setDepth(204)
      .setVisible(false);
    adoptHud(scene, this.banner, this.arrow);
  }

  announce(kind: ObjectiveKind, x: number, y: number, now: number): void {
    this.targetX = x;
    this.targetY = y;
    this.active = true;
    this.hideBannerAt = now + OBJECTIVE.announcementMs;
    this.hideArrowAt = now + OBJECTIVE.arrowMs;
    this.banner.setText(TITLE[kind]).setScale(1.16).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: this.banner,
      scale: 1,
      duration: 140,
      ease: 'Quad.easeOut',
    });
    this.arrow.setVisible(true).setAlpha(1);
  }

  celebrate(winner: TeamId, line: string): void {
    const color = TEAM_COLOR[winner];
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const label = this.scene.add
      .text(width / 2, height * 0.26, line, {
        fontFamily: FONTS.display,
        fontSize: '28px',
        color: hex(color),
        letterSpacing: 3,
        stroke: hex(COLORS.ink),
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(206)
      .setScale(1.12);
    adoptHud(this.scene, label);
    this.scene.tweens.add({
      targets: label,
      scale: 1,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          alpha: 0,
          y: label.y - 16,
          duration: 700,
          delay: 420,
          ease: 'Quad.easeIn',
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  sync(now: number, ui: ObjectiveUiState | undefined, camera: Phaser.Cameras.Scene2D.Camera): void {
    if (ui) {
      this.targetX = ui.x;
      this.targetY = ui.y;
    }
    this.banner.setPosition(this.scene.scale.width / 2, this.scene.scale.height * 0.2);
    if (now >= this.hideBannerAt) {
      this.banner.setVisible(false);
    }
    const showArrow = this.active && now < this.hideArrowAt && Boolean(ui);
    if (!showArrow) {
      this.arrow.setVisible(false);
      if (!ui) {
        this.active = false;
      }
      return;
    }
    const zoom = camera.zoom || 1;
    const view = camera.worldView;
    const sx = (this.targetX - view.x) * zoom;
    const sy = (this.targetY - view.y) * zoom;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const inset = 72;
    const onScreen = sx >= inset && sx <= w - inset && sy >= inset && sy <= h - inset;
    if (onScreen) {
      this.arrow.setVisible(false);
      return;
    }
    const edge = edgePoint(sx, sy, w, h, 32);
    const dx = this.targetX - (view.x + view.width / 2);
    const dy = this.targetY - (view.y + view.height / 2);
    this.arrow.setVisible(true).setPosition(edge.x, edge.y).setRotation(Math.atan2(dy, dx) + Math.PI / 2);
  }

  layout(width: number, height: number): void {
    this.banner.setPosition(width / 2, height * 0.2);
  }

  destroy(): void {
    this.banner.destroy();
    this.arrow.destroy();
  }
}
