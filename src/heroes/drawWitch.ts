import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions, drawOvalEye } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

type Palette = {
  skin: number;
  skinDark: number;
  hair: number;
  hairDark: number;
  eye: number;
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
      eye: 0x3cdb5c,
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
      eye: 0x2ea03c,
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
    hair: 0x5c2482,
    hairDark: 0x341058,
    eye: 0x3cdb5c,
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
 * Cole-sized witch: tapered feminine torso, medium-long hair, pointed hat.
 * Same chunky pixel language as the rest of the roster.
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
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 16, 5);

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
  g.fillRoundedRect(-5.6, 10, 4.4, 7, 2);
  g.fillRoundedRect(1.2, 10, 4.4, 7, 2);
  g.fillStyle(p.skin);
  g.fillRect(-5, 10, 3.2, 5.5);
  g.fillRect(1.8, 10, 3.2, 5.5);

  g.fillStyle(p.skirtDark);
  g.fillTriangle(-3.4, 3, 3.4, 3, -11, 12);
  g.fillTriangle(-3.4, 3, 3.4, 3, 11, 12);
  g.fillRoundedRect(-10.5, 6, 21, 6, 4);
  g.fillStyle(p.skirt);
  g.fillTriangle(-2.6, 3, 2.6, 3, -9.5, 11);
  g.fillTriangle(-2.6, 3, 2.6, 3, 9.5, 11);
  g.fillRoundedRect(-9.6, 5, 19.2, 5.4, 4);
  g.fillStyle(p.sash);
  g.fillRect(-4.4, 3, 8.8, 2);

  g.fillStyle(p.skin);
  g.fillRect(-2.6, 1, 5.2, 3);

  g.fillStyle(p.topDark);
  g.fillTriangle(-4.2, -9, 4.2, -9, -6.6, -1);
  g.fillTriangle(-4.2, -9, 4.2, -9, 6.6, -1);
  g.fillStyle(p.top);
  g.fillTriangle(-3.4, -9, 3.4, -9, -5.4, 0);
  g.fillTriangle(-3.4, -9, 3.4, -9, 5.4, 0);
  g.fillEllipse(0, -4, 12.4, 7);
  g.fillRoundedRect(-4.2, -3, 8.4, 5, 3);
  g.fillStyle(p.sash);
  g.fillRect(-4.4, 0, 8.8, 2);
  g.fillStyle(p.band);
  g.fillRect(-5.2, -9, 10.4, 2.6);
};

/** Head volume only — hanging locks are drawn in front so they frame the body. */
const drawHair = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number, north: boolean): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 0.4, -16, 17.6, 20);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 0.4, -16.5, 15.6, 18);
  if (north) {
    g.fillEllipse(dir, -18, 15.4, 17);
  }
};

/** Long witch hair to upper/mid torso — not floor-length. */
const drawFrameHair = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(-9 + dir * 0.5, 2.6, 7, 15.6);
  g.fillEllipse(9 + dir * 0.5, 2.6, 7, 15.6);
  g.fillStyle(p.hair);
  g.fillEllipse(-8.2 + dir * 0.5, 2, 6, 14.2);
  g.fillEllipse(8.2 + dir * 0.5, 2, 6, 14.2);
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
  drawHair(g, p, 1, false);
  drawTorso(g, p);
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-11, leftY - 1, 3.6, 10, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-10.6, leftY, 2.8, 8, 2);
  drawHead(g, p, 1.6);
  drawOvalEye(g, 4.2, -13.2, p.eye, 1.12);
  drawFrameHair(g, p, 1);
  drawBangs(g, p, 1);
  drawHat(g, p, 1, -29);
  drawStaff(g, p, 10.5, rightY - 2, -1.15 - staffRaise * 0.7);
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
  drawHair(g, p, -1, false);
  drawTorso(g, p);
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(7.4, rightY - 1, 3.6, 10, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(7.8, rightY, 2.8, 8, 2);
  drawHead(g, p, -1.6);
  drawOvalEye(g, -4.2, -13.2, p.eye, 1.12);
  drawFrameHair(g, p, -1);
  drawBangs(g, p, -1);
  drawHat(g, p, -1, -29);
  drawStaff(g, p, -10.5, leftY - 2, -1.95 + staffRaise * 0.7);
};

const drawFront = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  north: boolean,
  liftL: number,
  liftR: number,
  staffRaise: number,
): void => {
  drawHair(g, p, 0, north);
  drawTorso(g, p);
  const leftY = -1 - liftL * 8;
  const rightY = -1 - liftR * 8 - staffRaise * 5;
  g.fillStyle(p.skin);
  g.fillRoundedRect(-10.8, leftY, 3.4, 11, 2);
  g.fillRoundedRect(7.4, rightY, 3.4, 11, 2);

  if (!north) {
    drawHead(g, p, 0);
    drawOvalEye(g, -2.6, -13.2, p.eye, 1.12);
    drawOvalEye(g, 2.6, -13.2, p.eye, 1.12);
    drawFrameHair(g, p, 0);
    drawBangs(g, p, 0);
  } else {
    g.fillStyle(p.hair);
    g.fillEllipse(0, -17.4, 15.4, 17);
    drawFrameHair(g, p, 0);
  }

  drawHat(g, p, 0, -29);
  drawStaff(g, p, 11.2, rightY + 2, -1.2 - staffRaise * 0.55);
};

const drawHead = (g: Phaser.GameObjects.Graphics, p: Palette, faceX: number): void => {
  g.fillStyle(p.skinDark);
  g.fillEllipse(faceX, -14.4, 13.6, 17.2);
  g.fillStyle(p.skin);
  g.fillEllipse(faceX, -14.4, 12, 15.6);
};

const drawBangs = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 0.6, -21.2, 14.4, 7.4);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 0.6, -21.6, 13, 6.4);
  g.fillTriangle(-8.2, -18, -1.6, -20, -8.6, -8);
  g.fillTriangle(8.2, -18, 1.6, -20, 8.6, -8);
  g.fillEllipse(0, -23.4, 12, 5.6);
};

const drawHat = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number): void => {
  g.fillStyle(COLORS.ink);
  g.fillEllipse(x, y + 8, 24, 7);
  g.fillStyle(p.hat);
  g.fillEllipse(x, y + 7.4, 22, 6.2);
  g.fillTriangle(x - 7, y + 6, x + 7, y + 6, x + 0.8, y - 15);
  g.fillStyle(p.hatBand);
  g.fillRect(x - 6.6, y + 2.2, 13.6, 2);
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
