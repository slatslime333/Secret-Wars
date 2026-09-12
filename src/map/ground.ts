import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { COLORS } from '../ui/theme';
import { SeededRNG } from './seed';
import type { MapLayout } from './types';

const GRASS_KEY = 'sw-calm-grass-v4';
const TILE = 256;

const tone = (value: number): number => {
  const t = Math.max(-1, Math.min(1, value));
  const r = Math.round(54 + t * 6);
  const g = Math.round(98 + t * 8);
  const b = Math.round(50 + t * 5);
  return (r << 16) | (g << 8) | b;
};

const ensureGrassTexture = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(GRASS_KEY)) {
    scene.textures.remove(GRASS_KEY);
  }
  const canvas = scene.textures.createCanvas(GRASS_KEY, TILE, TILE);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) {
    return;
  }
  ctx.fillStyle = '#3a6234';
  ctx.fillRect(0, 0, TILE, TILE);
  const patch = 32;
  for (let y = 0; y < TILE; y += patch) {
    const stagger = ((y / patch) % 2) * 16;
    for (let x = -stagger; x < TILE; x += patch) {
      const u = (x / TILE) * Math.PI * 2;
      const v = (y / TILE) * Math.PI * 2;
      const wave = Math.sin(u * 0.8 + v * 0.45) * 0.75 + Math.sin(u * 0.35 - v * 0.7) * 0.25;
      ctx.fillStyle = `#${tone(wave).toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, patch, patch);
    }
  }
  for (let y = 8; y < TILE; y += 19) {
    for (let x = 11; x < TILE; x += 23) {
      const u = (x / TILE) * Math.PI * 2;
      const v = (y / TILE) * Math.PI * 2;
      if (Math.sin(u * 3 + v * 2) > 0.55) {
        ctx.fillStyle = '#2f522c';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
  canvas.refresh();
};

const drawPerimeter = (graphics: Phaser.GameObjects.Graphics): void => {
  const { width, height, wallThickness: wall } = ARENA;
  graphics.fillStyle(0x1a211e);
  graphics.fillRect(0, 0, width, wall);
  graphics.fillRect(0, height - wall, width, wall);
  graphics.fillRect(0, 0, wall, height);
  graphics.fillRect(width - wall, 0, wall, height);

  const brickW = 36;
  const brickH = wall - 8;
  for (let x = 0; x < width; x += brickW) {
    graphics.fillStyle((x / brickW) % 2 === 0 ? 0x2a3330 : 0x232b28, 1);
    graphics.fillRect(x + 2, 4, brickW - 4, brickH);
    graphics.fillStyle((x / brickW) % 2 === 0 ? 0x232b28 : 0x2a3330, 1);
    graphics.fillRect(x + 2, height - wall + 4, brickW - 4, brickH);
  }
  for (let y = 0; y < height; y += brickW) {
    graphics.fillStyle((y / brickW) % 2 === 0 ? 0x2a3330 : 0x232b28, 1);
    graphics.fillRect(4, y + 2, brickH, brickW - 4);
    graphics.fillStyle((y / brickW) % 2 === 0 ? 0x232b28 : 0x2a3330, 1);
    graphics.fillRect(width - wall + 4, y + 2, brickH, brickW - 4);
  }
  graphics.lineStyle(3, COLORS.ink, 1);
  graphics.strokeRect(wall - 2, wall - 2, width - (wall - 2) * 2, height - (wall - 2) * 2);
  graphics.lineStyle(2, COLORS.paper, 0.28);
  graphics.strokeRect(wall, wall, width - wall * 2, height - wall * 2);
};

const drawDecorations = (graphics: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  const rng = new SeededRNG(layout.seed ^ 0x51c3);
  for (const mark of layout.decorations) {
    if (mark.kind === 'dirt') {
      graphics.fillStyle(0x6a5a3e, 0.18 + mark.variant * 0.04);
      graphics.fillEllipse(mark.x, mark.y, 86 + mark.variant * 10, 36 + mark.variant * 6);
      continue;
    }
    if (mark.kind === 'rock') {
      graphics.fillStyle(0x5a5348, 0.9);
      graphics.fillRect(mark.x - 3, mark.y - 2, 7 + mark.variant, 4);
      graphics.fillStyle(0x2c2820, 0.8);
      graphics.fillRect(mark.x - 2, mark.y + 2, 6, 1);
      continue;
    }
    if (mark.kind === 'flower' && rng.chance(0.7)) {
      graphics.fillStyle(mark.variant === 1 ? 0xd8c46a : 0xd8d2c0, 0.85);
      graphics.fillRect(mark.x, mark.y, 2, 2);
      continue;
    }
    if (mark.kind === 'tuft') {
      graphics.fillStyle(0x2f552c, 0.45);
      graphics.fillRect(mark.x, mark.y, 2, 4);
      graphics.fillRect(mark.x + 3, mark.y + 1, 2, 3);
    }
  }
};

export type GroundView = {
  destroy: () => void;
};

export const createCalmGround = (scene: Phaser.Scene, layout: MapLayout): GroundView => {
  ensureGrassTexture(scene);
  const tile = scene.add
    .tileSprite(ARENA.width / 2, ARENA.height / 2, ARENA.width, ARENA.height, GRASS_KEY)
    .setDepth(0);
  const overlay = scene.add.graphics().setDepth(1);
  overlay.fillStyle(0x0a140d);
  overlay.fillRect(0, 0, ARENA.width, ARENA.wallThickness);
  drawDecorations(overlay, layout);
  drawPerimeter(overlay);

  const center = scene.add.graphics().setDepth(1);
  center.fillStyle(0x6d5c3f, 0.16);
  center.fillEllipse(ARENA.width / 2, ARENA.height / 2, 420, 190);

  return {
    destroy: () => {
      tile.destroy();
      overlay.destroy();
      center.destroy();
    },
  };
};
