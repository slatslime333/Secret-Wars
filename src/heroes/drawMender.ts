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
  suit: number;
  suitDark: number;
  white: number;
  gun: number;
  gunDark: number;
  band: number;
};

const paletteFor = (rival: boolean, hitFlash: boolean): Palette => {
  if (hitFlash) {
    return {
      skin: 0xffe8d0,
      skinDark: 0xe0b090,
      hair: 0xffe080,
      hairDark: 0xd4a020,
      eye: 0x3a78c8,
      eyeDark: 0x102040,
      suit: 0x8ad4ff,
      suitDark: 0x2a6088,
      white: 0xffffff,
      gun: 0xc8c8d0,
      gunDark: 0x5a5a66,
      band: rival ? COLORS.redBright : COLORS.cyan,
    };
  }
  if (rival) {
    return {
      skin: 0xc68654,
      skinDark: 0x8a4a28,
      hair: 0xc8a028,
      hairDark: 0x6a4810,
      eye: 0x244878,
      eyeDark: 0x081018,
      suit: 0x183868,
      suitDark: 0x0c1828,
      white: 0xd0d4dc,
      gun: 0x4a4a52,
      gunDark: 0x242428,
      band: COLORS.redBright,
    };
  }
  return {
    skin: 0xe8b888,
    skinDark: 0xc48654,
    hair: 0xf0d050,
    hairDark: 0xb88818,
    eye: 0x3a6cb0,
    eyeDark: 0x142038,
    suit: 0x2a6cb8,
    suitDark: 0x143868,
    white: 0xf4f6fa,
    gun: 0x7a7a84,
    gunDark: 0x3a3a42,
    band: COLORS.cyan,
  };
};

/**
 * Skinny blonde superhero in a blue/white suit, dual grey uzis.
 * Same chunky comic silhouette as Witch / Cole.
 */
export const drawMender = (
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

  if (opts.fairyForm) {
    drawFairy(graphics, palette, facing);
    return;
  }

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

export const menderArmOrigin = (
  x: number,
  y: number,
  aimAngle: number,
  arm: -1 | 1,
  reach = 14,
): { x: number; y: number } => ({
  x: x + Math.cos(aimAngle + arm * 1.05) * reach,
  y: y + Math.sin(aimAngle + arm * 1.05) * reach - 6,
});

const drawSuitBody = (g: Phaser.GameObjects.Graphics, p: Palette): void => {
  g.fillStyle(p.suitDark);
  g.fillRoundedRect(-6.5, 8, 4.5, 8, 2);
  g.fillRoundedRect(2, 8, 4.5, 8, 2);
  g.fillStyle(p.suit);
  g.fillRoundedRect(-6, 8, 3.5, 7, 2);
  g.fillRoundedRect(2.5, 8, 3.5, 7, 2);

  g.fillStyle(p.suitDark);
  g.fillRoundedRect(-7.5, -1, 15, 11, 4);
  g.fillStyle(p.suit);
  g.fillRoundedRect(-6.5, -2, 13, 10, 4);
  g.fillStyle(p.white);
  g.fillRect(-2.2, -2, 4.4, 10);
  g.fillEllipse(0, -3, 9, 6);
  g.fillStyle(p.band);
  g.fillRect(-5.5, -4, 11, 2);
};

const drawHair = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number, north: boolean): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 0.4, -16, 20, 20);
  g.fillEllipse(-8 + dir, 1, 7.5, 16);
  g.fillEllipse(8 + dir, 1, 7.5, 16);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 0.4, -16.5, 17.5, 18);
  g.fillEllipse(-7 + dir, 1.5, 6.2, 14.5);
  g.fillEllipse(7 + dir, 1.5, 6.2, 14.5);
  if (north) {
    g.fillEllipse(dir, -18, 16, 16);
  }
};

const drawHead = (g: Phaser.GameObjects.Graphics, p: Palette, faceX: number, dir: number): void => {
  g.fillStyle(p.skinDark);
  g.fillEllipse(faceX, -15.2, 16.8, 20.4);
  g.fillStyle(p.skin);
  g.fillEllipse(faceX, -15.2, 15, 18.6);
  g.fillStyle(p.hairDark);
  g.fillEllipse(faceX - dir * 1.4, -21.5, 13.5, 7.2);
  g.fillStyle(p.hair);
  g.fillEllipse(faceX - dir * 1.2, -22, 12, 6.2);
  g.fillTriangle(-7.6 * (dir || 1), -17, -1.5 * (dir || 1), -19, -8.4 * (dir || 1), -8);
};

const drawEye = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number, dir: number): void => {
  g.fillStyle(0xfff6f0);
  g.fillEllipse(x, y, 4.2, 4.8);
  g.fillStyle(p.eye);
  g.fillEllipse(x + dir * 0.3, y + 0.2, 2.8, 3.2);
  g.fillStyle(p.eyeDark);
  g.fillEllipse(x + dir * 0.35, y + 0.3, 1.5, 1.9);
  g.fillStyle(0xffffff);
  g.fillCircle(x - 0.6 + dir * 0.15, y - 0.8, 0.75);
};

const drawEyes = (g: Phaser.GameObjects.Graphics, p: Palette, cx: number, cy: number, dir: number): void => {
  if (dir === 0) {
    drawEye(g, p, cx - 3.1, cy, 0);
    drawEye(g, p, cx + 3.1, cy, 0);
    return;
  }
  drawEye(g, p, cx, cy, dir);
};

const drawUzi = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number, angle: number): void => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  g.lineStyle(4.2, COLORS.ink, 1);
  g.lineBetween(x, y, x + dx * 13, y + dy * 13);
  g.lineStyle(2.6, p.gun, 1);
  g.lineBetween(x, y, x + dx * 13, y + dy * 13);
  g.fillStyle(p.gunDark);
  g.fillCircle(x, y, 2.4);
  g.fillStyle(p.gun);
  g.fillRect(x + dx * 11 - 1.4, y + dy * 11 - 1.2, 5.5, 2.4);
};

const drawEast = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 7;
  const rightY = 1 - liftR * 8;
  drawHair(g, p, 2, false);
  drawSuitBody(g, p);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-11, leftY, 3.5, 10, 2);
  drawHead(g, p, 2, 1);
  drawEyes(g, p, 3.4, -15, 1);
  drawUzi(g, p, 10, rightY, -0.12 - liftR * 0.4);
};

const drawWest = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 8;
  const rightY = 1 - liftR * 7;
  drawHair(g, p, -2, false);
  drawSuitBody(g, p);
  g.fillStyle(p.skin);
  g.fillRoundedRect(7.5, rightY, 3.5, 10, 2);
  drawHead(g, p, -2, -1);
  drawEyes(g, p, -3.4, -15, -1);
  drawUzi(g, p, -10, leftY, Math.PI + 0.12 + liftL * 0.4);
};

const drawFront = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  north: boolean,
  liftL: number,
  liftR: number,
): void => {
  drawHair(g, p, 0, north);
  drawSuitBody(g, p);
  const leftY = -1 - liftL * 8;
  const rightY = -1 - liftR * 8;
  g.fillStyle(p.skin);
  g.fillRoundedRect(-11.5, leftY, 3.6, 11, 2);
  g.fillRoundedRect(7.9, rightY, 3.6, 11, 2);
  if (!north) {
    g.fillStyle(p.skinDark);
    g.fillEllipse(0, -15.2, 16.6, 20.2);
    g.fillStyle(p.skin);
    g.fillEllipse(0, -15.2, 14.8, 18.4);
    drawEyes(g, p, 0, -15.2, 0);
    g.fillStyle(p.hair);
    g.fillEllipse(-6.4, -20.2, 6.4, 7.6);
    g.fillEllipse(6.4, -20.2, 6.4, 7.6);
    g.fillEllipse(0, -23.5, 12, 6);
  } else {
    g.fillStyle(p.hair);
    g.fillEllipse(0, -17, 16, 16);
  }
  drawUzi(g, p, -12, leftY + 4, -0.35 - liftL * 0.35);
  drawUzi(g, p, 12, rightY + 4, 0.35 + liftR * 0.35);
};

const drawFairy = (g: Phaser.GameObjects.Graphics, p: Palette, facing: CardinalFacing): void => {
  const dir = facing === 'west' ? -1 : 1;
  g.fillStyle(0xa8e8ff, 0.45);
  g.fillEllipse(-8, -6, 10, 14);
  g.fillEllipse(8, -6, 10, 14);
  g.fillStyle(0xdff8ff, 0.7);
  g.fillEllipse(-7.5, -6, 7, 10);
  g.fillEllipse(7.5, -6, 7, 10);
  g.fillStyle(p.suit);
  g.fillEllipse(0, 2, 8, 10);
  g.fillStyle(p.white);
  g.fillRect(-1.4, -2, 2.8, 7);
  g.fillStyle(p.hair);
  g.fillEllipse(dir, -8, 11, 10);
  g.fillStyle(p.skin);
  g.fillEllipse(dir * 0.6, -8, 7.4, 8.2);
  if (facing !== 'north') {
    g.fillStyle(p.eye);
    g.fillCircle(dir * 1.6, -8.2, 1.1);
    g.fillStyle(0xffffff);
    g.fillCircle(dir * 1.3, -8.6, 0.4);
  }
  g.fillStyle(p.band);
  g.fillRect(-3, -2, 6, 1.4);
};
