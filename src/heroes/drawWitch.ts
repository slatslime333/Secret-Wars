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
 * Cole-sized witch: large oval face, tapered feminine torso, slim waist,
 * flared skirt. Same chunky pixel language as the rest of the roster.
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
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 18, 6);

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

const drawTorso = (g: Phaser.GameObjects.Graphics, p: Palette): void => {
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-7, 10, 5, 8, 2);
  g.fillRoundedRect(2, 10, 5, 8, 2);
  g.fillStyle(p.skin);
  g.fillRect(-6, 10, 3.5, 6);
  g.fillRect(2.5, 10, 3.5, 6);

  g.fillStyle(p.skirtDark);
  g.fillTriangle(-4, 3, 4, 3, -13, 12);
  g.fillTriangle(-4, 3, 4, 3, 13, 12);
  g.fillRoundedRect(-12, 6, 24, 7, 4);
  g.fillStyle(p.skirt);
  g.fillTriangle(-3, 3, 3, 3, -11, 11);
  g.fillTriangle(-3, 3, 3, 3, 11, 11);
  g.fillRoundedRect(-11, 5, 22, 6, 4);
  g.fillStyle(p.sash);
  g.fillRect(-5, 3, 10, 2);

  g.fillStyle(p.skin);
  g.fillRect(-3, 1, 6, 3);

  g.fillStyle(p.topDark);
  g.fillTriangle(-5, -9, 5, -9, -8, -1);
  g.fillTriangle(-5, -9, 5, -9, 8, -1);
  g.fillStyle(p.top);
  g.fillTriangle(-4, -9, 4, -9, -6.5, 0);
  g.fillTriangle(-4, -9, 4, -9, 6.5, 0);
  g.fillEllipse(0, -4.2, 14, 8);
  g.fillRoundedRect(-5, -3, 10, 5, 3);
  g.fillStyle(p.sash);
  g.fillRect(-5, 0, 10, 2);
  g.fillStyle(p.band);
  g.fillRect(-6, -9, 12, 3);
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
  drawTorso(g, p);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-12, leftY - 1, 4, 11, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-11.5, leftY, 3, 9, 2);

  drawHairAndHead(g, p, 2, 1);
  drawEyes(g, p, 3, -16.2, 1);
  drawHat(g, p, 1, -27);
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
  drawTorso(g, p);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(8, rightY - 1, 4, 11, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(8.5, rightY, 3, 9, 2);

  drawHairAndHead(g, p, -2, -1);
  drawEyes(g, p, -3, -16.2, -1);
  drawHat(g, p, -1, -27);
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
  drawTorso(g, p);
  const leftY = -1 - liftL * 8;
  const rightY = -1 - liftR * 8 - staffRaise * 5;
  g.fillStyle(p.skin);
  g.fillRoundedRect(-12, leftY, 4, 12, 2);
  g.fillRoundedRect(8, rightY, 4, 12, 2);

  g.fillStyle(p.hairDark);
  g.fillEllipse(0, -18, 20, 18);
  g.fillStyle(p.hair);
  g.fillEllipse(0, -18, 17, 16);

  if (!north) {
    g.fillStyle(p.skinDark);
    g.fillEllipse(0, -16.4, 13.2, 17.2);
    g.fillStyle(p.skin);
    g.fillEllipse(0, -16.4, 11.6, 15.6);
    drawEyes(g, p, 0, -16.2, 0);
    g.fillStyle(p.hair);
    g.fillTriangle(-11, -18, -3, -18, -10, -8);
    g.fillTriangle(11, -18, 3, -18, 10, -8);
  } else {
    g.fillStyle(p.hair);
    g.fillEllipse(0, -18, 17, 16);
  }

  drawHat(g, p, 0, -27);
  drawStaff(g, p, 12, rightY + 2, -1.2 - staffRaise * 0.55);
};

const drawHairAndHead = (g: Phaser.GameObjects.Graphics, p: Palette, faceX: number, dir: number): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir, -18, 20, 18);
  g.fillStyle(p.hair);
  g.fillEllipse(dir, -18, 17, 16);
  g.fillRoundedRect(-9 + dir, -20, 18, 9, 4);

  g.fillStyle(p.skinDark);
  g.fillEllipse(faceX, -16.4, 13.4, 17.4);
  g.fillStyle(p.skin);
  g.fillEllipse(faceX, -16.4, 11.8, 15.8);

  g.fillStyle(p.hair);
  g.fillRect(-7 + dir, -24, 15, 7);
  g.fillTriangle(-9 * dir, -18, -2 * dir, -18, -8 * dir, -8);
  g.fillTriangle(9 * dir, -20, 13 * dir, -13, 6 * dir, -11);
};

const drawEyes = (g: Phaser.GameObjects.Graphics, p: Palette, cx: number, cy: number, dir: number): void => {
  const ox = dir * 2.4;
  g.fillStyle(p.eyeDark);
  g.fillTriangle(cx - 4.2 + ox, cy - 0.4, cx - 1.5 + ox, cy - 3.6, cx - 0.7 + ox, cy + 1.8);
  g.fillTriangle(cx + 4.2 + ox, cy - 0.4, cx + 1.5 + ox, cy - 3.6, cx + 0.7 + ox, cy + 1.8);
  g.fillStyle(p.eye);
  g.fillTriangle(cx - 3.7 + ox, cy - 0.3, cx - 1.7 + ox, cy - 3, cx - 1.1 + ox, cy + 1.2);
  g.fillTriangle(cx + 3.7 + ox, cy - 0.3, cx + 1.7 + ox, cy - 3, cx + 1.1 + ox, cy + 1.2);
};

const drawHat = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number): void => {
  g.fillStyle(COLORS.ink);
  g.fillEllipse(x, y + 7, 28, 8);
  g.fillStyle(p.hat);
  g.fillEllipse(x, y + 6.4, 26, 7);
  g.fillTriangle(x - 8, y + 5, x + 8, y + 5, x + 1, y - 16);
  g.fillStyle(p.hatBand);
  g.fillRect(x - 7, y + 2, 15, 2);
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
