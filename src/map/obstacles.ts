import Phaser from 'phaser';
import type { MapObstacle } from './types';

const KEYS = {
  'wall:stone': 'sw-wall-stone',
  'wall:ruin': 'sw-wall-ruin',
  'wall:wood': 'sw-wall-wood',
  'tree:small': 'sw-tree-small',
  'tree:medium': 'sw-tree-medium',
  'tree:broad': 'sw-tree-broad',
  'crate:single': 'sw-crate-single',
  'crate:stack': 'sw-crate-stack',
  'crate:pair': 'sw-crate-pair',
} as const;

const px = (g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, w: number, h: number): void => {
  g.fillStyle(color, 1);
  g.fillRect(x, y, w, h);
};

const drawWall = (g: Phaser.GameObjects.Graphics, variant: string): void => {
  g.clear();
  if (variant === 'wood') {
    px(g, 0x2a1c10, 0, 2, 64, 16);
    px(g, 0x8a5a2c, 1, 3, 62, 14);
    px(g, 0x6b431f, 1, 8, 62, 3);
    px(g, 0xc48a4a, 2, 3, 60, 3);
    px(g, 0x3a2410, 20, 3, 2, 14);
    px(g, 0x3a2410, 42, 3, 2, 14);
    return;
  }
  px(g, 0x1c201c, 0, 2, 64, 16);
  px(g, 0x5a6158, 1, 3, 62, 14);
  px(g, 0x7a8276, 1, 3, 62, 3);
  px(g, 0x3a4038, 1, 14, 62, 3);
  px(g, 0x2a3028, 16, 3, 2, 14);
  px(g, 0x2a3028, 34, 3, 2, 14);
  px(g, 0x2a3028, 50, 3, 2, 14);
  if (variant === 'ruin') {
    px(g, 0x3a6234, 48, 2, 16, 8);
    px(g, 0x4a4f46, 8, 2, 10, 4);
  }
};

const drawTree = (g: Phaser.GameObjects.Graphics, variant: string): void => {
  g.clear();
  const wide = variant === 'broad';
  const tall = variant === 'medium';
  const canopyW = wide ? 28 : tall ? 24 : 20;
  const canopyH = wide ? 16 : tall ? 20 : 16;
  const left = Math.round((32 - canopyW) / 2);
  const top = tall ? 2 : 6;
  px(g, 0x2a1c10, 14, 22, 4, 10);
  px(g, 0x5a3a18, 14, 22, 4, 8);
  px(g, 0x1c3a18, left - 1, top + 2, canopyW + 2, canopyH);
  px(g, 0x2f5a28, left, top, canopyW, canopyH - 2);
  px(g, 0x4a7a38, left + 3, top + 2, canopyW - 8, 4);
  px(g, 0x1a3014, left + 2, top + canopyH - 4, canopyW - 4, 3);
};

const drawCrate = (g: Phaser.GameObjects.Graphics, variant: string): void => {
  g.clear();
  const paint = (x: number, y: number) => {
    px(g, 0x2a1c10, x, y, 16, 16);
    px(g, 0xb07a38, x + 1, y + 1, 14, 14);
    px(g, 0xd4a050, x + 2, y + 2, 12, 3);
    px(g, 0x6b431f, x + 2, y + 12, 12, 2);
    g.lineStyle(1, 0x3a2410, 1);
    g.lineBetween(x + 3, y + 3, x + 13, y + 13);
    g.lineBetween(x + 13, y + 3, x + 3, y + 13);
  };
  if (variant === 'stack') {
    paint(8, 12);
    paint(8, 2);
    return;
  }
  if (variant === 'pair') {
    paint(2, 8);
    paint(16, 8);
    return;
  }
  paint(8, 8);
};

export const ensureObstacleTextures = (scene: Phaser.Scene): void => {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const bake = (key: string, draw: () => void, w: number, h: number) => {
    if (scene.textures.exists(key)) {
      return;
    }
    draw();
    g.generateTexture(key, w, h);
  };
  bake(KEYS['wall:stone'], () => drawWall(g, 'stone'), 64, 20);
  bake(KEYS['wall:ruin'], () => drawWall(g, 'ruin'), 64, 20);
  bake(KEYS['wall:wood'], () => drawWall(g, 'wood'), 64, 20);
  bake(KEYS['tree:small'], () => drawTree(g, 'small'), 32, 36);
  bake(KEYS['tree:medium'], () => drawTree(g, 'medium'), 32, 36);
  bake(KEYS['tree:broad'], () => drawTree(g, 'broad'), 32, 36);
  bake(KEYS['crate:single'], () => drawCrate(g, 'single'), 32, 32);
  bake(KEYS['crate:stack'], () => drawCrate(g, 'stack'), 32, 32);
  bake(KEYS['crate:pair'], () => drawCrate(g, 'pair'), 32, 32);
  g.destroy();
};

export const textureKeyFor = (obs: MapObstacle): string => {
  const key = `${obs.kind}:${obs.variant}` as keyof typeof KEYS;
  return KEYS[key] ?? KEYS['crate:single'];
};
