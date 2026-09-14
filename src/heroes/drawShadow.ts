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
  blouse: number;
  blouseDark: number;
  skirt: number;
  skirtDark: number;
  trim: number;
  shadow: number;
  shadowLite: number;
  claw: number;
  band: number;
};

const paletteFor = (rival: boolean, hitFlash: boolean): Palette => {
  if (hitFlash) {
    return {
      skin: 0xfff6f0,
      skinDark: 0xe0c8c0,
      hair: 0x3a3a44,
      hairDark: 0x1a1a22,
      eye: COLORS.ink,
      blouse: 0xffffff,
      blouseDark: 0xd0d0d8,
      skirt: 0x2a2a32,
      skirtDark: 0x101018,
      trim: 0x1a1a22,
      shadow: 0x3a2458,
      shadowLite: 0x6a48a0,
      claw: 0xc8b8e8,
      band: rival ? COLORS.redBright : COLORS.cyan,
    };
  }
  if (rival) {
    return {
      skin: 0xe8d0cc,
      skinDark: 0xb89088,
      hair: 0x0c0c10,
      hairDark: 0x040406,
      eye: 0x140810,
      blouse: 0xe8e4dc,
      blouseDark: 0xb0a8a0,
      skirt: 0x141018,
      skirtDark: 0x08060a,
      trim: 0x1a1018,
      shadow: 0x1a0820,
      shadowLite: 0x4a2060,
      claw: 0x8a68a8,
      band: COLORS.redBright,
    };
  }
  return {
    skin: 0xf4e4dc,
    skinDark: 0xd0b0a4,
    hair: 0x121218,
    hairDark: 0x060608,
    eye: COLORS.ink,
    blouse: 0xf4f0e8,
    blouseDark: 0xc8c4bc,
    skirt: 0x16161c,
    skirtDark: 0x0a0a10,
    trim: 0x1c1c24,
    shadow: 0x1a1028,
    shadowLite: 0x4a3470,
    claw: 0xb8a0e0,
    band: COLORS.cyan,
  };
};

/**
 * Pale schoolgirl in the same chunky comic language as Cole.
 * Medium-long hair, swooped bangs, slender feminine silhouette, shadow arm.
 */
export const drawShadow = (
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
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 14, 5);

  if (facing === 'east') {
    drawEast(graphics, palette, liftL, liftR);
    return;
  }
  if (facing === 'west') {
    drawWest(graphics, palette, liftL, liftR);
    return;
  }
  drawFront(graphics, palette, facing === 'north', liftL, liftR);
};

const drawTorso = (g: Phaser.GameObjects.Graphics, p: Palette): void => {
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-5.2, 10, 4, 6, 2);
  g.fillRoundedRect(1.2, 10, 4, 6, 2);
  g.fillStyle(p.skin);
  g.fillRect(-4.6, 10, 2.8, 4.5);
  g.fillRect(1.8, 10, 2.8, 4.5);

  g.fillStyle(p.skirtDark);
  g.fillTriangle(-3, 3, 3, 3, -9.5, 11);
  g.fillTriangle(-3, 3, 3, 3, 9.5, 11);
  g.fillRoundedRect(-9.5, 6, 19, 5, 3);
  g.fillStyle(p.skirt);
  g.fillTriangle(-2.4, 3, 2.4, 3, -8.4, 10);
  g.fillTriangle(-2.4, 3, 2.4, 3, 8.4, 10);
  g.fillRoundedRect(-8.6, 5, 17.2, 4.5, 3);
  g.fillStyle(p.trim);
  g.fillRect(-8.6, 5, 17.2, 1);

  g.fillStyle(p.skin);
  g.fillRect(-2.6, 1, 5.2, 3);

  g.fillStyle(p.blouseDark);
  g.fillTriangle(-3.8, -8, 3.8, -8, -5.8, 1);
  g.fillTriangle(-3.8, -8, 3.8, -8, 5.8, 1);
  g.fillStyle(p.blouse);
  g.fillTriangle(-3, -8, 3, -8, -4.6, 1.4);
  g.fillTriangle(-3, -8, 3, -8, 4.6, 1.4);
  g.fillEllipse(0, -3.4, 11.5, 6.6);
  g.fillRoundedRect(-3.8, -2, 7.6, 4, 2);
  g.fillStyle(p.trim);
  g.fillRect(-4.4, -1, 8.8, 2);
  g.fillStyle(p.band);
  g.fillRect(-4.8, -8, 9.6, 2);
};

/** Shoulder-to-upper-chest length. No mullet tails. */
const drawHair = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number, north: boolean): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 0.4, -15.2, 17.8, 20);
  g.fillEllipse(-7.2 + dir * 0.8, -2, 6.4, 11);
  g.fillEllipse(7.2 + dir * 0.8, -2, 6.4, 11);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 0.4, -15.8, 15.8, 18);
  g.fillEllipse(-6.4 + dir * 0.8, -1.4, 5.4, 9.6);
  g.fillEllipse(6.4 + dir * 0.8, -1.4, 5.4, 9.6);
  if (north) {
    g.fillEllipse(0, -17.4, 16, 18);
  }
};

const drawSwoopBangs = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 2.4, -21.4, 16.5, 9);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 2.6, -21.8, 15, 7.8);
  g.fillTriangle(-7.4, -22, 10.5 + dir * 2, -19, 4.2 + dir * 3, -9);
  g.fillEllipse(dir * 5.2, -16.6, 10.5, 7.4);
};

const drawFace = (g: Phaser.GameObjects.Graphics, p: Palette, faceX: number): void => {
  g.fillStyle(p.skinDark);
  g.fillEllipse(faceX, -13.8, 13.8, 16.6);
  g.fillStyle(p.skin);
  g.fillEllipse(faceX, -13.6, 12.2, 15);
};

const drawEast = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 7;
  const rightY = 2 - liftR * 11;
  drawHair(g, p, 1, false);
  drawTorso(g, p);
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-10, leftY, 3.2, 9, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-9.5, leftY + 0.4, 2.4, 7, 2);
  drawFace(g, p, 1.8);
  drawOvalEye(g, 4.4, -13.4, p.eye);
  drawSwoopBangs(g, p, 1);
  drawShadowArm(g, p, 7.5, rightY, 1, liftR);
};

const drawWest = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 7;
  const rightY = 2 - liftR * 11;
  drawHair(g, p, -1, false);
  drawTorso(g, p);
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(6.8, leftY, 3.2, 9, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(7.2, leftY + 0.4, 2.4, 7, 2);
  drawFace(g, p, -1.8);
  drawOvalEye(g, -4.4, -13.4, p.eye);
  drawSwoopBangs(g, p, -1);
  drawShadowArm(g, p, -7.5, rightY, -1, liftR);
};

const drawFront = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  north: boolean,
  liftL: number,
  liftR: number,
): void => {
  drawHair(g, p, 0, north);
  drawTorso(g, p);
  const leftY = 0 - liftL * 7;
  const rightY = 0 - liftR * 10;
  g.fillStyle(p.skin);
  g.fillRoundedRect(north ? -10 : 7.2, leftY, 3.2, 9, 2);
  if (!north) {
    drawFace(g, p, 0);
    drawOvalEye(g, -2.7, -13.2, p.eye);
    drawOvalEye(g, 2.7, -13.2, p.eye);
    drawSwoopBangs(g, p, 1);
  } else {
    g.fillStyle(p.hair);
    g.fillEllipse(0, -17, 16, 18);
  }
  drawShadowArm(g, p, north ? 7.5 : -7.5, rightY, north ? 1 : -1, liftR);
};

const drawShadowArm = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  x: number,
  y: number,
  dir: number,
  lift: number,
): void => {
  const reach = 16 + lift * 8;
  const hx = x + dir * (5 + lift * 4);
  const hy = y - 3 - lift * 5;
  g.fillStyle(p.shadow, 0.22);
  g.fillEllipse(hx + dir * 3, hy + 3, 22, 26);
  g.fillStyle(p.shadow, 0.42);
  g.fillEllipse(hx + dir * 2, hy + 1, 18, 22);
  g.fillStyle(p.shadow, 0.78);
  g.fillEllipse(hx, hy, 12, 17);
  g.fillStyle(p.shadowLite, 0.5);
  g.fillEllipse(hx - dir, hy - 4, 7, 9);
  g.fillStyle(p.claw, 0.28);
  g.fillEllipse(hx + dir * 2, hy - 2, 6, 8);
  const clawY = hy + reach * 0.28;
  const clawX = hx + dir * (reach * 0.42);
  for (let i = -1; i <= 1; i += 1) {
    const ox = clawX + dir * 3;
    const oy = clawY + i * 5.5;
    g.fillStyle(p.shadow, 0.82);
    g.fillTriangle(hx, hy + 5, ox + dir * 14, oy - 3, ox + dir * 5, oy + 4);
    g.fillStyle(p.claw, 0.78);
    g.fillTriangle(hx + dir, hy + 4, ox + dir * 13, oy - 2, ox + dir * 4, oy + 3);
  }
};
