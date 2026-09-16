import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { COLORS } from '../ui/theme';
import { SeededRNG } from './seed';
import type { MapLayout } from './types';
import { drawRoadNetwork } from './drawRoads';

const GRASS_KEY = 'sw-pixel-grass-v3';
const TILE = 512;

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

  // Even base with sparse 1–2px specks. No large noise continents, so the
  // 512px tile does not read as a repeating camouflage pattern in-match.
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const speck = hash01(x, y, 0xc0ff);
      let color: number = GRASS.base;
      if (speck < 0.045) {
        color = GRASS.dark;
      } else if (speck < 0.07) {
        color = GRASS.mid;
      } else if (speck > 0.975) {
        color = GRASS.light;
      }
      put(data, x, y, color);
    }
  }

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (hash01(x, y, 0xc0ff) >= 0.045) {
        continue;
      }
      if (hash01(x, y, 0x11a3) < 0.45) {
        put(data, x + 1, y, GRASS.dark);
      }
      if (hash01(x, y, 0x22b4) < 0.28) {
        put(data, x, y + 1, GRASS.deep);
      }
    }
  }

  for (let i = 0; i < 52; i += 1) {
    const x = Math.floor(hash01(i, 7, 0x91) * TILE);
    const y = Math.floor(hash01(i, 11, 0x92) * TILE);
    put(data, x, y, GRASS.deep);
    put(data, x + 1, y, GRASS.dark);
    put(data, x, y + 1, GRASS.dark);
  }

  for (let i = 0; i < 168; i += 1) {
    const x = Math.floor(hash01(i, 19, 0x11) * TILE);
    const y = Math.floor(hash01(i, 23, 0x22) * TILE);
    const count = 2 + Math.floor(hash01(i, 29, 0x33) * 3);
    for (let n = 0; n < count; n += 1) {
      const ox = x + n * 2 - 1;
      const h = 2 + Math.floor(hash01(i, n, 0x44) * 3);
      blade(data, ox, y, h);
    }
  }

  for (let i = 0; i < 210; i += 1) {
    const x = Math.floor(hash01(i, 41, 0x55) * TILE);
    const y = Math.floor(hash01(i, 43, 0x66) * TILE);
    blade(data, x, y, 2 + Math.floor(hash01(i, 53, 0x88) * 3));
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
  const { width, height, wallThickness: wall, cameraBleed: bleed, wallColor } = ARENA;
  // Wall beyond the arena only. Never paint over the grass field.
  graphics.fillStyle(wallColor);
  graphics.fillRect(-bleed, -bleed, width + bleed * 2, bleed);
  graphics.fillRect(-bleed, height, width + bleed * 2, bleed);
  graphics.fillRect(-bleed, 0, bleed, height);
  graphics.fillRect(width, 0, bleed, height);
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

const scatterWorldTufts = (graphics: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  const rng = new SeededRNG(layout.seed ^ 0x4e11);
  const step = 54;
  const wall = ARENA.wallThickness + 8;
  for (let y = wall; y < ARENA.height - wall; y += step) {
    for (let x = wall; x < ARENA.width - wall; x += step) {
      if (!rng.chance(0.38)) {
        continue;
      }
      const px = x + rng.int(-18, 18);
      const py = y + rng.int(-18, 18);
      if (inKeepout(layout, px, py)) {
        continue;
      }
      const blades = rng.int(2, 3);
      graphics.fillStyle(GRASS.blade, 1);
      for (let n = 0; n < blades; n += 1) {
        const bx = px + n * 2;
        const h = rng.int(2, 4);
        graphics.fillRect(bx, py - h + 2, 1, h);
      }
      graphics.fillStyle(GRASS.bladeTip, 1);
      graphics.fillRect(px, py - rng.int(1, 2), 1, 1);
    }
  }
};

const scatterFlowers = (graphics: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  const rng = new SeededRNG(layout.seed ^ 0x7f11e);
  const step = 78;
  const wall = ARENA.wallThickness + 10;
  for (let y = wall; y < ARENA.height - wall; y += step) {
    for (let x = wall; x < ARENA.width - wall; x += step) {
      const jitterX = x + rng.int(-22, 22);
      const jitterY = y + rng.int(-22, 22);
      if (!rng.chance(0.1) || inKeepout(layout, jitterX, jitterY)) {
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
      const w = 42 + mark.variant * 10;
      const h = 18 + mark.variant * 5;
      graphics.fillStyle(0x4a4030, 0.42);
      graphics.fillRect(Math.round(mark.x - w / 2), Math.round(mark.y - h / 2), w, h);
      graphics.fillStyle(0x5a4e38, 0.32);
      graphics.fillRect(Math.round(mark.x - w / 3), Math.round(mark.y - h / 3), Math.round(w * 0.55), Math.round(h * 0.5));
      const count = 10 + mark.variant * 3;
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
      continue;
    }
    if (mark.kind === 'debris') {
      graphics.fillStyle(0x5a5348, 1);
      graphics.fillRect(mark.x - 6, mark.y - 3, 11 + mark.variant, 5);
      graphics.fillStyle(0x3a3428, 1);
      graphics.fillRect(mark.x + 2, mark.y, 7, 4);
      graphics.fillStyle(0x6e5a4a, 1);
      graphics.fillRect(mark.x - 3, mark.y + 2, 6, 3);
      continue;
    }
    if (mark.kind === 'burn') {
      graphics.fillStyle(0x2a1c14, 0.55);
      graphics.fillRect(mark.x - 16, mark.y - 8, 34, 18);
      graphics.fillStyle(0x3a2818, 0.4);
      graphics.fillRect(mark.x - 6, mark.y - 3, 16, 10);
      continue;
    }
    if (mark.kind === 'sign') {
      graphics.fillStyle(0x1a1208, 1);
      graphics.fillRect(mark.x, mark.y - 14, 3, 18);
      graphics.fillStyle(0x8a5a2c, 1);
      graphics.fillRect(mark.x - 8, mark.y - 22, 18, 10);
      graphics.fillStyle(0xc48a40, 1);
      graphics.fillRect(mark.x - 6, mark.y - 20, 14, 6);
      continue;
    }
    if (mark.kind === 'grassCrack') {
      graphics.fillStyle(GRASS.blade, 1);
      graphics.fillRect(mark.x, mark.y, 1, 4);
      graphics.fillRect(mark.x + 2, mark.y + 1, 1, 3);
      graphics.fillStyle(0x5a4e38, 1);
      graphics.fillRect(mark.x - 3, mark.y + 3, 9, 2);
      continue;
    }
    if (mark.kind === 'curbBit') {
      graphics.fillStyle(0x8a9086, 1);
      graphics.fillRect(mark.x, mark.y, 8, 3);
    }
  }
};

const drawMidfieldDust = (graphics: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  const rng = new SeededRNG(layout.seed ^ 0x33aa);
  const cx = ARENA.width / 2;
  const cy = ARENA.height / 2;
  for (let i = 0; i < 6; i += 1) {
    const ang = rng.float(0, Math.PI * 2);
    const rx = rng.float(0, 1) ** 0.55 * 220;
    const ry = rng.float(0, 1) ** 0.55 * 110;
    const x = Math.round(cx + Math.cos(ang) * rx);
    const y = Math.round(cy + Math.sin(ang) * ry);
    graphics.fillStyle(i % 4 === 0 ? 0x2a1c14 : 0x4a4030, 0.28);
    graphics.fillRect(x - 10, y - 5, 22 + (i % 3) * 6, 9 + (i % 2) * 4);
  }
  for (let i = 0; i < 22; i += 1) {
    const ang = rng.float(0, Math.PI * 2);
    const rx = rng.float(0, 1) ** 0.6 * 190;
    const ry = rng.float(0, 1) ** 0.6 * 78;
    const x = Math.round(cx + Math.cos(ang) * rx);
    const y = Math.round(cy + Math.sin(ang) * ry);
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
  drawRoadNetwork(overlay, layout);
  drawDecorations(overlay, layout);
  drawMidfieldDust(overlay, layout);
  scatterWorldTufts(overlay, layout);
  scatterFlowers(overlay, layout);
  drawPerimeter(overlay);

  return {
    destroy: () => {
      tile.destroy();
      overlay.destroy();
    },
  };
};
