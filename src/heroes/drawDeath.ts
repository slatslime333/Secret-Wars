import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

const paletteFor = (rival: boolean, hitFlash: boolean) => {
  if (hitFlash) {
    return {
      cloth: 0x3a2430,
      clothDark: 0x241018,
      fold: 0x4a3038,
      mask: 0x2a1820,
      void: 0x10080c,
      eye: COLORS.redBright,
      wood: 0xc68654,
      steel: 0xf6f1de,
      gun: 0x3a3a40,
    };
  }
  if (rival) {
    return {
      cloth: 0x1a1014,
      clothDark: 0x0c080a,
      fold: 0x241418,
      mask: 0x140c10,
      void: 0x080406,
      eye: COLORS.orange,
      wood: 0x6e4a24,
      steel: 0xc8c4b8,
      gun: 0x2a2224,
    };
  }
  return {
    cloth: 0x141418,
    clothDark: 0x08080c,
    fold: 0x1c1c22,
    mask: 0x0c0c10,
    void: 0x050508,
    eye: COLORS.redBright,
    wood: 0x8a5a28,
    steel: 0xd8d4c8,
    gun: 0x2a2a30,
  };
};

/**
 * Tall baggy silhouette in the same chunky pixel language as Ninja/Cole.
 * Face is only the mask void + two angry red triangles. Bat idle points down.
 */
export const drawDeath = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const palette = paletteFor(Boolean(opts.rival), Boolean(opts.hitFlash));
  const batAngle = idleBatAngle(facing) + (opts.swordAngleOffset ?? 0);
  const batScale = opts.batScale ?? 1;
  const batOnBack = Boolean(opts.batOnBack);
  const showUzi = Boolean(opts.showUzi);
  const liftR = opts.armLiftRight ?? 0;
  const liftL = opts.armLiftLeft ?? 0;

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.5);
  graphics.fillEllipse(facing === 'east' ? 2 : facing === 'west' ? -2 : 0, 26, 28, 9);

  if (facing === 'east') {
    drawDeathEast(graphics, palette, liftL, liftR, batAngle, batScale, batOnBack, showUzi);
    return;
  }
  if (facing === 'west') {
    drawDeathWest(graphics, palette, liftL, liftR, batAngle, batScale, batOnBack, showUzi);
    return;
  }

  const north = facing === 'north';
  graphics.fillStyle(palette.cloth);
  graphics.fillRoundedRect(-14, -12, 28, 34, 5);
  graphics.fillStyle(palette.clothDark);
  graphics.fillRect(-14, 16, 28, 8);
  graphics.fillStyle(palette.fold);
  graphics.fillRect(-7, -8, 4, 22);
  graphics.fillRect(4, -2, 5, 18);
  graphics.fillRoundedRect(-16, -8, 8, 18, 3);
  graphics.fillRoundedRect(8, -8, 8, 18, 3);

  if (batOnBack) {
    drawBat(graphics, palette, north ? 6 : -8, -10, north ? -1.35 : -1.15, 0.9);
  }

  graphics.fillStyle(palette.mask);
  graphics.fillCircle(0, -24, 13);
  graphics.fillRoundedRect(-12, -26, 24, 18, 6);
  graphics.fillStyle(palette.void, 0.92);
  graphics.fillCircle(0, -23, 8);
  graphics.fillRoundedRect(-8, -24, 16, 10, 4);

  if (!north) {
    graphics.fillStyle(palette.eye);
    graphics.fillTriangle(-8, -28, -1, -20, -9, -19);
    graphics.fillTriangle(8, -28, 1, -20, 9, -19);
  } else {
    graphics.fillStyle(palette.clothDark);
    graphics.fillRect(-10, -28, 20, 4);
  }

  const leftY = 4 - liftL * 8;
  const rightY = 4 - liftR * 8;
  graphics.fillStyle(palette.cloth);
  graphics.fillRect(-18, leftY, 7, 16);
  graphics.fillRect(11, rightY, 7, 16);
  graphics.fillStyle(0x2a2430);
  graphics.fillCircle(-15, leftY + 16, 3.4);
  graphics.fillCircle(15, rightY + 16, 3.4);

  if (!showUzi) {
    drawHolsteredUzi(graphics, palette, -12, 12, 1);
  }

  if (!batOnBack) {
    drawBat(graphics, palette, 15, rightY + 16, batAngle, batScale);
  }

  if (showUzi) {
    drawUzi(graphics, palette, 14, rightY + 8, 1);
  }
};

const drawDeathEast = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  liftL: number,
  liftR: number,
  batAngle: number,
  batScale: number,
  batOnBack: boolean,
  showUzi: boolean,
): void => {
  graphics.fillStyle(palette.cloth);
  graphics.fillRoundedRect(-10, -12, 24, 34, 5);
  graphics.fillStyle(palette.clothDark);
  graphics.fillRect(-10, 16, 24, 8);
  graphics.fillStyle(palette.fold);
  graphics.fillRect(2, -6, 5, 20);

  if (batOnBack) {
    drawBat(graphics, palette, -4, -12, -1.25, 0.85);
  }

  graphics.fillStyle(palette.mask);
  graphics.fillCircle(4, -24, 12);
  graphics.fillRoundedRect(-6, -26, 20, 16, 6);
  graphics.fillStyle(palette.void, 0.92);
  graphics.fillCircle(6, -23, 7);

  graphics.fillStyle(palette.eye);
  graphics.fillTriangle(6, -28, 13, -20, 5, -19);

  const backY = 6 - liftL * 6;
  const frontY = 4 - liftR * 8;
  graphics.fillStyle(palette.cloth);
  graphics.fillRect(-12, backY, 6, 12);
  graphics.fillRect(10, frontY, 7, 16);
  graphics.fillStyle(0x2a2430);
  graphics.fillCircle(-9, backY + 12, 3);
  graphics.fillCircle(14, frontY + 16, 3.4);

  if (!showUzi) {
    drawHolsteredUzi(graphics, palette, -1, 13, 1);
  }

  if (!batOnBack) {
    drawBat(graphics, palette, 14, frontY + 16, batAngle, batScale);
  }
  if (showUzi) {
    drawUzi(graphics, palette, 12, frontY + 8, 1);
  }
};

const drawDeathWest = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  liftL: number,
  liftR: number,
  batAngle: number,
  batScale: number,
  batOnBack: boolean,
  showUzi: boolean,
): void => {
  graphics.fillStyle(palette.cloth);
  graphics.fillRoundedRect(-14, -12, 24, 34, 5);
  graphics.fillStyle(palette.clothDark);
  graphics.fillRect(-14, 16, 24, 8);
  graphics.fillStyle(palette.fold);
  graphics.fillRect(-7, -6, 5, 20);

  if (batOnBack) {
    drawBat(graphics, palette, 4, -12, -1.9, 0.85);
  }

  graphics.fillStyle(palette.mask);
  graphics.fillCircle(-4, -24, 12);
  graphics.fillRoundedRect(-14, -26, 20, 16, 6);
  graphics.fillStyle(palette.void, 0.92);
  graphics.fillCircle(-6, -23, 7);

  graphics.fillStyle(palette.eye);
  graphics.fillTriangle(-6, -28, -13, -20, -5, -19);

  const backY = 6 - liftR * 6;
  const frontY = 4 - liftL * 8;
  graphics.fillStyle(palette.cloth);
  graphics.fillRect(6, backY, 6, 12);
  graphics.fillRect(-17, frontY, 7, 16);
  graphics.fillStyle(0x2a2430);
  graphics.fillCircle(9, backY + 12, 3);
  graphics.fillCircle(-14, frontY + 16, 3.4);

  if (!showUzi) {
    drawHolsteredUzi(graphics, palette, 1, 13, -1);
  }

  if (!batOnBack) {
    drawBat(graphics, palette, -14, frontY + 16, batAngle, batScale);
  }
  if (showUzi) {
    drawUzi(graphics, palette, -18, frontY + 8, -1);
  }
};

export const deathIdleBatAngle = (facing: CardinalFacing): number => {
  if (facing === 'west') {
    return 2.0;
  }
  if (facing === 'north') {
    return 1.85;
  }
  return 1.45;
};

const idleBatAngle = deathIdleBatAngle;

/** Muzzle tip in sprite space while the Uzi is drawn. */
export const deathUziMuzzleOffset = (facing: CardinalFacing, armLiftRight = 0.35): { x: number; y: number } => {
  const frontY = 4 - armLiftRight * 8;
  if (facing === 'west') {
    return { x: -40, y: frontY + 9 };
  }
  if (facing === 'east') {
    return { x: 34, y: frontY + 9 };
  }
  return { x: 36, y: frontY + 9 };
};

const drawBat = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  hx: number,
  hy: number,
  angle: number,
  scale: number,
): void => {
  const length = 30 * scale;
  const thick = 3.4 * scale;
  const tx = hx + Math.cos(angle) * length;
  const ty = hy + Math.sin(angle) * length;
  graphics.lineStyle(thick + 2, COLORS.ink, 1);
  graphics.lineBetween(hx, hy, tx, ty);
  graphics.lineStyle(thick, palette.wood, 1);
  graphics.lineBetween(hx, hy, tx, ty);
  graphics.fillStyle(palette.steel);
  const nx = Math.cos(angle + 0.9);
  const ny = Math.sin(angle + 0.9);
  for (let i = 3; i <= 6; i += 1) {
    const px = hx + Math.cos(angle) * (length * (i / 7));
    const py = hy + Math.sin(angle) * (length * (i / 7));
    graphics.fillCircle(px + nx * 2.2 * scale, py + ny * 2.2 * scale, 1.15 * scale);
  }
};

const drawHolsteredUzi = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  x: number,
  y: number,
  facing: 1 | -1,
): void => {
  const bodyX = facing === 1 ? x : x - 12;
  graphics.fillStyle(COLORS.ink, 1);
  graphics.fillRect(bodyX - 1, y - 1, 14, 7);
  graphics.fillStyle(palette.gun);
  graphics.fillRect(bodyX, y, 12, 5);
  graphics.fillRect(facing === 1 ? x : x - 4, y + 4, 4, 6);
  graphics.fillStyle(0x1a1a22);
  graphics.fillRect(facing === 1 ? x + 4 : x - 8, y + 4, 3, 7);
  graphics.fillStyle(palette.steel);
  graphics.fillRect(facing === 1 ? x + 12 : x - 17, y + 1, 6, 2);
  graphics.fillRect(facing === 1 ? x + 10 : x - 12, y - 2, 2, 3);
  graphics.fillStyle(0xf4e8b0);
  graphics.fillRect(facing === 1 ? x + 16 : x - 18, y + 1, 2, 2);
};

const drawUzi = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  x: number,
  y: number,
  facing: 1 | -1,
): void => {
  const bodyX = facing === 1 ? x : x - 14;
  graphics.fillStyle(COLORS.ink, 1);
  graphics.fillRect(bodyX - 1, y - 3, 16, 8);
  graphics.fillStyle(palette.gun);
  graphics.fillRect(bodyX, y - 2, 14, 6);
  graphics.fillRect(facing === 1 ? x - 3 : x + 14, y - 1, 3, 4);
  graphics.fillRect(facing === 1 ? x + 1 : x - 5, y + 3, 4, 7);
  graphics.fillStyle(0x141418);
  graphics.fillRect(facing === 1 ? x + 6 : x - 9, y + 3, 3, 8);
  graphics.fillRect(facing === 1 ? x + 14 : x - 22, y, 8, 3);
  graphics.fillStyle(palette.steel);
  graphics.fillRect(facing === 1 ? x + 11 : x - 13, y - 4, 2, 3);
  graphics.fillRect(facing === 1 ? x + 21 : x - 24, y, 3, 3);
  graphics.fillStyle(0xf4e8b0);
  graphics.fillRect(facing === 1 ? x + 23 : x - 25, y + 1, 2, 1);
};
