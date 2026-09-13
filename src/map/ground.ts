import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { COLORS } from '../ui/theme';
import { SeededRNG } from './seed';
import type { MapLayout } from './types';

const GRASS_KEY = 'sw-pixel-grass-v1';
const TILE = 256;

/** Muted medium/dark greens. Close together so the field stays readable. */
const GRASS = {
  deep: 0x243e22,
  dark: 0x2c4a29,
  base: 0x365a32,
  mid: 0x3c6337,
  light: 0x466a3d,
  blade: 0x2f522c,
  bladeTip: 0x4a7040,
} as const;

const FLOWER_COLORS = [
  0xe4dcc8, // white
  0xd4c06a, // soft yellow
  0xc49a9c, // muted pink
  0xb4a4c6, // light purple
  0x8eacc0, // light blue
] as const;

const unpack = (color: number): [number, number, number] => [
  (color >> 16) & 255,
  (color >> 8) & 255,
  color & 255,
];

const hash01 = (ix: number, iy: number, salt: number): number => {
  let n = Math.imul(ix + 374761393, 1597334677) ^ Math.imul(iy + 668265263, 3812015801) ^ salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

const fade = (t: number): number => t * t * (3 - 2 * t);

/** Seamless value noise. `cell` must divide TILE. */
const wrapNoise = (x: number, y: number, cell: number, salt: number): number => {
  const cells = TILE / cell;
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = fade(gx - x0);
  const ty = fade(gy - y0);
  const wrap = (v: number): number => ((v % cells) + cells) % cells;
  const v00 = hash01(wrap(x0), wrap(y0), salt);
  const v10 = hash01(wrap(x0 + 1), wrap(y0), salt);
  const v01 = hash01(wrap(x0), wrap(y0 + 1), salt);
  const v11 = hash01(wrap(x0 + 1), wrap(y0 + 1), salt);
  return v00 + (v10 - v00) * tx + (v01 - v00) * ty + (v00 - v10 - v01 + v11) * tx * ty;
};

const wrapIndex = (v: number): number => ((v % TILE) + TILE) % TILE;

const put = (data: Uint8ClampedArray, x: number, y: number, color: number): void => {
  const i = (wrapIndex(y) * TILE + wrapIndex(x)) * 4;
  const [r, g, b] = unpack(color);
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
};

const blade = (data: Uint8ClampedArray, x: number, y: number, h: number): void => {
  put(data, x, y, GRASS.blade);
  for (let i = 1; i < h; i += 1) {
    put(data, x, y - i, i === h - 1 ? GRASS.bladeTip : GRASS.blade);
  }
};

const paintGrassTile = (ctx: CanvasRenderingContext2D): void => {
  ctx.imageSmoothingEnabled = false;
  const image = ctx.createImageData(TILE, TILE);
  const data = image.data;

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const mottled =
        wrapNoise(x, y, 32, 0x51c3) * 0.5 + wrapNoise(x, y, 16, 0xa27b) * 0.35 + wrapNoise(x, y, 8, 0x0d15) * 0.15;
      const speck = hash01(x, y, 0xc0ff);
      let color: number = GRASS.base;
      if (mottled < 0.34) {
        color = GRASS.dark;
      } else if (mottled > 0.72) {
        color = GRASS.mid;
      }
      if (speck < 0.1) {
        color = GRASS.dark;
      } else if (speck > 0.93) {
        color = GRASS.light;
      } else if (speck > 0.88 && mottled < 0.4) {
        color = GRASS.deep;
      }
      put(data, x, y, color);
    }
  }

  for (let i = 0; i < 86; i += 1) {
    const x = Math.floor(hash01(i, 19, 0x11) * TILE);
    const y = Math.floor(hash01(i, 23, 0x22) * TILE);
    const count = 2 + Math.floor(hash01(i, 29, 0x33) * 3);
    for (let n = 0; n < count; n += 1) {
      const ox = x + n * 2 - 1;
      const h = 2 + Math.floor(hash01(i, n, 0x44) * 3);
      blade(data, ox, y, h);
    }
  }

  for (let i = 0; i < 140; i += 1) {
    const x = Math.floor(hash01(i, 41, 0x55) * TILE);
    const y = Math.floor(hash01(i, 43, 0x66) * TILE);
    if (hash01(i, 47, 0x77) < 0.18) {
      put(data, x, y, GRASS.deep);
      continue;
    }
    blade(data, x, y, 2 + Math.floor(hash01(i, 53, 0x88) * 2));
  }

  ctx.putImageData(image, 0, 0);
};

const ensureGrassTexture = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(GRASS_KEY)) {
    return;
  }
  const canvas = scene.textures.createCanvas(GRASS_KEY, TILE, TILE);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) {
    return;
  }
  paintGrassTile(ctx);
  canvas.refresh();
  scene.textures.get(GRASS_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
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

const drawFlower = (graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void => {
  graphics.fillStyle(GRASS.dark, 1);
  graphics.fillRect(x, y + 2, 1, 2);
  graphics.fillStyle(color, 1);
  graphics.fillRect(x, y, 1, 1);
  graphics.fillRect(x - 1, y + 1, 1, 1);
  graphics.fillRect(x + 1, y + 1, 1, 1);
  graphics.fillStyle(0xf2ead4, 1);
  graphics.fillRect(x, y + 1, 1, 1);
};

const inKeepout = (layout: MapLayout, x: number, y: number): boolean => {
  const wall = ARENA.wallThickness + 8;
  if (x < wall || y < wall || x > ARENA.width - wall || y > ARENA.height - wall) {
    return true;
  }
  for (const zone of layout.spawnZones) {
    const pad = zone.role === 'hero' ? 36 : 20;
    if (Math.hypot(x - zone.x, y - zone.y) < pad) {
      return true;
    }
  }
  for (const obs of layout.obstacles) {
    const box = obs.collision;
    if (x >= box.x - 8 && x <= box.x + box.w + 8 && y >= box.y - 8 && y <= box.y + box.h + 8) {
      return true;
    }
  }
  return false;
};

const scatterFlowers = (graphics: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  const rng = new SeededRNG(layout.seed ^ 0x7f11e);
  const step = 78;
  const wall = ARENA.wallThickness + 10;
  for (let y = wall; y < ARENA.height - wall; y += step) {
    for (let x = wall; x < ARENA.width - wall; x += step) {
      const jitterX = x + rng.int(-22, 22);
      const jitterY = y + rng.int(-22, 22);
      if (!rng.chance(0.16) || inKeepout(layout, jitterX, jitterY)) {
        continue;
      }
      const color = rng.pick(FLOWER_COLORS);
      drawFlower(graphics, jitterX, jitterY, color);
      if (rng.chance(0.22)) {
        const extra = rng.int(1, 2);
        for (let n = 0; n < extra; n += 1) {
          const cx = jitterX + rng.int(-7, 7);
          const cy = jitterY + rng.int(-5, 6);
          if (inKeepout(layout, cx, cy)) {
            continue;
          }
          drawFlower(graphics, cx, cy, rng.chance(0.55) ? color : rng.pick(FLOWER_COLORS));
        }
      }
    }
  }
};

const drawDirtSpeck = (graphics: Phaser.GameObjects.Graphics, x: number, y: number): void => {
  graphics.fillStyle(0x5a4e38, 1);
  graphics.fillRect(x, y, 1, 1);
  graphics.fillStyle(0x4a4030, 1);
  graphics.fillRect(x + 1, y, 1, 1);
};

const drawDecorations = (graphics: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  const rng = new SeededRNG(layout.seed ^ 0x51c3);
  for (const mark of layout.decorations) {
    if (mark.kind === 'dirt') {
      const w = 28 + mark.variant * 6;
      const h = 12 + mark.variant * 3;
      const count = 18 + mark.variant * 4;
      for (let i = 0; i < count; i += 1) {
        const px = Math.round(mark.x + rng.float(-w, w));
        const py = Math.round(mark.y + rng.float(-h, h));
        drawDirtSpeck(graphics, px, py);
      }
      continue;
    }
    if (mark.kind === 'rock') {
      graphics.fillStyle(0x5a5348, 1);
      graphics.fillRect(mark.x - 3, mark.y - 2, 7 + mark.variant, 4);
      graphics.fillStyle(0x2c2820, 1);
      graphics.fillRect(mark.x - 2, mark.y + 2, 6, 1);
      continue;
    }
    if (mark.kind === 'tuft') {
      graphics.fillStyle(GRASS.blade, 1);
      graphics.fillRect(mark.x, mark.y, 1, 3);
      graphics.fillRect(mark.x + 2, mark.y + 1, 1, 3);
      graphics.fillStyle(GRASS.bladeTip, 1);
      graphics.fillRect(mark.x, mark.y - 1, 1, 1);
      graphics.fillRect(mark.x + 2, mark.y, 1, 1);
    }
  }
};

const drawMidfieldDust = (graphics: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  const rng = new SeededRNG(layout.seed ^ 0x33aa);
  const cx = ARENA.width / 2;
  const cy = ARENA.height / 2;
  for (let i = 0; i < 70; i += 1) {
    const ang = rng.float(0, Math.PI * 2);
    const rx = rng.float(0, 1) ** 0.6 * 190;
    const ry = rng.float(0, 1) ** 0.6 * 78;
    const x = Math.round(cx + Math.cos(ang) * rx);
    const y = Math.round(cy + Math.sin(ang) * ry);
    if (inKeepout(layout, x, y)) {
      continue;
    }
    drawDirtSpeck(graphics, x, y);
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
  tile.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

  const overlay = scene.add.graphics().setDepth(1);
  drawDecorations(overlay, layout);
  drawMidfieldDust(overlay, layout);
  scatterFlowers(overlay, layout);
  drawPerimeter(overlay);

  return {
    destroy: () => {
      tile.destroy();
      overlay.destroy();
    },
  };
};
