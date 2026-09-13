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
      eye: 0x2a1028,
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
      eye: 0x3a1020,
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
    eye: 0x1a1018,
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
 * Cole-sized pale schoolgirl with a huge supernatural right shadow arm.
 * Slightly smaller than Witch; bangs cover about half the face.
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
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 18, 6);

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

const drawEast = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 7;
  const rightY = 2 - liftR * 11;

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-8, 9, 5, 7, 2);
  g.fillRoundedRect(2, 9, 5, 7, 2);
  g.fillStyle(p.skin);
  g.fillRect(-7, 9, 4, 5);
  g.fillRect(3, 9, 4, 5);

  g.fillStyle(p.skirtDark);
  g.fillRoundedRect(-10, 5, 20, 7, 3);
  g.fillStyle(p.skirt);
  g.fillRoundedRect(-9, 4, 18, 6, 3);
  g.fillStyle(p.trim);
  g.fillRect(-9, 4, 18, 1);

  g.fillStyle(p.skin);
  g.fillRect(-4, 1, 8, 4);

  g.fillStyle(p.blouseDark);
  g.fillRoundedRect(-8, -7, 16, 10, 3);
  g.fillStyle(p.blouse);
  g.fillRoundedRect(-7, -6, 14, 8, 3);
  g.fillStyle(p.trim);
  g.fillRect(-7, -2, 14, 2);
  g.fillStyle(p.band);
  g.fillRect(-7, -7, 14, 2);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-12, leftY - 1, 4, 10, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-11, leftY, 3, 8, 2);

  g.fillStyle(p.hairDark);
  g.fillEllipse(1, -15.5, 10, 11);
  g.fillStyle(p.hair);
  g.fillEllipse(1, -15.5, 8.5, 9.5);

  g.fillStyle(p.skinDark);
  g.fillEllipse(2, -13.6, 5.4, 8);
  g.fillStyle(p.skin);
  g.fillEllipse(2, -13.6, 4.5, 7);

  g.fillStyle(p.hair);
  g.fillTriangle(-6, -16, 4, -18, -7, -7);
  g.fillTriangle(-2, -17, 8, -16, 2, -8);
  g.fillRect(-5, -21, 12, 5);

  drawEye(g, p, 4, -13.2);
  drawShadowArm(g, p, 8, rightY, 1, liftR);
};

const drawWest = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 7;
  const rightY = 2 - liftR * 11;

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-7, 9, 5, 7, 2);
  g.fillRoundedRect(3, 9, 5, 7, 2);
  g.fillStyle(p.skin);
  g.fillRect(-6, 9, 4, 5);
  g.fillRect(4, 9, 4, 5);

  g.fillStyle(p.skirtDark);
  g.fillRoundedRect(-10, 5, 20, 7, 3);
  g.fillStyle(p.skirt);
  g.fillRoundedRect(-9, 4, 18, 6, 3);
  g.fillStyle(p.trim);
  g.fillRect(-9, 4, 18, 1);

  g.fillStyle(p.skin);
  g.fillRect(-4, 1, 8, 4);

  g.fillStyle(p.blouseDark);
  g.fillRoundedRect(-8, -7, 16, 10, 3);
  g.fillStyle(p.blouse);
  g.fillRoundedRect(-7, -6, 14, 8, 3);
  g.fillStyle(p.trim);
  g.fillRect(-7, -2, 14, 2);
  g.fillStyle(p.band);
  g.fillRect(-7, -7, 14, 2);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(8, leftY - 1, 4, 10, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(8, leftY, 3, 8, 2);

  g.fillStyle(p.hairDark);
  g.fillEllipse(-1, -15.5, 10, 11);
  g.fillStyle(p.hair);
  g.fillEllipse(-1, -15.5, 8.5, 9.5);

  g.fillStyle(p.skinDark);
  g.fillEllipse(-2, -13.6, 5.4, 8);
  g.fillStyle(p.skin);
  g.fillEllipse(-2, -13.6, 4.5, 7);

  g.fillStyle(p.hair);
  g.fillTriangle(6, -16, -4, -18, 7, -7);
  g.fillTriangle(2, -17, -8, -16, -2, -8);
  g.fillRect(-7, -21, 12, 5);

  drawEye(g, p, -4, -13.2);
  drawShadowArm(g, p, -8, rightY, -1, liftR);
};

const drawFront = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  north: boolean,
  liftL: number,
  liftR: number,
): void => {
  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-7, 9, 5, 7, 2);
  g.fillRoundedRect(2, 9, 5, 7, 2);
  g.fillStyle(p.skin);
  g.fillRect(-6, 9, 4, 5);
  g.fillRect(3, 9, 4, 5);

  g.fillStyle(p.skirtDark);
  g.fillRoundedRect(-10, 5, 20, 7, 3);
  g.fillStyle(p.skirt);
  g.fillRoundedRect(-9, 4, 18, 6, 3);

  g.fillStyle(p.skin);
  g.fillRect(-4, 1, 8, 4);

  g.fillStyle(p.blouseDark);
  g.fillRoundedRect(-8, -7, 16, 10, 3);
  g.fillStyle(p.blouse);
  g.fillRoundedRect(-7, -6, 14, 8, 3);
  g.fillStyle(p.trim);
  g.fillRect(-7, -2, 14, 2);
  g.fillStyle(p.band);
  g.fillRect(-7, -7, 14, 2);

  const leftY = 0 - liftL * 7;
  const rightY = 0 - liftR * 10;
  const shadowDir = north ? 1 : -1;
  g.fillStyle(p.skin);
  g.fillRoundedRect(north ? -12 : 8, leftY, 4, 10, 2);

  g.fillStyle(p.hairDark);
  g.fillEllipse(0, -15.5, 10, 11);
  g.fillStyle(p.hair);
  g.fillEllipse(0, -15.5, 8.5, 9.5);

  if (!north) {
    g.fillStyle(p.skinDark);
    g.fillEllipse(0, -13.6, 5.2, 7.8);
    g.fillStyle(p.skin);
    g.fillEllipse(0, -13.6, 4.3, 6.8);
    drawEye(g, p, -2.2, -13.2);
    drawEye(g, p, 2.4, -13.2);
    g.fillStyle(p.hair);
    g.fillTriangle(-8, -16, -1, -17, -8, -6);
    g.fillTriangle(-4, -17, 6, -16, 0, -7);
  } else {
    g.fillStyle(p.hair);
    g.fillEllipse(0, -15.5, 8.5, 9.5);
  }
  drawShadowArm(g, p, north ? 8 : -8, rightY, shadowDir, liftR);
};

const drawEye = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number): void => {
  g.fillStyle(p.eye);
  g.fillEllipse(x, y, 1.5, 2.1);
  g.fillStyle(0xf8f0ea);
  g.fillCircle(x + 0.3, y - 0.4, 0.45);
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
