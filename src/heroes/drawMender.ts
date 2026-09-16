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
      eye: COLORS.ink,
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
      eye: 0x140c10,
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
    eye: COLORS.ink,
    suit: 0x2a6cb8,
    suitDark: 0x143868,
    white: 0xf4f6fa,
    gun: 0x7a7a84,
    gunDark: 0x3a3a42,
    band: COLORS.cyan,
  };
};

/**
 * Slender blonde support in a blue/white suit, dual grey uzis.
 * Same chunky comic language as Cole, with a narrower feminine silhouette.
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
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 14, 5);

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
  reach = 16,
): { x: number; y: number } => {
  const nx = Math.cos(aimAngle);
  const ny = Math.sin(aimAngle);
  return {
    x: x + nx * (reach + 2) - ny * arm * 5,
    y: y + ny * 7 - 24,
  };
};

const drawSuitBody = (g: Phaser.GameObjects.Graphics, p: Palette): void => {
  g.fillStyle(p.suitDark);
  g.fillRoundedRect(-4.8, 9, 3.8, 7, 2);
  g.fillRoundedRect(1, 9, 3.8, 7, 2);
  g.fillStyle(p.suit);
  g.fillRoundedRect(-4.4, 9, 3, 6, 2);
  g.fillRoundedRect(1.4, 9, 3, 6, 2);

  g.fillStyle(p.suitDark);
  g.fillEllipse(0, 7.4, 12.2, 6);
  g.fillStyle(p.suit);
  g.fillEllipse(0, 6.8, 10.6, 5);

  g.fillStyle(p.suitDark);
  g.fillTriangle(-3.8, -8, 3.8, -8, -5.2, 2);
  g.fillTriangle(-3.8, -8, 3.8, -8, 5.2, 2);
  g.fillStyle(p.suit);
  g.fillTriangle(-3, -8, 3, -8, -4.2, 2);
  g.fillTriangle(-3, -8, 3, -8, 4.2, 2);
  g.fillRoundedRect(-3.4, -1, 6.8, 8, 3);
  g.fillStyle(p.white);
  g.fillRect(-1.5, -6, 3, 12);
  g.fillEllipse(0, -4.2, 6.8, 4.8);
  g.fillStyle(p.band);
  g.fillRect(-4, -5, 8, 2);
};

/** Head volume only — hanging locks are drawn in front so they frame the body. */
const drawHair = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number, north: boolean): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(dir * 0.3, -16, 16.8, 19.4);
  g.fillStyle(p.hair);
  g.fillEllipse(dir * 0.3, -16.6, 14.8, 17.4);
  if (north) {
    g.fillEllipse(dir, -18, 14.6, 16);
  }
};

/** Slightly longer than the head mass; frames upper/mid torso. */
const drawFrameHair = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(-8.2 + dir * 0.6, 1.4, 6.2, 15.2);
  g.fillEllipse(8.2 + dir * 0.6, 1.4, 6.2, 15.2);
  g.fillStyle(p.hair);
  g.fillEllipse(-7.4 + dir * 0.6, 0.8, 5.2, 13.8);
  g.fillEllipse(7.4 + dir * 0.6, 0.8, 5.2, 13.8);
};

const drawHead = (g: Phaser.GameObjects.Graphics, p: Palette, faceX: number): void => {
  g.fillStyle(p.skinDark);
  g.fillEllipse(faceX, -14.6, 13.4, 17);
  g.fillStyle(p.skin);
  g.fillEllipse(faceX, -14.6, 11.8, 15.4);
};

const drawBangs = (g: Phaser.GameObjects.Graphics, p: Palette): void => {
  g.fillStyle(p.hairDark);
  g.fillEllipse(-5.4, -19.8, 5.8, 6.8);
  g.fillEllipse(5.4, -19.8, 5.8, 6.8);
  g.fillStyle(p.hair);
  g.fillEllipse(-5, -20.2, 5, 6);
  g.fillEllipse(5, -20.2, 5, 6);
  g.fillEllipse(0, -22.8, 10.6, 5.4);
  g.fillTriangle(-8.2, -17.4, -1.2, -19.2, -8.6, -6.4);
  g.fillTriangle(8.2, -17.4, 1.2, -19.2, 8.6, -6.4);
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
  g.fillRoundedRect(-10, leftY, 3.2, 9, 2);
  g.fillRoundedRect(7.4, rightY, 3, 8, 2);
  drawUzi(g, p, -9, leftY + 1, -0.28 - liftL * 0.3);
  drawHead(g, p, 1.6);
  drawOvalEye(g, 4.2, -14.2, p.eye);
  drawFrameHair(g, p, 2);
  g.fillStyle(p.hair);
  g.fillEllipse(1.2, -21, 12, 6);
  g.fillTriangle(-6, -16, 2, -18, -7, -6);
  drawUzi(g, p, 10, rightY, -0.1 - liftR * 0.4);
};

const drawWest = (g: Phaser.GameObjects.Graphics, p: Palette, liftL: number, liftR: number): void => {
  const leftY = 1 - liftL * 8;
  const rightY = 1 - liftR * 7;
  drawHair(g, p, -2, false);
  drawSuitBody(g, p);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-10.2, leftY, 3, 8, 2);
  g.fillRoundedRect(6.8, rightY, 3.2, 9, 2);
  drawUzi(g, p, 9, rightY + 1, Math.PI + 0.28 + liftR * 0.3);
  drawHead(g, p, -1.6);
  drawOvalEye(g, -4.2, -14.2, p.eye);
  drawFrameHair(g, p, -2);
  g.fillStyle(p.hair);
  g.fillEllipse(-1.2, -21, 12, 6);
  g.fillTriangle(6, -16, -2, -18, 7, -6);
  drawUzi(g, p, -10, leftY, Math.PI + 0.1 + liftL * 0.4);
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
  g.fillRoundedRect(-10.4, leftY, 3.2, 10, 2);
  g.fillRoundedRect(7.2, rightY, 3.2, 10, 2);
  if (!north) {
    drawHead(g, p, 0);
    drawOvalEye(g, -2.6, -14.2, p.eye);
    drawOvalEye(g, 2.6, -14.2, p.eye);
    drawFrameHair(g, p, 0);
    drawBangs(g, p);
  } else {
    g.fillStyle(p.hair);
    g.fillEllipse(0, -17, 14.6, 16);
    drawFrameHair(g, p, 0);
  }
  drawUzi(g, p, -11, leftY + 4, -0.35 - liftL * 0.35);
  drawUzi(g, p, 11, rightY + 4, 0.35 + liftR * 0.35);
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
  g.fillEllipse(0, 2, 7, 10);
  g.fillStyle(p.white);
  g.fillRect(-1.2, -2, 2.4, 7);
  g.fillStyle(p.hair);
  g.fillEllipse(0, -8.4, 11, 10);
  g.fillStyle(p.skin);
  g.fillEllipse(0, -8, 6.6, 7.6);
  if (facing === 'south') {
    drawOvalEye(g, -1.6, -8.1, p.eye, 0.62);
    drawOvalEye(g, 1.6, -8.1, p.eye, 0.62);
  } else if (facing !== 'north') {
    drawOvalEye(g, dir * 1.5, -8.1, p.eye, 0.62);
  }
  g.fillStyle(p.band);
  g.fillRect(-3, -2, 6, 1.4);
};
