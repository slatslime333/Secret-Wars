import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

const paletteFor = (rival: boolean, hitFlash: boolean) => {
  if (hitFlash) {
    return {
      jacket: 0xffe08a,
      shirt: 0xfff6d8,
      jeans: 0x3a3a48,
      skin: 0xffd0a8,
      hair: 0x6a3a18,
      eye: 0x4a1010,
    };
  }
  if (rival) {
    return {
      jacket: 0xb8860b,
      shirt: 0xf4efe0,
      jeans: 0x141418,
      skin: 0xc68654,
      hair: 0x3c2414,
      eye: 0x2a1010,
    };
  }
  return {
    jacket: 0xc9a227,
    shirt: 0xf6f1de,
    jeans: 0x121214,
    skin: 0xd4a06a,
    hair: 0x4a2c18,
    eye: 0x1a1010,
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
  const sway = opts.swayX ?? 0;

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(sway, 16, 22, 8);

  graphics.fillStyle(palette.jeans);
  graphics.fillRoundedRect(-10 + sway, 8, 20, 12, 2);

  graphics.fillStyle(palette.shirt);
  graphics.fillRoundedRect(-9 + sway, -2, 18, 12, 2);

  graphics.fillStyle(palette.jacket);
  graphics.fillRoundedRect(-12 + sway, -6, 24, 16, 3);
  graphics.fillStyle(0x8a7018, 0.55);
  graphics.fillRect(-1 + sway, -4, 2, 14);

  graphics.fillStyle(palette.skin);
  graphics.fillCircle(sway, -14, 11);

  graphics.fillStyle(palette.hair);
  graphics.fillCircle(sway, -18, 10);
  graphics.fillRect(-10 + sway, -20, 20, 7);
  graphics.fillStyle(0x3a2010);
  graphics.fillRect(-9 + sway, -16, 18, 3);

  graphics.fillStyle(palette.eye);
  if (facing === 'south' || facing === 'east') {
    graphics.fillTriangle(-6 + sway, -13, -2 + sway, -12, -6 + sway, -10);
    graphics.fillTriangle(2 + sway, -13, 6 + sway, -12, 6 + sway, -10);
  } else if (facing === 'west') {
    graphics.fillTriangle(-6 + sway, -13, -2 + sway, -12, -6 + sway, -10);
  } else {
    graphics.fillRect(-4 + sway, -13, 8, 2);
  }

  const leftY = 2 - liftL * 10;
  const rightY = 2 - liftR * 10;
  graphics.fillStyle(palette.jacket);
  graphics.fillRect(-15 + sway, leftY, 6, 12);
  graphics.fillRect(9 + sway, rightY, 6, 12);
  graphics.fillStyle(palette.skin);
  graphics.fillCircle(-12 + sway, leftY + 12, 3.5);
  graphics.fillCircle(12 + sway, rightY + 12, 3.5);
};
