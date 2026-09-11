import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

export type CardinalFacing = 'north' | 'south' | 'east' | 'west';

export const facingFromAim = (aimX: number, aimY: number): CardinalFacing => {
  if (Math.abs(aimX) >= Math.abs(aimY)) {
    return aimX >= 0 ? 'east' : 'west';
  }
  return aimY >= 0 ? 'south' : 'north';
};

/** Pixel-comic Ninja. Original silhouette — not a licensed sprite. */
export const drawNinja = (
  graphics: Phaser.GameObjects.Graphics,
  facing: CardinalFacing,
): void => {
  graphics.clear();

  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(0, 16, 22, 8);

  graphics.fillStyle(0x121826);
  graphics.fillRoundedRect(-11, -6, 22, 20, 3);

  graphics.fillStyle(COLORS.cyanDark);
  graphics.fillRect(-12, 2, 24, 5);

  graphics.fillStyle(COLORS.red);
  if (facing === 'east') {
    graphics.fillTriangle(10, -2, 22, 4, 10, 10);
  } else if (facing === 'west') {
    graphics.fillTriangle(-10, -2, -22, 4, -10, 10);
  } else {
    graphics.fillTriangle(-4, 8, 4, 8, 0, 18);
  }

  graphics.fillStyle(0x1b2433);
  graphics.fillCircle(0, -14, 11);
  graphics.fillStyle(COLORS.paper);
  graphics.fillCircle(0, -13, 8);
  graphics.fillStyle(0x0c1118);
  graphics.fillRect(-8, -16, 16, 5);

  graphics.fillStyle(COLORS.cyan);
  graphics.fillRect(-11, -18, 22, 4);

  graphics.fillStyle(COLORS.ink);
  if (facing === 'south' || facing === 'east') {
    graphics.fillRect(-5, -12, 4, 3);
    graphics.fillRect(2, -12, 4, 3);
  } else if (facing === 'west') {
    graphics.fillRect(-6, -12, 4, 3);
  } else {
    graphics.fillRect(-3, -11, 6, 2);
  }

  graphics.fillStyle(0x1b2433);
  graphics.fillRect(-14, 0, 6, 12);
  graphics.fillRect(8, 0, 6, 12);
};
