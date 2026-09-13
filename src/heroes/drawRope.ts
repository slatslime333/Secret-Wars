import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

const paletteFor = (rival: boolean, hitFlash: boolean) => {
  if (hitFlash) {
    return {
      rope: 0xe8b070,
      ropeDark: 0xa86a30,
      ropeDeep: 0x6a3a14,
      eye: 0xf0a0ff,
      eyeCore: 0xfff6ff,
      band: rival ? COLORS.redBright : COLORS.cyan,
    };
  }
  if (rival) {
    return {
      rope: 0x8a4a22,
      ropeDark: 0x5a2c12,
      ropeDeep: 0x3a1808,
      eye: 0xc040e8,
      eyeCore: 0xf4c8ff,
      band: COLORS.redBright,
    };
  }
  return {
    rope: 0xb56b32,
    ropeDark: 0x7a4218,
    ropeDeep: 0x4a240c,
    eye: 0xb428e0,
    eyeCore: 0xf0c8ff,
    band: COLORS.cyan,
  };
};

/**
 * Cole-sized male silhouette made of wrapped brown rope.
 * No human face — glowing purple triangles are the identifier.
 */
export const drawRope = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const palette = paletteFor(Boolean(opts.rival), Boolean(opts.hitFlash));
  const liftL = opts.armLiftLeft ?? 0;
  const liftR = opts.armLiftRight ?? 0;

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 22, 8);

  if (facing === 'east') {
    drawEast(graphics, palette, liftL, liftR);
    return;
  }
  if (facing === 'west') {
    drawWest(graphics, palette, liftL, liftR);
    return;
  }

  wrapBody(graphics, palette, -11, -6, 22, 20);
  wrapBody(graphics, palette, -8, 10, 7, 8, 2);
  wrapBody(graphics, palette, 1, 10, 7, 8, 2);

  graphics.fillStyle(palette.rope);
  graphics.fillCircle(0, -14, 11);
  wrapHead(graphics, palette, 0, -14, 11);

  graphics.fillStyle(palette.band);
  graphics.fillRect(-11, -18, 22, 4);

  drawEyes(graphics, palette, facing);

  const leftY = 0 - liftL * 10;
  const rightY = 0 - liftR * 10;
  wrapBody(graphics, palette, -14, leftY, 6, 12, 2);
  wrapBody(graphics, palette, 8, rightY, 6, 12, 2);
  graphics.fillStyle(palette.ropeDark);
  graphics.fillCircle(-11, leftY + 12, 3.4);
  graphics.fillCircle(11, rightY + 12, 3.4);
};

const drawEast = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  liftL: number,
  liftR: number,
): void => {
  wrapBody(graphics, palette, -9, -6, 20, 20);
  wrapBody(graphics, palette, -6, 10, 14, 8, 2);
  graphics.fillStyle(palette.rope);
  graphics.fillCircle(2, -14, 11);
  wrapHead(graphics, palette, 2, -14, 11);
  graphics.fillStyle(palette.band);
  graphics.fillRect(-8, -18, 20, 4);
  drawEyes(graphics, palette, 'east');
  const leftY = 2 - liftL * 8;
  const rightY = 0 - liftR * 10;
  wrapBody(graphics, palette, -12, leftY, 5, 10, 2);
  wrapBody(graphics, palette, 8, rightY, 6, 12, 2);
  graphics.fillStyle(palette.ropeDark);
  graphics.fillCircle(-10, leftY + 10, 3);
  graphics.fillCircle(12, rightY + 12, 3.4);
};

const drawWest = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  liftL: number,
  liftR: number,
): void => {
  wrapBody(graphics, palette, -11, -6, 20, 20);
  wrapBody(graphics, palette, -8, 10, 14, 8, 2);
  graphics.fillStyle(palette.rope);
  graphics.fillCircle(-2, -14, 11);
  wrapHead(graphics, palette, -2, -14, 11);
  graphics.fillStyle(palette.band);
  graphics.fillRect(-12, -18, 20, 4);
  drawEyes(graphics, palette, 'west');
  const leftY = 0 - liftL * 10;
  const rightY = 2 - liftR * 8;
  wrapBody(graphics, palette, -14, leftY, 6, 12, 2);
  wrapBody(graphics, palette, 7, rightY, 5, 10, 2);
  graphics.fillStyle(palette.ropeDark);
  graphics.fillCircle(-12, leftY + 12, 3.4);
  graphics.fillCircle(10, rightY + 10, 3);
};

const wrapBody = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 3,
): void => {
  graphics.fillStyle(palette.rope);
  graphics.fillRoundedRect(x, y, w, h, radius);
  graphics.fillStyle(palette.ropeDark, 0.55);
  graphics.fillRoundedRect(x + 1, y + 1, Math.max(2, w - 4), h - 2, Math.max(1, radius - 1));
  graphics.lineStyle(1, palette.ropeDeep, 0.9);
  const coils = Math.max(3, Math.round(h / 3.2));
  for (let i = 0; i < coils; i += 1) {
    const yy = y + 2 + i * ((h - 3) / coils);
    graphics.lineBetween(x + 1, yy, x + w - 1, yy + (i % 2 === 0 ? 0.8 : -0.8));
  }
};

const wrapHead = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  cx: number,
  cy: number,
  r: number,
): void => {
  graphics.lineStyle(1.2, palette.ropeDeep, 0.95);
  for (let i = 0; i < 5; i += 1) {
    const yy = cy - r + 4 + i * 3.4;
    graphics.beginPath();
    graphics.arc(cx, yy, r - 2.5, Math.PI * 0.15, Math.PI * 0.85);
    graphics.strokePath();
  }
  graphics.fillStyle(palette.ropeDark, 0.35);
  graphics.fillCircle(cx, cy + 1, r - 3);
};

const drawEyes = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  facing: CardinalFacing,
): void => {
  const triangle = (ox: number, oy: number) => {
    graphics.fillStyle(palette.eye, 1);
    graphics.fillTriangle(ox, oy - 4.5, ox + 4.2, oy + 3.2, ox - 4.2, oy + 3.2);
    graphics.fillStyle(palette.eyeCore, 0.95);
    graphics.fillTriangle(ox, oy - 1.6, ox + 1.6, oy + 1.4, ox - 1.6, oy + 1.4);
  };

  if (facing === 'south') {
    triangle(-5, -12);
    triangle(5, -12);
    return;
  }
  if (facing === 'east') {
    triangle(6, -12);
    return;
  }
  if (facing === 'west') {
    triangle(-6, -12);
    return;
  }
  triangle(0, -11);
};

export const ropeArmOrigin = (
  x: number,
  y: number,
  aimAngle: number,
  arm: -1 | 1,
  reach = 16,
): { x: number; y: number } => ({
  x: x + Math.cos(aimAngle + arm * 1.15) * reach,
  y: y + Math.sin(aimAngle + arm * 1.15) * reach - 8,
});
