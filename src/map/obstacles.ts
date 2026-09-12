import Phaser from 'phaser';
import type { MapObstacle } from './types';

const KEYS = {
  'wall:stone': 'sw-wall-stone-v3',
  'wall:ruin': 'sw-wall-ruin-v3',
  'wall:wood': 'sw-wall-wood-v3',
  'tree:small': 'sw-tree-small-v3',
  'tree:medium': 'sw-tree-medium-v3',
  'tree:broad': 'sw-tree-broad-v3',
  'crate:single': 'sw-crate-single-v3',
  'crate:stack': 'sw-crate-stack-v3',
  'crate:pair': 'sw-crate-pair-v3',
} as const;

const rgb = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

const fill = (ctx: CanvasRenderingContext2D, color: number, x: number, y: number, w: number, h: number): void => {
  ctx.fillStyle = rgb(color);
  ctx.fillRect(x, y, w, h);
};

const bake = (
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void => {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) {
    return;
  }
  ctx.clearRect(0, 0, width, height);
  draw(ctx);
  canvas.refresh();
};

const drawWall = (ctx: CanvasRenderingContext2D, variant: string): void => {
  fill(ctx, 0x101410, 0, 0, 64, 20);
  if (variant === 'wood') {
    fill(ctx, 0x8a5a2c, 1, 1, 62, 18);
    fill(ctx, 0xd4a050, 2, 2, 60, 4);
    fill(ctx, 0x6b431f, 2, 14, 60, 4);
    fill(ctx, 0x2a1c10, 20, 1, 2, 18);
    fill(ctx, 0x2a1c10, 42, 1, 2, 18);
    return;
  }
  fill(ctx, 0x6e746c, 1, 1, 62, 18);
  fill(ctx, 0x9aa290, 2, 2, 60, 4);
  fill(ctx, 0x4a5248, 2, 14, 60, 4);
  fill(ctx, 0x2a3028, 16, 1, 2, 18);
  fill(ctx, 0x2a3028, 34, 1, 2, 18);
  fill(ctx, 0x2a3028, 50, 1, 2, 18);
  if (variant === 'ruin') {
    fill(ctx, 0x3a6234, 50, 1, 13, 7);
  }
};

const drawTree = (ctx: CanvasRenderingContext2D, variant: string): void => {
  const wide = variant === 'broad';
  const tall = variant === 'medium';
  const canopyW = wide ? 28 : tall ? 24 : 22;
  const canopyH = wide ? 18 : tall ? 20 : 16;
  const left = Math.round((32 - canopyW) / 2);
  const top = tall ? 2 : 6;
  fill(ctx, 0x1a1208, 14, 24, 5, 10);
  fill(ctx, 0x7a4a22, 14, 24, 4, 8);
  fill(ctx, 0x101408, left - 1, top + 1, canopyW + 2, canopyH + 2);
  fill(ctx, 0x245018, left, top + 2, canopyW, canopyH);
  fill(ctx, 0x3a7a28, left + 2, top, canopyW - 4, canopyH - 4);
  fill(ctx, 0x6aaa40, left + 5, top + 3, Math.max(6, canopyW - 12), 3);
};

const drawCrate = (ctx: CanvasRenderingContext2D, variant: string): void => {
  const box = (x: number, y: number) => {
    fill(ctx, 0x1a1208, x, y, 18, 18);
    fill(ctx, 0xc48a40, x + 1, y + 1, 16, 16);
    fill(ctx, 0xe0b060, x + 2, y + 2, 14, 3);
    fill(ctx, 0x6b431f, x + 2, y + 13, 14, 3);
    ctx.strokeStyle = '#2a1c10';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + 15, y + 15);
    ctx.moveTo(x + 15, y + 3);
    ctx.lineTo(x + 3, y + 15);
    ctx.stroke();
  };
  if (variant === 'stack') {
    box(7, 14);
    box(7, 2);
    return;
  }
  if (variant === 'pair') {
    box(2, 7);
    box(18, 7);
    return;
  }
  box(7, 7);
};

export const ensureObstacleTextures = (scene: Phaser.Scene): void => {
  bake(scene, KEYS['wall:stone'], 64, 20, (ctx) => drawWall(ctx, 'stone'));
  bake(scene, KEYS['wall:ruin'], 64, 20, (ctx) => drawWall(ctx, 'ruin'));
  bake(scene, KEYS['wall:wood'], 64, 20, (ctx) => drawWall(ctx, 'wood'));
  bake(scene, KEYS['tree:small'], 32, 36, (ctx) => drawTree(ctx, 'small'));
  bake(scene, KEYS['tree:medium'], 32, 36, (ctx) => drawTree(ctx, 'medium'));
  bake(scene, KEYS['tree:broad'], 32, 36, (ctx) => drawTree(ctx, 'broad'));
  bake(scene, KEYS['crate:single'], 32, 32, (ctx) => drawCrate(ctx, 'single'));
  bake(scene, KEYS['crate:stack'], 32, 36, (ctx) => drawCrate(ctx, 'stack'));
  bake(scene, KEYS['crate:pair'], 38, 32, (ctx) => drawCrate(ctx, 'pair'));
};

export const textureKeyFor = (obs: MapObstacle): string => {
  const key = `${obs.kind}:${obs.variant}` as keyof typeof KEYS;
  return KEYS[key] ?? KEYS['crate:single'];
};
