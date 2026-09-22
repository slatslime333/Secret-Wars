import Phaser from 'phaser';
import { COMBAT } from '../config/combat';

/** Below this fraction of max health the hero pulses red. */
export const LOW_HEALTH_RATIO = 0.25;

/** Impact slash drawn over the sprite after a damaging hit. */
export const HURT_MARK_MS = 240;

const RED = 0xff2430;
const RED_HOT = 0xfff4f2;

export const isLowHealth = (health: number, maxHealth: number, down: boolean): boolean =>
  !down && maxHealth > 0 && health > 0 && health / maxHealth < LOW_HEALTH_RATIO;

/** 0–1 pulse, about one fade in and out per second. */
export const hurtPulse = (now: number): number => 0.5 + 0.5 * Math.sin(now / 130);

export const drawHurtGlow = (gfx: Phaser.GameObjects.Graphics, pulse: number): void => {
  gfx.clear();
  const alpha = 0.16 + pulse * 0.5;
  const radius = 16 + pulse * 10;
  gfx.fillStyle(RED, alpha);
  gfx.fillEllipse(0, -14, radius * 1.85, radius * 2.25);
  gfx.fillStyle(0xff6a72, alpha * 0.55);
  gfx.fillEllipse(0, -20, radius * 0.95, radius * 1.15);
};

export const drawHurtMark = (
  gfx: Phaser.GameObjects.Graphics,
  progress: number,
  dirX: number,
  dirY: number,
  washBody: boolean,
): void => {
  gfx.clear();
  const fade = Math.max(0, 1 - progress);
  const grow = Phaser.Math.Clamp(progress, 0, 1);
  const angle = Math.atan2(dirY, dirX);
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const px = -fy;
  const py = fx;
  const cx = dirX * 5;
  const cy = -18 + dirY * 4;
  const len = 9 + grow * 16;
  if (washBody) {
    gfx.fillStyle(RED, 0.58 * fade);
    gfx.fillEllipse(cx, cy, 32, 44);
  }
  gfx.lineStyle(5, RED, 0.95 * fade);
  gfx.beginPath();
  gfx.moveTo(cx - fx * len, cy - fy * len);
  gfx.lineTo(cx + fx * len * 0.45, cy + fy * len * 0.45);
  gfx.strokePath();
  gfx.lineStyle(3, RED_HOT, fade);
  gfx.beginPath();
  gfx.moveTo(cx - px * len * 0.78, cy - py * len * 0.78);
  gfx.lineTo(cx + px * len * 0.78, cy + py * len * 0.78);
  gfx.strokePath();
  gfx.fillStyle(RED, 0.35 * fade);
  gfx.fillCircle(cx, cy, 8 + grow * 9);
  gfx.fillStyle(RED_HOT, 0.9 * fade);
  gfx.fillCircle(cx, cy, 2.4 + grow * 1.6);
};

export const hurtFlashMs = (): number => COMBAT.hitFlashMs;
