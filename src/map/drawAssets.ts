import { ENV, fillPx, strokePx } from './palette';

const box = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  lite: number,
  dark: number,
): void => {
  fillPx(ctx, ENV.ink, x, y, w, h);
  fillPx(ctx, fill, x + 1, y + 1, w - 2, h - 2);
  fillPx(ctx, lite, x + 2, y + 2, w - 4, 3);
  fillPx(ctx, dark, x + 2, y + h - 5, w - 4, 3);
};

export const drawWall = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, 0, 0, w, h);
  if (variant === 'wood') {
    fillPx(ctx, ENV.wood, 1, 1, w - 2, h - 2);
    fillPx(ctx, ENV.woodLite, 2, 2, w - 4, 4);
    fillPx(ctx, ENV.woodDark, 2, h - 6, w - 4, 4);
    for (let x = 18; x < w - 8; x += 22) {
      fillPx(ctx, ENV.inkSoft, x, 1, 2, h - 2);
    }
    return;
  }
  fillPx(ctx, ENV.concrete, 1, 1, w - 2, h - 2);
  fillPx(ctx, ENV.concreteLite, 2, 2, w - 4, 4);
  fillPx(ctx, ENV.concreteDark, 2, h - 6, w - 4, 4);
  for (let x = 16; x < w - 6; x += 18) {
    fillPx(ctx, ENV.inkSoft, x, 1, 2, h - 2);
  }
  if (variant === 'ruin') {
    fillPx(ctx, ENV.grass, w - 22, 1, 18, 8);
    fillPx(ctx, ENV.dirt, w - 28, h - 8, 14, 5);
    fillPx(ctx, ENV.inkSoft, w - 16, 8, 12, h - 10);
  }
};

export const drawTree = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  const wide = variant === 'broad';
  const tall = variant === 'medium';
  const canopyW = wide ? w - 8 : tall ? w - 12 : w - 14;
  const canopyH = wide ? 22 : tall ? 26 : 20;
  const left = Math.round((w - canopyW) / 2);
  const top = tall ? 4 : 8;
  const trunkX = Math.round(w / 2) - 3;
  fillPx(ctx, ENV.trunkDark, trunkX, h - 16, 7, 14);
  fillPx(ctx, ENV.trunk, trunkX, h - 16, 6, 12);
  fillPx(ctx, ENV.ink, left - 1, top + 1, canopyW + 2, canopyH + 2);
  fillPx(ctx, ENV.canopy, left, top + 2, canopyW, canopyH);
  fillPx(ctx, ENV.canopyLite, left + 3, top, canopyW - 6, canopyH - 6);
  fillPx(ctx, ENV.canopyTip, left + 8, top + 4, Math.max(8, canopyW - 16), 4);
};

const crateFace = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, x, y, w, h);
  fillPx(ctx, ENV.crate, x + 1, y + 1, w - 2, h - 2);
  fillPx(ctx, ENV.crateLite, x + 2, y + 2, w - 4, 5);
  fillPx(ctx, ENV.crateDark, x + 2, y + h - 7, w - 4, 5);
  fillPx(ctx, ENV.woodDark, x + 3, y + Math.floor(h / 2) - 2, w - 6, 3);
  fillPx(ctx, ENV.metal, x + 2, y + 8, w - 4, 3);
  fillPx(ctx, ENV.metal, x + 2, y + h - 12, w - 4, 3);
  ctx.strokeStyle = '#2a1c10';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 7);
  ctx.lineTo(x + w - 6, y + h - 8);
  ctx.moveTo(x + w - 6, y + 7);
  ctx.lineTo(x + 6, y + h - 8);
  ctx.stroke();
  fillPx(ctx, ENV.oliveDark, x + Math.floor(w / 2) - 4, y + 11, 8, 6);
  fillPx(ctx, ENV.oliveLite, x + Math.floor(w / 2) - 3, y + 12, 6, 2);
};

const paintWheel = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  fillPx(ctx, ENV.ink, x, y, 16, 12);
  fillPx(ctx, ENV.inkSoft, x + 2, y + 2, 12, 8);
  fillPx(ctx, ENV.metal, x + 5, y + 4, 6, 5);
};

export const drawVehicle = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  const truck = variant === 'truck';
  fillPx(ctx, ENV.inkSoft, 6, h - 16, w - 12, 8);
  fillPx(ctx, ENV.ink, 4, 10, w - 8, h - 20);
  fillPx(ctx, truck ? ENV.oliveDark : ENV.metal, 6, 12, w - 12, h - 24);
  fillPx(ctx, truck ? ENV.olive : ENV.metalLite, 8, 14, w - 16, h - 30);
  const cab = truck ? Math.floor(w * 0.3) : Math.floor(w * 0.4);
  fillPx(ctx, ENV.ink, 8, 8, cab, h - 24);
  fillPx(ctx, truck ? ENV.oliveLite : ENV.metalLite, 10, 10, cab - 6, h - 30);
  fillPx(ctx, ENV.glass, 14, 16, cab - 16, 14);
  fillPx(ctx, ENV.paper, 16, 18, 6, 4);
  fillPx(ctx, ENV.ink, 18, 22, cab - 28, 6);
  fillPx(ctx, ENV.burn, cab + 6, 20, 24, 10);
  fillPx(ctx, ENV.rust, w - 30, h - 30, 18, 10);
  const wheelY = h - 16;
  paintWheel(ctx, 12, wheelY);
  paintWheel(ctx, w - 32, wheelY);
  if (truck) {
    paintWheel(ctx, Math.floor(w * 0.42), wheelY);
    fillPx(ctx, ENV.oliveLite, cab + 4, 14, w - cab - 16, 8);
    fillPx(ctx, ENV.crateDark, cab + 12, 26, 22, 16);
    fillPx(ctx, ENV.crate, cab + 14, 28, 18, 12);
    fillPx(ctx, ENV.inkSoft, cab + 36, 28, 10, 14);
    fillPx(ctx, ENV.metalLite, cab + 8, h - 28, w - cab - 22, 4);
  } else {
    fillPx(ctx, ENV.rustLite, cab + 8, 28, 18, 4);
    fillPx(ctx, ENV.glass, cab + 12, 16, 18, 8);
  }
};

export const drawBuilding = (ctx: CanvasRenderingContext2D, _variant: string, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, 8, 6, w - 22, 20);
  fillPx(ctx, ENV.brickDark, 10, 8, w - 28, 16);
  fillPx(ctx, ENV.brickLite, 14, 10, 36, 6);
  fillPx(ctx, ENV.ink, 6, 20, w - 12, h - 26);
  fillPx(ctx, ENV.brick, 8, 22, w - 16, h - 32);
  for (let y = 28; y < h - 22; y += 9) {
    fillPx(ctx, ENV.brickDark, 8, y, w - 16, 1);
    for (let x = 14 + ((y / 9) % 2) * 7; x < w - 20; x += 15) {
      fillPx(ctx, ENV.inkSoft, x, y + 1, 1, 7);
    }
  }
  fillPx(ctx, ENV.ink, 18, 36, 16, 18);
  fillPx(ctx, ENV.glass, 20, 38, 12, 14);
  fillPx(ctx, ENV.ink, w - 42, 42, 14, 16);
  fillPx(ctx, ENV.burn, w - 40, 44, 10, 12);
  fillPx(ctx, ENV.inkSoft, w - 30, 8, 26, 36);
  fillPx(ctx, ENV.concreteDark, w - 26, 28, 20, 22);
  fillPx(ctx, ENV.dirt, 12, h - 16, 32, 8);
  fillPx(ctx, ENV.concrete, 8, h - 12, w - 18, 8);
  fillPx(ctx, ENV.concreteLite, 10, h - 10, w - 28, 3);
  fillPx(ctx, ENV.grass, w - 24, h - 18, 16, 6);
  fillPx(ctx, ENV.ink, 24, h - 48, 18, 32);
  fillPx(ctx, ENV.inkSoft, 26, h - 46, 14, 28);
  fillPx(ctx, ENV.woodDark, 36, h - 32, 3, 6);
};

export const drawCrate = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  if (variant === 'stack') {
    crateFace(ctx, 4, h - 34, 32, 30);
    crateFace(ctx, 6, 4, 30, 28);
    return;
  }
  if (variant === 'pair') {
    crateFace(ctx, 1, 4, 36, 28);
    crateFace(ctx, 41, 6, 36, 28);
    return;
  }
  crateFace(ctx, 2, 2, w - 4, h - 4);
};

export const drawBarricade = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, 0, 6, w, h - 6);
  if (variant === 'metal') {
    fillPx(ctx, ENV.metal, 1, 7, w - 2, h - 8);
    fillPx(ctx, ENV.metalLite, 3, 9, w - 6, 4);
    fillPx(ctx, ENV.rust, 10, 14, 16, 4);
    fillPx(ctx, ENV.inkSoft, 22, 7, 3, h - 8);
    fillPx(ctx, ENV.inkSoft, w - 26, 7, 3, h - 8);
    return;
  }
  fillPx(ctx, ENV.wood, 1, 7, w - 2, h - 8);
  fillPx(ctx, ENV.woodLite, 2, 8, w - 4, 4);
  fillPx(ctx, ENV.woodDark, 2, h - 8, w - 4, 4);
  fillPx(ctx, ENV.inkSoft, 18, 7, 2, h - 8);
  fillPx(ctx, ENV.inkSoft, w - 20, 7, 2, h - 8);
  fillPx(ctx, ENV.woodLite, 8, 4, 22, 5);
};

export const drawSandbag = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  const bags = variant === 'corner' ? 3 : 4;
  const bw = Math.floor((w - 4) / bags);
  for (let i = 0; i < bags; i += 1) {
    const x = 2 + i * bw;
    const y = i % 2 === 0 ? 2 : 6;
    box(ctx, x, y, bw - 1, h - y - 2, ENV.sand, ENV.sandLite, ENV.sandDark);
    fillPx(ctx, ENV.sandDark, x + 4, y + 4, bw - 9, 2);
  }
};

export const drawRubble = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  fillPx(ctx, ENV.inkSoft, 4, h - 10, w - 8, 8);
  fillPx(ctx, ENV.concreteDark, 2, 8, 18, 12);
  fillPx(ctx, ENV.concrete, 8, 4, 16, 10);
  fillPx(ctx, ENV.brickDark, w - 22, 10, 16, 12);
  fillPx(ctx, ENV.concreteLite, 18, h - 16, 14, 8);
  if (variant === 'pile') {
    fillPx(ctx, ENV.brick, 22, 6, 20, 14);
    fillPx(ctx, ENV.dirt, 6, h - 12, 22, 6);
    fillPx(ctx, ENV.grass, w - 16, h - 14, 10, 5);
  }
  strokePx(ctx, ENV.ink, 6, 6, 14, 10);
};

export const drawFence = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, 4, 2, 4, h - 2);
  fillPx(ctx, ENV.ink, w - 8, 2, 4, h - 2);
  fillPx(ctx, ENV.wood, 5, 3, 2, h - 6);
  fillPx(ctx, ENV.wood, w - 7, 3, 2, h - 6);
  if (variant === 'wire') {
    fillPx(ctx, ENV.metalLite, 8, 8, w - 16, 2);
    fillPx(ctx, ENV.metalLite, 8, 16, w - 16, 2);
    fillPx(ctx, ENV.metal, 8, 24, w - 16, 1);
    return;
  }
  fillPx(ctx, ENV.woodLite, 8, 8, w - 16, 5);
  fillPx(ctx, ENV.wood, 8, 16, w - 16, 5);
};

export const drawFire = (ctx: CanvasRenderingContext2D, _variant: string, w: number, h: number): void => {
  fillPx(ctx, ENV.burn, 2, h - 6, w - 4, 5);
  fillPx(ctx, ENV.fire, 4, 8, w - 8, h - 12);
  fillPx(ctx, ENV.fireCore, 6, 4, w - 12, h - 14);
  fillPx(ctx, ENV.paper, 8, 6, 3, 4);
};

export const ASSET_SIZE: Record<string, { w: number; h: number }> = {
  'wall:stone': { w: 124, h: 28 },
  'wall:ruin': { w: 90, h: 30 },
  'wall:wood': { w: 100, h: 26 },
  'tree:small': { w: 48, h: 56 },
  'tree:medium': { w: 56, h: 66 },
  'tree:broad': { w: 64, h: 60 },
  'crate:single': { w: 40, h: 36 },
  'crate:stack': { w: 42, h: 52 },
  'crate:pair': { w: 78, h: 36 },
  'building:house': { w: 120, h: 108 },
  'building:stub': { w: 120, h: 108 },
  'vehicle:truck': { w: 156, h: 74 },
  'vehicle:car': { w: 118, h: 62 },
  'barricade:wood': { w: 82, h: 30 },
  'barricade:metal': { w: 82, h: 30 },
  'sandbag:line': { w: 68, h: 26 },
  'sandbag:corner': { w: 68, h: 26 },
  'rubble:pile': { w: 58, h: 42 },
  'rubble:chunk': { w: 32, h: 24 },
  'fence:wood': { w: 92, h: 34 },
  'fence:wire': { w: 92, h: 34 },
  'fire:small': { w: 14, h: 18 },
};
