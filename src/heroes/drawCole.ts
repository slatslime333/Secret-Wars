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
    };
  }
  if (rival) {
    return {
      jacket: 0xa67c00,
      jacketDark: 0x6e5208,
      shirt: 0xf4efe0,
      jeans: 0x101014,
      skin: 0xc68654,
      hair: 0x3c2414,
      hairDark: 0x24140c,
      eye: 0x2a1010,
      brow: 0x1a0c08,
    };
  }
  return {
    jacket: 0xe0b41c,
    jacketDark: 0x8a6c10,
    shirt: 0xfffaf0,
    jeans: 0x0a0a10,
    skin: 0xd4a06a,
    hair: 0x3a2210,
    hairDark: 0x1c1008,
    eye: 0x1a1010,
    brow: 0x2a160c,
  };
};

/** Same pixel-comic proportions as Ninja — tan, buzz cut, dark yellow jacket. */
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
  graphics.fillEllipse(0, 16, 22, 8);

  graphics.fillStyle(palette.jeans);
  graphics.fillRoundedRect(-10, 7, 20, 13, 2);
  graphics.fillStyle(0x08080c);
  graphics.fillRect(-10, 18, 8, 3);
  graphics.fillRect(2, 18, 8, 3);

  graphics.fillStyle(palette.shirt);
  graphics.fillRoundedRect(-8, -1, 16, 10, 2);

  graphics.fillStyle(palette.jacket);
  graphics.fillRoundedRect(-12, -6, 24, 16, 3);
  graphics.fillStyle(palette.jacketDark);
  graphics.fillRect(-12, 8, 24, 3);
  graphics.fillRect(-1, -5, 2, 14);
  graphics.fillTriangle(-12, -6, -4, -6, -12, 1);
  graphics.fillTriangle(12, -6, 4, -6, 12, 1);
  graphics.fillStyle(palette.shirt);
  graphics.fillTriangle(-3, -4, 3, -4, 0, 2);

  graphics.fillStyle(palette.skin);
  graphics.fillCircle(0, -14, 11);

  graphics.fillStyle(palette.hair);
  graphics.fillEllipse(0, -18, 12, 8);
  graphics.fillRect(-11, -20, 22, 6);
  graphics.fillStyle(palette.hairDark);
  graphics.fillRect(-11, -16, 22, 3);
  graphics.fillRect(-11, -20, 3, 8);
  graphics.fillRect(8, -20, 3, 8);

  graphics.fillStyle(palette.brow);
  if (facing === 'south' || facing === 'east') {
    graphics.fillTriangle(-7, -16, -1, -15, -6, -14);
    graphics.fillTriangle(7, -16, 1, -15, 6, -14);
    graphics.fillStyle(palette.eye);
    graphics.fillTriangle(-6, -13, -2, -12, -6, -10);
    graphics.fillTriangle(6, -13, 2, -12, 6, -10);
  } else if (facing === 'west') {
    graphics.fillTriangle(-7, -16, -1, -15, -6, -14);
    graphics.fillStyle(palette.eye);
    graphics.fillTriangle(-6, -13, -2, -12, -6, -10);
  } else {
    graphics.fillRect(-5, -16, 10, 2);
    graphics.fillStyle(palette.eye);
    graphics.fillRect(-4, -13, 8, 2);
  }

  const leftY = 2 - liftL * 10;
  const rightY = 2 - liftR * 10;
  graphics.fillStyle(palette.jacket);
  graphics.fillRect(-15, leftY, 6, 12);
  graphics.fillRect(9, rightY, 6, 12);
  graphics.fillStyle(palette.skin);
  graphics.fillCircle(-12, leftY + 12, 3.5);
  graphics.fillCircle(12, rightY + 12, 3.5);
};
