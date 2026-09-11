import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { type CardinalFacing } from './drawNinja';

/** Red practice fighter. Same silhouette language as Ninja, not a copy of a licensed character. */
export const drawChaser = (
  graphics: Phaser.GameObjects.Graphics,
  facing: CardinalFacing,
  hit: boolean,
): void => {
  graphics.clear();

  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(0, 16, 22, 8);

  graphics.fillStyle(hit ? 0x5a3038 : 0x2a1518);
  graphics.fillRoundedRect(-11, -6, 22, 20, 3);

  graphics.fillStyle(COLORS.red);
  graphics.fillRect(-12, 2, 24, 5);

  graphics.fillStyle(COLORS.orange);
  if (facing === 'east') {
    graphics.fillTriangle(10, -2, 22, 4, 10, 10);
  } else if (facing === 'west') {
    graphics.fillTriangle(-10, -2, -22, 4, -10, 10);
  } else {
    graphics.fillTriangle(-4, 8, 4, 8, 0, 18);
  }

  graphics.fillStyle(hit ? COLORS.paper : 0x3a1c22);
  graphics.fillCircle(0, -14, 11);
  graphics.fillStyle(0x1a0c10);
  graphics.fillCircle(0, -13, 8);
  graphics.fillStyle(COLORS.redBright);
  graphics.fillRect(-8, -16, 16, 5);

  graphics.fillStyle(COLORS.redBright);
  graphics.fillRect(-11, -18, 22, 4);

  graphics.fillStyle(COLORS.paper);
  if (facing === 'south' || facing === 'east') {
    graphics.fillRect(-5, -12, 4, 3);
    graphics.fillRect(2, -12, 4, 3);
  } else if (facing === 'west') {
    graphics.fillRect(-6, -12, 4, 3);
  } else {
    graphics.fillRect(-3, -11, 6, 2);
  }

  graphics.fillStyle(0x3a1c22);
  graphics.fillRect(-14, 0, 6, 12);
  graphics.fillRect(8, 0, 6, 12);
};
