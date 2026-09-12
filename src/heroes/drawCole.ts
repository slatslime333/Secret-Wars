import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

const paletteFor = (rival: boolean, hitFlash: boolean) => {
  if (hitFlash) {
    return {
      jacket: 0xffe08a,
      jacketDark: 0xd4a84a,
      shirt: 0xfff6d8,
      jeans: 0x3a3a48,
      skin: 0xffd0a8,
      hair: 0x6a3a18,
      hairDark: 0x4a2410,
      eye: 0x4a1010,
      brow: 0x3a1810,
      band: rival ? COLORS.redBright : COLORS.cyan,
    };
  }
  if (rival) {
    return {
      jacket: 0xa67c00,
      jacketDark: 0x6e5208,
      shirt: 0xf4efe0,
      jeans: 0x101014,
      skin: 0xc68654,
      hair: 0x3c2410,
      hairDark: 0x241408,
      eye: 0x2a1010,
      brow: 0x1a0c08,
      band: COLORS.redBright,
    };
  }
  return {
    jacket: 0xe0b41c,
    jacketDark: 0x8a6c10,
    shirt: 0xfffaf0,
    jeans: 0x0a0a10,
    skin: 0xd4a06a,
    hair: 0x4a2a12,
    hairDark: 0x2a1808,
    eye: 0x1a1010,
    brow: 0x2a160c,
    band: COLORS.cyan,
  };
};

/** Slimmer pixel-comic Cole — open jacket, brown buzz, team headband. */
export const drawCole = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const hitFlash = Boolean(opts.hitFlash);
  const rival = Boolean(opts.rival);
  const palette = paletteFor(rival, hitFlash);
  const liftL = opts.armLiftLeft ?? 0;
  const liftR = opts.armLiftRight ?? 0;

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(0, 16, 18, 7);

  graphics.fillStyle(palette.jeans);
  graphics.fillRoundedRect(-8, 7, 16, 12, 2);
  graphics.fillStyle(0x08080c);
  graphics.fillRect(-8, 17, 7, 3);
  graphics.fillRect(1, 17, 7, 3);

  graphics.fillStyle(palette.shirt);
  graphics.fillRoundedRect(-7, -3, 14, 12, 2);
  graphics.fillStyle(palette.skin);
  graphics.fillTriangle(-3, -3, 3, -3, 0, 2);

  graphics.fillStyle(palette.jacket);
  graphics.fillRoundedRect(-13, -5, 7, 15, 2);
  graphics.fillRoundedRect(6, -5, 7, 15, 2);
  graphics.fillStyle(palette.jacketDark);
  graphics.fillRect(-13, 8, 7, 3);
  graphics.fillRect(6, 8, 7, 3);
  graphics.fillStyle(palette.jacket);
  graphics.fillTriangle(-13, -5, -6, -5, -13, 1);
  graphics.fillTriangle(13, -5, 6, -5, 13, 1);

  graphics.fillStyle(palette.skin);
  graphics.fillCircle(0, -14, 10);

  graphics.fillStyle(palette.hair);
  graphics.fillEllipse(0, -18, 10, 8);
  graphics.fillRect(-10, -21, 20, 6);
  graphics.fillStyle(palette.hairDark);
  graphics.fillRect(-10, -18, 20, 2);
  graphics.fillRect(-10, -21, 3, 7);
  graphics.fillRect(7, -21, 3, 7);
  graphics.fillCircle(-4, -21, 1.4);
  graphics.fillCircle(3, -22, 1.4);
  graphics.fillCircle(0, -23, 1.3);

  graphics.fillStyle(palette.band);
  graphics.fillRect(-10, -16, 20, 3);
  graphics.fillStyle(COLORS.paper, 0.35);
  graphics.fillRect(-10, -16, 20, 1);

  graphics.fillStyle(palette.brow);
  if (facing === 'south' || facing === 'east') {
    graphics.fillTriangle(-6, -14, -1, -13, -5, -12);
    graphics.fillTriangle(6, -14, 1, -13, 5, -12);
    graphics.fillStyle(palette.eye);
    graphics.fillTriangle(-5, -11, -2, -10, -5, -8);
    graphics.fillTriangle(5, -11, 2, -10, 5, -8);
  } else if (facing === 'west') {
    graphics.fillTriangle(-6, -14, -1, -13, -5, -12);
    graphics.fillStyle(palette.eye);
    graphics.fillTriangle(-5, -11, -2, -10, -5, -8);
  } else {
    graphics.fillRect(-4, -14, 8, 2);
    graphics.fillStyle(palette.eye);
    graphics.fillRect(-3, -11, 6, 2);
  }

  const leftY = 1 - liftL * 10;
  const rightY = 1 - liftR * 10;
  graphics.fillStyle(palette.jacket);
  graphics.fillRect(-14, leftY, 5, 11);
  graphics.fillRect(9, rightY, 5, 11);
  graphics.fillStyle(palette.skin);
  graphics.fillCircle(-11, leftY + 11, 3);
  graphics.fillCircle(11, rightY + 11, 3);
};
