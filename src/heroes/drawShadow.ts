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
 * Cole-sized pale schoolgirl: large oval face, tapered blouse, slim waist,
 * flared skirt, huge supernatural right shadow arm.
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
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 16, 5);

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
  g.fillRoundedRect(-6.5, 10, 4.5, 7, 2);
  g.fillRoundedRect(2, 10, 4.5, 7, 2);
  g.fillStyle(p.skin);
  g.fillRect(-5.5, 10, 3, 5);
  g.fillRect(2.5, 10, 3, 5);

  g.fillStyle(p.skirtDark);
  g.fillTriangle(-3.5, 3, 3.5, 3, -11, 12);
  g.fillTriangle(-3.5, 3, 3.5, 3, 11, 12);
  g.fillRoundedRect(-11, 6, 22, 6, 3);
  g.fillStyle(p.skirt);
  g.fillTriangle(-3, 3, 3, 3, -10, 11);
  g.fillTriangle(-3, 3, 3, 3, 10, 11);
  g.fillRoundedRect(-10, 5, 20, 5, 3);
  g.fillStyle(p.trim);
  g.fillRect(-10, 5, 20, 1);

  g.fillStyle(p.skin);
  g.fillRect(-3, 1, 6, 3);

  g.fillStyle(p.blouseDark);
  g.fillTriangle(-4.5, -8, 4.5, -8, -7, 0);
  g.fillTriangle(-4.5, -8, 4.5, -8, 7, 0);
  g.fillStyle(p.blouse);
  g.fillTriangle(-3.5, -8, 3.5, -8, -5.5, 1);
  g.fillTriangle(-3.5, -8, 3.5, -8, 5.5, 1);
  g.fillEllipse(0, -3.6, 13, 7.5);
  g.fillRoundedRect(-4.5, -2, 9, 4, 2);
  g.fillStyle(p.trim);
  g.fillRect(-5, -1, 10, 2);
  g.fillStyle(p.band);
  g.fillRect(-5.5, -8, 11, 2);
};

const drawLongHair = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number, north: boolean): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 0.4, -15.5, 21.5, 24.5);
  g.fillEllipse(-9.1 + dir, 1, 9, 19.8);
  g.fillEllipse(9.1 + dir, 1, 9, 19.8);
  g.fillEllipse(-7.4 + dir * 1.6, 9, 7.4, 13);
  g.fillEllipse(7.4 + dir * 1.6, 9, 7.4, 13);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 0.4, -16, 19, 22);
  g.fillEllipse(-8.2 + dir, 1, 7.5, 18);
  g.fillEllipse(8.2 + dir, 1, 7.5, 18);
  g.fillEllipse(-6.6 + dir * 1.6, 9, 6.2, 11.4);
  g.fillEllipse(6.6 + dir * 1.6, 9, 6.2, 11.4);
  if (north) {
    g.fillEllipse(0, -18, 18, 20);
    g.fillRoundedRect(-10, -5, 20, 15, 7);
  }
};

const drawSwoopBangs = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 1.6, -22.2, 20, 11.5);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 1.8, -22.6, 18.2, 10);
  g.fillTriangle(-10 + dir * 1.6, -24, 11.6 + dir * 2.4, -20.5, -3.4 + dir * 3.2, -10);
  g.fillTriangle(-1.6 + dir * 1.6, -24, 10.8 + dir * 3.2, -18.5, 6.6 + dir * 2.4, -9);
  g.fillEllipse(dir * 5, -17.2, 13, 9.5);
  g.fillEllipse(dir * 2.4, -20.4, 15, 8.2);
};

const drawEast = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 7;
  const rightY = 2 - liftR * 11;
  drawLongHair(g, p, 1, false);
  drawTorso(g, p);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-11, leftY, 3.5, 10, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-10.5, leftY + 0.5, 2.6, 8, 2);

  drawFace(g, p, 2.4);
  drawCuteEye(g, p, 5.2, -13.2, 1);
  drawSwoopBangs(g, p, 1);
  drawShadowArm(g, p, 8, rightY, 1, liftR);
};

const drawWest = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 7;
  const rightY = 2 - liftR * 11;
  drawLongHair(g, p, -1, false);
  drawTorso(g, p);

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(7.5, leftY, 3.5, 10, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect(8, leftY + 0.5, 2.6, 8, 2);

  drawFace(g, p, -2.4);
  drawCuteEye(g, p, -5.2, -13.2, -1);
  drawSwoopBangs(g, p, -1);
  drawShadowArm(g, p, -8, rightY, -1, liftR);
};

const drawFront = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  north: boolean,
  liftL: number,
  liftR: number,
): void => {
  drawLongHair(g, p, 0, north);
  drawTorso(g, p);
  const leftY = 0 - liftL * 7;
  const rightY = 0 - liftR * 10;
  const shadowDir = north ? 1 : -1;
  g.fillStyle(p.skin);
  g.fillRoundedRect(north ? -11 : 8, leftY, 3.5, 10, 2);

  if (!north) {
    drawFace(g, p, 0);
    drawCuteEye(g, p, -3.2, -13.1, 0);
    drawCuteEye(g, p, 3.4, -13.1, 0);
    drawSwoopBangs(g, p, 1);
  } else {
    g.fillStyle(p.hair);
    g.fillEllipse(0, -17.2, 18, 20);
  }
  drawShadowArm(g, p, north ? 8 : -8, rightY, shadowDir, liftR);
};

const drawFace = (g: Phaser.GameObjects.Graphics, p: Palette, faceX: number): void => {
  g.fillStyle(p.skinDark);
  g.fillEllipse(faceX, -13.6, 17.2, 18.8);
  g.fillStyle(p.skin);
  g.fillEllipse(faceX, -13.4, 15.4, 17);
};

const drawCuteEye = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number, dir: number): void => {
  g.fillStyle(0xfff8f2);
  g.fillEllipse(x, y, 4.4, 5);
  g.fillStyle(p.eye);
  g.fillEllipse(x + dir * 0.3, y + 0.3, 2.8, 3.3);
  g.fillStyle(0x08060c);
  g.fillEllipse(x + dir * 0.35, y + 0.4, 1.5, 1.9);
  g.fillStyle(0xffffff);
  g.fillCircle(x - 0.65 + dir * 0.15, y - 0.85, 0.8);
  g.fillCircle(x + 0.5, y + 0.55, 0.35);
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
