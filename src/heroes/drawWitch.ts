import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

type Palette = {
  skin: number;
  skinDark: number;
  hair: number;
  hairDark: number;
  eye: number;
  eyeDark: number;
  top: number;
  topDark: number;
  sash: number;
  skirt: number;
  skirtDark: number;
  hat: number;
  hatBand: number;
  wood: number;
  bone: number;
  band: number;
};

const paletteFor = (rival: boolean, hitFlash: boolean): Palette => {
  if (hitFlash) {
    return {
      skin: 0xf0d8ff,
      skinDark: 0xc8a0e0,
      hair: 0x8a40b8,
      hairDark: 0x5a2080,
      eye: 0xc8ff90,
      eyeDark: 0x1a4010,
      top: 0xff6a6a,
      topDark: 0x3a1020,
      sash: 0xc060e8,
      skirt: 0x4a1830,
      skirtDark: 0x240818,
      hat: 0x2a2a32,
      hatBand: 0x9b4dff,
      wood: 0xd4a06a,
      bone: 0xfff6de,
      band: rival ? COLORS.redBright : COLORS.cyan,
    };
  }
  if (rival) {
    return {
      skin: 0xa070c4,
      skinDark: 0x6a4088,
      hair: 0x2a0c40,
      hairDark: 0x140820,
      eye: 0x3cb848,
      eyeDark: 0x102008,
      top: 0x8a1824,
      topDark: 0x14080c,
      sash: 0x6a2088,
      skirt: 0x1a0810,
      skirtDark: 0x0c0408,
      hat: 0x0c0c10,
      hatBand: 0x6a2088,
      wood: 0x6e4a24,
      bone: 0xd8d0c0,
      band: COLORS.redBright,
    };
  }
  return {
    skin: 0xc8a0e8,
    skinDark: 0x9a70c0,
    hair: 0x4a1a6a,
    hairDark: 0x2a0c40,
    eye: 0x4cff6a,
    eyeDark: 0x143018,
    top: 0xc42838,
    topDark: 0x1a0c12,
    sash: 0x7a28a8,
    skirt: 0x241018,
    skirtDark: 0x10080c,
    hat: 0x121218,
    hatBand: 0x7a28a8,
    wood: 0x8a5a28,
    bone: 0xf0ead8,
    band: COLORS.cyan,
  };
};

/**
 * Cole-sized witch: slim oval face, curvy feminine silhouette, crop top,
 * skirt, black hat, skull staff. Same chunky pixel language.
 */
export const drawWitch = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const palette = paletteFor(Boolean(opts.rival), Boolean(opts.hitFlash));
  const liftL = opts.armLiftLeft ?? 0;
  const liftR = opts.armLiftRight ?? 0;
  const staffRaise = opts.staffRaise ?? 0;

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 20, 7);

  if (facing === 'east') {
    drawEast(graphics, palette, liftL, liftR, staffRaise);
    return;
  }
  if (facing === 'west') {
    drawWest(graphics, palette, liftL, liftR, staffRaise);
    return;
  }

  drawFront(graphics, palette, facing === 'north', liftL, liftR, staffRaise);
};

const drawEast = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  liftL: number,
  liftR: number,
  staffRaise: number,
): void => {
  const leftY = 1 - liftL * 8;
  const rightY = 1 - liftR * 9 - staffRaise * 6;

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-9, 9, 6, 8, 2);
  g.fillRoundedRect(2, 9, 6, 8, 2);
  g.fillStyle(p.skin);
  g.fillRect(-8, 9, 4, 6);
  g.fillRect(3, 9, 4, 6);

  g.fillStyle(p.skirtDark);
  g.fillRoundedRect(-12, 5, 24, 8, 4);
  g.fillStyle(p.skirt);
  g.fillRoundedRect(-11, 4, 22, 7, 4);
  g.fillStyle(p.sash);
  g.fillRect(-8, 4, 16, 2);

  g.fillStyle(p.skin);
  g.fillRect(-5, 1, 10, 4);

  g.fillStyle(p.topDark);
  g.fillRoundedRect(-9, -8, 18, 11, 4);
  g.fillStyle(p.top);
  g.fillEllipse(0, -5, 17, 8);
  g.fillRoundedRect(-7, -6, 14, 7, 3);
  g.fillStyle(p.sash);
  g.fillRect(-7, -1, 14, 2);
  g.fillStyle(p.band);
  g.fillRect(-8, -8, 16, 3);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-13, leftY - 2, 5, 11, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-12, leftY - 1, 4, 9, 2);

  g.fillStyle(p.hairDark);
  g.fillCircle(1, -16, 11);
  g.fillStyle(p.hair);
  g.fillCircle(1, -16, 9);
  g.fillRoundedRect(-8, -18, 16, 8, 4);

  g.fillStyle(p.skinDark);
  g.fillEllipse(2, -14.4, 6.2, 9.2);
  g.fillStyle(p.skin);
  g.fillEllipse(2, -14.4, 5.2, 8.2);

  g.fillStyle(p.hair);
  g.fillRect(-6, -22, 14, 6);
  g.fillTriangle(-8, -16, -2, -16, -7, -8);
  g.fillTriangle(8, -18, 12, -12, 6, -10);

  drawEyes(g, p, 2, -14, 1);
  drawHat(g, p, 1, -24);
  drawStaff(g, p, 11, rightY - 2, -1.15 - staffRaise * 0.7);
};

const drawWest = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  liftL: number,
  liftR: number,
  staffRaise: number,
): void => {
  const leftY = 1 - liftL * 9 - staffRaise * 6;
  const rightY = 1 - liftR * 8;

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-8, 9, 6, 8, 2);
  g.fillRoundedRect(3, 9, 6, 8, 2);
  g.fillStyle(p.skin);
  g.fillRect(-7, 9, 4, 6);
  g.fillRect(4, 9, 4, 6);

  g.fillStyle(p.skirtDark);
  g.fillRoundedRect(-12, 5, 24, 8, 4);
  g.fillStyle(p.skirt);
  g.fillRoundedRect(-11, 4, 22, 7, 4);
  g.fillStyle(p.sash);
  g.fillRect(-8, 4, 16, 2);

  g.fillStyle(p.skin);
  g.fillRect(-5, 1, 10, 4);

  g.fillStyle(p.topDark);
  g.fillRoundedRect(-9, -8, 18, 11, 4);
  g.fillStyle(p.top);
  g.fillEllipse(0, -5, 17, 8);
  g.fillRoundedRect(-7, -6, 14, 7, 3);
  g.fillStyle(p.sash);
  g.fillRect(-7, -1, 14, 2);
  g.fillStyle(p.band);
  g.fillRect(-8, -8, 16, 3);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(8, rightY - 2, 5, 11, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(8, rightY - 1, 4, 9, 2);

  g.fillStyle(p.hairDark);
  g.fillCircle(-1, -16, 11);
  g.fillStyle(p.hair);
  g.fillCircle(-1, -16, 9);
  g.fillRoundedRect(-8, -18, 16, 8, 4);

  g.fillStyle(p.skinDark);
  g.fillEllipse(-2, -14.4, 6.2, 9.2);
  g.fillStyle(p.skin);
  g.fillEllipse(-2, -14.4, 5.2, 8.2);

  g.fillStyle(p.hair);
  g.fillRect(-8, -22, 14, 6);
  g.fillTriangle(8, -16, 2, -16, 7, -8);
  g.fillTriangle(-8, -18, -12, -12, -6, -10);

  drawEyes(g, p, -2, -14, -1);
  drawHat(g, p, -1, -24);
  drawStaff(g, p, -11, leftY - 2, -1.95 + staffRaise * 0.7);
};

const drawFront = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  north: boolean,
  liftL: number,
  liftR: number,
  staffRaise: number,
): void => {
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-8, 9, 6, 8, 2);
  g.fillRoundedRect(2, 9, 6, 8, 2);
  g.fillStyle(p.skin);
  g.fillRect(-7, 9, 4, 6);
  g.fillRect(3, 9, 4, 6);

  g.fillStyle(p.skirtDark);
  g.fillRoundedRect(-12, 5, 24, 8, 4);
  g.fillStyle(p.skirt);
  g.fillRoundedRect(-11, 4, 22, 7, 4);

  g.fillStyle(p.skin);
  g.fillRect(-4, 1, 8, 4);

  g.fillStyle(p.topDark);
  g.fillRoundedRect(-9, -8, 18, 11, 4);
  g.fillStyle(p.top);
  g.fillEllipse(0, -5, 17, 8);
  g.fillRoundedRect(-7, -6, 14, 7, 3);
  g.fillStyle(p.sash);
  g.fillRect(-7, -1, 14, 2);
  g.fillStyle(p.band);
  g.fillRect(-8, -8, 16, 3);

  const leftY = -1 - liftL * 8;
  const rightY = -1 - liftR * 8 - staffRaise * 5;
  g.fillStyle(p.skin);
  g.fillRoundedRect(-13, leftY, 5, 12, 2);
  g.fillRoundedRect(8, rightY, 5, 12, 2);

  g.fillStyle(p.hairDark);
  g.fillCircle(0, -16, 11);
  g.fillStyle(p.hair);
  g.fillCircle(0, -16, 9);

  if (!north) {
    g.fillStyle(p.skinDark);
    g.fillEllipse(0, -14.4, 6, 9);
    g.fillStyle(p.skin);
    g.fillEllipse(0, -14.4, 5, 8);
    drawEyes(g, p, 0, -14.2, 0);
    g.fillStyle(p.hair);
    g.fillTriangle(-10, -16, -4, -16, -9, -7);
    g.fillTriangle(10, -16, 4, -16, 9, -7);
  } else {
    g.fillStyle(p.hair);
    g.fillCircle(0, -16, 9);
  }

  drawHat(g, p, 0, -24);
  drawStaff(g, p, 12, rightY + 2, -1.2 - staffRaise * 0.55);
};

const drawEyes = (g: Phaser.GameObjects.Graphics, p: Palette, cx: number, cy: number, dir: number): void => {
  const ox = dir * 2;
  g.fillStyle(p.eyeDark);
  g.fillTriangle(cx - 3.4 + ox, cy - 0.5, cx - 1.2 + ox, cy - 3.2, cx - 0.6 + ox, cy + 1.4);
  g.fillTriangle(cx + 3.4 + ox, cy - 0.5, cx + 1.2 + ox, cy - 3.2, cx + 0.6 + ox, cy + 1.4);
  g.fillStyle(p.eye);
  g.fillTriangle(cx - 3 + ox, cy - 0.4, cx - 1.4 + ox, cy - 2.6, cx - 0.9 + ox, cy + 0.9);
  g.fillTriangle(cx + 3 + ox, cy - 0.4, cx + 1.4 + ox, cy - 2.6, cx + 0.9 + ox, cy + 0.9);
};

const drawHat = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number): void => {
  g.fillStyle(COLORS.ink);
  g.fillEllipse(x, y + 6, 24, 7);
  g.fillStyle(p.hat);
  g.fillEllipse(x, y + 5.5, 22, 6);
  g.fillTriangle(x - 7, y + 4, x + 7, y + 4, x + 1, y - 14);
  g.fillStyle(p.hatBand);
  g.fillRect(x - 6, y + 1, 13, 2);
};

const drawStaff = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number, angle: number): void => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const len = 28;
  g.lineStyle(4, COLORS.ink, 1);
  g.lineBetween(x, y, x + dx * len, y + dy * len);
  g.lineStyle(2.4, p.wood, 1);
  g.lineBetween(x, y, x + dx * len, y + dy * len);
  const sx = x + dx * len;
  const sy = y + dy * len;
  g.fillStyle(COLORS.ink);
  g.fillCircle(sx, sy, 5.2);
  g.fillStyle(p.bone);
  g.fillCircle(sx, sy, 4.2);
  g.fillStyle(p.hat);
  g.fillCircle(sx - 1.4, sy - 0.8, 1.1);
  g.fillCircle(sx + 1.4, sy - 0.8, 1.1);
  g.fillStyle(p.sash);
  g.fillCircle(sx, sy + 1.6, 1.1);
};

export const witchStaffTip = (
  x: number,
  y: number,
  aimX: number,
  _aimY: number,
  staffRaise = 0,
): { x: number; y: number } => {
  const east = aimX >= 0;
  const localX = east ? 11 : -11;
  const localY = -2 - staffRaise * 6;
  const angle = east ? -1.15 - staffRaise * 0.7 : -1.95 + staffRaise * 0.7;
  return {
    x: x + localX + Math.cos(angle) * 28,
    y: y + localY + Math.sin(angle) * 28,
  };
};
