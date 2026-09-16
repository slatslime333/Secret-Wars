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

const wallWearOf = (variant: string): 'intact' | 'damaged' | 'cracked' => {
  if (variant.includes('cracked')) {
    return 'cracked';
  }
  if (variant.includes('damaged')) {
    return 'damaged';
  }
  return 'intact';
};

const paintWallCracks = (ctx: CanvasRenderingContext2D, w: number, h: number, wear: 'intact' | 'damaged' | 'cracked'): void => {
  if (wear === 'intact') {
    return;
  }
  fillPx(ctx, ENV.inkSoft, 18, 6, 2, h - 10);
  fillPx(ctx, ENV.ink, 42, 4, 2, Math.floor(h * 0.55));
  fillPx(ctx, ENV.inkSoft, 68, 8, w > 80 ? 22 : 12, 2);
  if (wear === 'cracked') {
    fillPx(ctx, ENV.ink, 28, 3, 3, h - 6);
    fillPx(ctx, ENV.dirt, 52, h - 10, 16, 6);
    fillPx(ctx, ENV.concreteDark, 8, 2, 10, h - 6);
    fillPx(ctx, ENV.inkSoft, w - 24, 4, 8, h - 8);
  }
};

export const drawWall = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  const wear = wallWearOf(variant);
  fillPx(ctx, ENV.ink, 0, 0, w, h);
  if (variant.startsWith('wood')) {
    fillPx(ctx, ENV.wood, 1, 1, w - 2, h - 2);
    fillPx(ctx, ENV.woodLite, 2, 2, w - 4, 4);
    fillPx(ctx, ENV.woodDark, 2, h - 6, w - 4, 4);
    for (let x = 18; x < w - 8; x += 22) {
      fillPx(ctx, ENV.inkSoft, x, 1, 2, h - 2);
    }
    paintWallCracks(ctx, w, h, wear);
    return;
  }
  fillPx(ctx, ENV.concrete, 1, 1, w - 2, h - 2);
  fillPx(ctx, ENV.concreteLite, 2, 2, w - 4, 4);
  fillPx(ctx, ENV.concreteDark, 2, h - 6, w - 4, 4);
  for (let x = 16; x < w - 6; x += 18) {
    fillPx(ctx, ENV.inkSoft, x, 1, 2, h - 2);
  }
  if (variant.startsWith('ruin')) {
    fillPx(ctx, ENV.grass, w - 22, 1, 18, 8);
    fillPx(ctx, ENV.dirt, w - 28, h - 8, 14, 5);
    fillPx(ctx, ENV.inkSoft, w - 16, 8, 12, h - 10);
  }
  paintWallCracks(ctx, w, h, wear);
};

export const drawTree = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  const wide = variant === 'broad';
  const tall = variant === 'medium';
  const canopyW = wide ? w - 6 : tall ? w - 10 : w - 12;
  const canopyH = wide ? Math.floor(h * 0.58) : tall ? Math.floor(h * 0.62) : Math.floor(h * 0.56);
  const left = Math.round((w - canopyW) / 2);
  const top = tall ? 4 : 6;
  const trunkW = wide ? 12 : tall ? 10 : 9;
  const trunkH = Math.max(18, h - canopyH - 10);
  const trunkX = Math.round(w / 2) - Math.floor(trunkW / 2);
  fillPx(ctx, ENV.trunkDark, trunkX, h - trunkH, trunkW, trunkH);
  fillPx(ctx, ENV.trunk, trunkX + 1, h - trunkH, trunkW - 3, trunkH - 2);
  fillPx(ctx, ENV.ink, left - 1, top + 2, canopyW + 2, canopyH + 2);
  fillPx(ctx, ENV.canopy, left, top + 4, canopyW, canopyH);
  fillPx(ctx, ENV.canopyLite, left + 6, top, canopyW - 14, Math.floor(canopyH * 0.62));
  fillPx(ctx, ENV.canopyTip, left + 14, top + 6, Math.max(12, canopyW - 32), 8);
  fillPx(ctx, ENV.canopy, left + 10, top + Math.floor(canopyH * 0.45), canopyW - 22, Math.floor(canopyH * 0.4));
  fillPx(ctx, ENV.inkSoft, trunkX + 2, h - 8, trunkW - 4, 4);
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
  const wreck = variant.includes('wreck');
  const damaged = variant.includes('damaged') || wreck;
  const truck = variant.startsWith('truck');
  fillPx(ctx, ENV.inkSoft, 8, h - 14, w - 16, 8);
  fillPx(ctx, ENV.ink, 3, wreck ? 14 : 8, w - 6, h - (wreck ? 20 : 16));
  fillPx(ctx, truck ? ENV.rust : wreck ? ENV.burn : ENV.metal, 5, wreck ? 16 : 10, w - 10, h - (wreck ? 24 : 20));
  fillPx(ctx, truck ? ENV.rustLite : ENV.metalLite, 7, wreck ? 18 : 12, w - 14, h - (wreck ? 30 : 26));
  const cab = truck ? Math.floor(w * 0.3) : Math.floor(w * 0.4);
  if (!wreck) {
    fillPx(ctx, ENV.ink, 7, 6, cab, h - 20);
    fillPx(ctx, truck ? ENV.oliveDark : ENV.metalLite, 9, 8, cab - 4, h - 26);
    fillPx(ctx, ENV.glass, 13, 14, cab - 14, 14);
    fillPx(ctx, ENV.paper, 15, 16, 6, 4);
    fillPx(ctx, ENV.ink, 17, 20, cab - 26, 6);
    fillPx(ctx, ENV.burn, cab + 6, 18, 22, 10);
    fillPx(ctx, ENV.rust, w - 32, h - 28, 18, 10);
  } else {
    fillPx(ctx, ENV.burn, 10, 20, cab - 4, h - 36);
    fillPx(ctx, ENV.rust, cab + 8, 22, 28, 10);
    fillPx(ctx, ENV.dirt, 18, h - 22, 36, 8);
  }
  const wheelY = h - 16;
  paintWheel(ctx, 12, wheelY);
  if (!wreck) {
    paintWheel(ctx, w - 32, wheelY);
  }
  if (truck) {
    paintWheel(ctx, Math.floor(w * 0.42), wheelY);
    fillPx(ctx, ENV.oliveDark, cab + 4, 12, w - cab - 16, 8);
    fillPx(ctx, ENV.crateDark, cab + 12, 24, 22, 16);
    fillPx(ctx, ENV.crate, cab + 14, 26, 18, 12);
    fillPx(ctx, ENV.inkSoft, cab + 36, 26, 10, 14);
    fillPx(ctx, ENV.metalLite, cab + 8, h - 26, w - cab - 22, 4);
  } else if (!wreck) {
    fillPx(ctx, ENV.rustLite, cab + 8, 26, 18, 4);
    fillPx(ctx, ENV.glass, cab + 12, 14, 18, 8);
  }
  if (damaged) {
    fillPx(ctx, ENV.burn, cab + 4, 16, 16, 8);
    fillPx(ctx, ENV.inkSoft, 22, 12, 8, 6);
    fillPx(ctx, ENV.dirt, w - 40, h - 22, 18, 6);
  }
};

const buildingStyleOf = (variant: string): 'shop' | 'stub' | 'house' => {
  if (variant.startsWith('shop')) {
    return 'shop';
  }
  if (variant.startsWith('stub')) {
    return 'stub';
  }
  return 'house';
};

const paintBrickBody = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, x, y, w, h);
  fillPx(ctx, ENV.brick, x + 2, y + 2, w - 4, h - 4);
  for (let row = y + 8; row < y + h - 8; row += 9) {
    fillPx(ctx, ENV.brickDark, x + 2, row, w - 4, 1);
    for (let col = x + 6 + ((row / 9) % 2) * 7; col < x + w - 8; col += 15) {
      fillPx(ctx, ENV.inkSoft, col, row + 1, 1, 7);
    }
  }
};

const drawBuildingInterior = (ctx: CanvasRenderingContext2D, style: 'shop' | 'stub' | 'house', w: number, h: number): void => {
  fillPx(ctx, ENV.ink, 10, 22, w - 20, h - 34);
  if (style === 'shop') {
    fillPx(ctx, ENV.concrete, 12, 24, w - 24, h - 38);
    fillPx(ctx, ENV.sidewalkLite, 14, 26, w - 28, 5);
    for (let x = 24; x < w - 40; x += 24) {
      fillPx(ctx, ENV.inkSoft, x, 34, 18, 2);
    }
    fillPx(ctx, ENV.woodDark, 22, 52, 36, 78);
    fillPx(ctx, ENV.wood, 24, 54, 32, 74);
    fillPx(ctx, ENV.crate, 28, 62, 20, 12);
    fillPx(ctx, ENV.crate, 28, 80, 20, 12);
    fillPx(ctx, ENV.crateLite, 28, 98, 20, 12);
    fillPx(ctx, ENV.woodDark, w - 92, 96, 56, 24);
    fillPx(ctx, ENV.woodLite, w - 90, 98, 52, 8);
    fillPx(ctx, ENV.metal, w - 64, 90, 16, 8);
    fillPx(ctx, ENV.wood, 96, 64, 52, 28);
    fillPx(ctx, ENV.woodLite, 98, 66, 48, 6);
    fillPx(ctx, ENV.crate, w - 78, 58, 22, 18);
  } else {
    fillPx(ctx, ENV.wood, 12, 24, w - 24, h - 38);
    fillPx(ctx, ENV.woodLite, 14, 26, w - 28, 5);
    for (let y = 40; y < h - 32; y += 12) {
      fillPx(ctx, ENV.woodDark, 14, y, w - 28, 1);
    }
    fillPx(ctx, ENV.woodDark, 32, 70, 52, 28);
    fillPx(ctx, ENV.woodLite, 34, 72, 48, 8);
    fillPx(ctx, ENV.inkSoft, 52, 84, 10, 10);
    fillPx(ctx, ENV.oliveDark, w - 96, 62, 52, 26);
    fillPx(ctx, ENV.oliveLite, w - 94, 64, 48, 8);
    fillPx(ctx, ENV.wood, 110, 118, 40, 20);
    fillPx(ctx, ENV.crate, 114, 122, 14, 10);
  }
  const doorW = 48;
  const doorX = Math.floor(w / 2) - Math.floor(doorW / 2);
  fillPx(ctx, ENV.concrete, 12, h - 28, w - 24, 12);
  fillPx(ctx, ENV.inkSoft, doorX, h - 32, doorW, 20);
  fillPx(ctx, ENV.woodDark, doorX + 4, h - 28, doorW - 8, 14);
  fillPx(ctx, ENV.inkSoft, doorX, 24, doorW, 18);
  fillPx(ctx, ENV.woodDark, doorX + 4, 28, doorW - 8, 12);
};

const drawDoorGap = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, x - 3, y - 2, w + 6, h + 4);
  fillPx(ctx, ENV.woodDark, x - 1, y, w + 2, h);
  fillPx(ctx, ENV.inkSoft, x + 3, y + 3, w - 6, h - 6);
  fillPx(ctx, ENV.ink, x + 5, y + 5, w - 14, h - 10);
  fillPx(ctx, ENV.wood, x + 4, y + 4, 8, h - 10);
  fillPx(ctx, ENV.woodLite, x + 5, y + 6, 3, h - 14);
  fillPx(ctx, ENV.woodDark, x + w - 10, y + Math.floor(h / 2) - 3, 5, 8);
};

const drawStoop = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, x - 2, y, w + 4, h);
  fillPx(ctx, ENV.concrete, x, y + 1, w, h - 2);
  fillPx(ctx, ENV.concreteLite, x + 2, y + 2, w - 4, 3);
  fillPx(ctx, ENV.concreteDark, x + 4, y + h - 4, w - 8, 2);
};

const drawBuildingShell = (ctx: CanvasRenderingContext2D, style: 'shop' | 'stub' | 'house', w: number, h: number): void => {
  const wall = 14;
  const doorW = 48;
  const doorX = Math.floor(w / 2) - Math.floor(doorW / 2);
  const northY = 28;
  const southY = h - 28;
  paintBrickBody(ctx, 8, northY, doorX - 12, wall);
  paintBrickBody(ctx, doorX + doorW + 4, northY, w - (doorX + doorW) - 12, wall);
  paintBrickBody(ctx, 8, northY, wall, southY - northY + wall);
  paintBrickBody(ctx, w - 22, northY, wall, southY - northY + wall);
  paintBrickBody(ctx, 8, southY, doorX - 12, wall);
  paintBrickBody(ctx, doorX + doorW + 4, southY, w - (doorX + doorW) - 12, wall);
  drawStoop(ctx, doorX - 4, 14, doorW + 8, 14);
  drawDoorGap(ctx, doorX, northY - 4, doorW, wall + 10);
  drawStoop(ctx, doorX - 4, h - 16, doorW + 8, 14);
  drawDoorGap(ctx, doorX, southY - 6, doorW, wall + 10);
  if (style === 'shop') {
    fillPx(ctx, ENV.ink, 28, northY + wall + 8, 32, 22);
    fillPx(ctx, ENV.glass, 30, northY + wall + 10, 28, 18);
    fillPx(ctx, ENV.ink, w - 68, northY + wall + 8, 32, 22);
    fillPx(ctx, ENV.glass, w - 66, northY + wall + 10, 28, 18);
  } else {
    fillPx(ctx, ENV.ink, 28, northY + wall + 10, 22, 18);
    fillPx(ctx, ENV.glass, 30, northY + wall + 12, 18, 14);
    fillPx(ctx, ENV.ink, w - 56, northY + wall + 10, 22, 18);
    fillPx(ctx, ENV.glass, w - 54, northY + wall + 12, 18, 14);
  }
  fillPx(ctx, ENV.grass, w - 36, h - 20, 18, 6);
};

const drawBuildingRoof = (ctx: CanvasRenderingContext2D, style: 'shop' | 'stub' | 'house', w: number, _h: number): void => {
  fillPx(ctx, ENV.ink, 6, 2, w - 18, 22);
  fillPx(ctx, style === 'shop' ? ENV.rust : ENV.brickDark, 8, 4, w - 22, 16);
  fillPx(ctx, style === 'shop' ? ENV.rustLite : ENV.brickLite, 12, 6, 48, 5);
  if (style === 'shop') {
    fillPx(ctx, ENV.ink, 20, 8, 56, 12);
    fillPx(ctx, ENV.paper, 22, 10, 52, 8);
    fillPx(ctx, ENV.inkSoft, 28, 12, 8, 4);
    fillPx(ctx, ENV.inkSoft, 42, 12, 8, 4);
    fillPx(ctx, ENV.inkSoft, 56, 12, 8, 4);
  }
  fillPx(ctx, ENV.inkSoft, w - 32, 4, 18, 20);
  fillPx(ctx, ENV.concreteDark, w - 28, 16, 12, 14);
  if (style === 'stub') {
    fillPx(ctx, ENV.dirt, 16, 12, 28, 8);
    fillPx(ctx, ENV.grass, w - 52, 8, 14, 6);
  }
};

const drawBuildingLandmark = (ctx: CanvasRenderingContext2D, style: 'shop' | 'stub' | 'house', w: number, h: number): void => {
  drawBuildingRoof(ctx, style, w, h);
  paintBrickBody(ctx, 6, 24, w - 12, h - 30);
  if (style === 'shop') {
    fillPx(ctx, ENV.ink, 16, 36, 28, 22);
    fillPx(ctx, ENV.glass, 18, 38, 24, 18);
    fillPx(ctx, ENV.ink, 52, 36, 28, 22);
    fillPx(ctx, ENV.glass, 54, 38, 24, 18);
    fillPx(ctx, ENV.rust, 14, 32, 70, 6);
  } else {
    fillPx(ctx, ENV.ink, 18, 36, 16, 18);
    fillPx(ctx, ENV.glass, 20, 38, 12, 14);
  }
  fillPx(ctx, ENV.ink, 24, h - 48, 18, 32);
  fillPx(ctx, ENV.inkSoft, 26, h - 46, 14, 28);
  fillPx(ctx, ENV.woodDark, 36, h - 32, 3, 6);
  fillPx(ctx, ENV.concrete, 8, h - 12, w - 18, 8);
  fillPx(ctx, ENV.grass, w - 24, h - 18, 16, 6);
  if (style === 'stub') {
    fillPx(ctx, ENV.dirt, 12, h - 16, 32, 8);
    fillPx(ctx, ENV.inkSoft, w - 30, 8, 26, 36);
  }
};

export const drawBuilding = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  const style = buildingStyleOf(variant);
  if (variant.endsWith('-floor')) {
    drawBuildingInterior(ctx, style, w, h);
    return;
  }
  if (variant.endsWith('-roof')) {
    drawBuildingRoof(ctx, style, w, h);
    return;
  }
  if (variant.endsWith('-shell')) {
    drawBuildingShell(ctx, style, w, h);
    return;
  }
  drawBuildingLandmark(ctx, style, w, h);
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

export const drawBarrel = (ctx: CanvasRenderingContext2D, _variant: string, w: number, h: number): void => {
  fillPx(ctx, ENV.ink, 2, 2, w - 4, h - 4);
  fillPx(ctx, ENV.rust, 3, 4, w - 6, h - 8);
  fillPx(ctx, ENV.rustLite, 5, 6, w - 10, 5);
  fillPx(ctx, ENV.inkSoft, 4, 12, w - 8, 3);
  fillPx(ctx, ENV.inkSoft, 4, h - 14, w - 8, 3);
  const sx = Math.floor(w / 2) - 5;
  const sy = Math.floor(h / 2) - 6;
  fillPx(ctx, ENV.paper, sx, sy + 2, 10, 10);
  fillPx(ctx, ENV.paper, sx + 1, sy, 8, 3);
  fillPx(ctx, ENV.ink, sx + 2, sy + 4, 2, 3);
  fillPx(ctx, ENV.ink, sx + 6, sy + 4, 2, 3);
  fillPx(ctx, ENV.ink, sx + 4, sy + 8, 2, 2);
  fillPx(ctx, ENV.ink, sx + 2, sy + 10, 6, 1);
  fillPx(ctx, ENV.fire, 6, 8, w - 12, 2);
};

export const drawLamp = (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number): void => {
  const poleX = Math.floor(w / 2) - 1;
  fillPx(ctx, ENV.ink, poleX - 1, 16, 4, h - 16);
  fillPx(ctx, ENV.metal, poleX, 18, 2, h - 20);
  fillPx(ctx, ENV.concreteDark, poleX - 3, h - 6, 8, 5);
  const headY = variant === 'short' ? 4 : 2;
  fillPx(ctx, ENV.ink, 2, headY, w - 4, 16);
  fillPx(ctx, ENV.metalLite, 3, headY + 1, w - 6, 14);
  fillPx(ctx, ENV.fireCore, 5, headY + 4, w - 10, 8);
  fillPx(ctx, ENV.paper, 7, headY + 6, w - 14, 4);
};

export const ASSET_SIZE: Record<string, { w: number; h: number }> = {
  'wall:stone': { w: 124, h: 28 },
  'wall:stone-damaged': { w: 124, h: 28 },
  'wall:stone-cracked': { w: 124, h: 28 },
  'wall:ruin': { w: 90, h: 30 },
  'wall:ruin-damaged': { w: 90, h: 30 },
  'wall:ruin-cracked': { w: 90, h: 30 },
  'wall:wood': { w: 100, h: 26 },
  'wall:wood-damaged': { w: 100, h: 26 },
  'wall:wood-cracked': { w: 100, h: 26 },
  'tree:small': { w: 100, h: 156 },
  'tree:medium': { w: 120, h: 196 },
  'tree:broad': { w: 148, h: 168 },
  'crate:single': { w: 40, h: 36 },
  'crate:stack': { w: 42, h: 52 },
  'crate:pair': { w: 78, h: 36 },
  'building:house': { w: 288, h: 248 },
  'building:house-floor': { w: 288, h: 248 },
  'building:house-roof': { w: 288, h: 248 },
  'building:house-shell': { w: 288, h: 248 },
  'building:stub': { w: 120, h: 108 },
  'building:stub-floor': { w: 120, h: 108 },
  'building:stub-roof': { w: 120, h: 108 },
  'building:stub-shell': { w: 120, h: 108 },
  'building:shop': { w: 288, h: 248 },
  'building:shop-floor': { w: 288, h: 248 },
  'building:shop-roof': { w: 288, h: 248 },
  'building:shop-shell': { w: 288, h: 248 },
  'vehicle:truck': { w: 156, h: 74 },
  'vehicle:truck-damaged': { w: 156, h: 74 },
  'vehicle:car': { w: 118, h: 62 },
  'vehicle:car-damaged': { w: 118, h: 62 },
  'vehicle:car-wreck': { w: 118, h: 62 },
  'barricade:wood': { w: 82, h: 30 },
  'barricade:metal': { w: 82, h: 30 },
  'sandbag:line': { w: 68, h: 26 },
  'sandbag:corner': { w: 68, h: 26 },
  'rubble:pile': { w: 58, h: 42 },
  'rubble:chunk': { w: 32, h: 24 },
  'fence:wood': { w: 92, h: 34 },
  'fence:wire': { w: 92, h: 34 },
  'barrel:drum': { w: 34, h: 44 },
  'barrel:fuel': { w: 34, h: 44 },
  'barrel:skull': { w: 34, h: 44 },
  'lamp:street': { w: 22, h: 96 },
  'lamp:short': { w: 18, h: 68 },
  'fire:small': { w: 14, h: 18 },
};
