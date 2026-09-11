import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

export type CardinalFacing = 'north' | 'south' | 'east' | 'west';

export const facingFromAim = (aimX: number, aimY: number): CardinalFacing => {
  if (Math.abs(aimX) >= Math.abs(aimY)) {
    return aimX >= 0 ? 'east' : 'west';
  }
  return aimY >= 0 ? 'south' : 'north';
};

/** Pixel-comic Ninja. Original silhouette — equipped with a steel katana in hand. */
export const drawNinja = (
  graphics: Phaser.GameObjects.Graphics,
  facing: CardinalFacing,
  attacking: boolean = false,
  swordAngleOffset: number = 0,
): void => {
  graphics.clear();

  // Ground drop shadow
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(0, 16, 22, 8);

  // Torso / tunic
  graphics.fillStyle(0x121826);
  graphics.fillRoundedRect(-11, -6, 22, 20, 3);

  // Cyan sash belt
  graphics.fillStyle(COLORS.cyanDark);
  graphics.fillRect(-12, 2, 24, 5);

  // Red comic sash tie flapping in facing direction
  graphics.fillStyle(COLORS.red);
  if (facing === 'east') {
    graphics.fillTriangle(10, -2, 22, 4, 10, 10);
  } else if (facing === 'west') {
    graphics.fillTriangle(-10, -2, -22, 4, -10, 10);
  } else {
    graphics.fillTriangle(-4, 8, 4, 8, 0, 18);
  }

  // Head mask
  graphics.fillStyle(0x1b2433);
  graphics.fillCircle(0, -14, 11);
  graphics.fillStyle(COLORS.paper);
  graphics.fillCircle(0, -13, 8);
  graphics.fillStyle(0x0c1118);
  graphics.fillRect(-8, -16, 16, 5);

  // Headband
  graphics.fillStyle(COLORS.cyan);
  graphics.fillRect(-11, -18, 22, 4);

  // Mask eyes
  graphics.fillStyle(COLORS.ink);
  if (facing === 'south' || facing === 'east') {
    graphics.fillRect(-5, -12, 4, 3);
    graphics.fillRect(2, -12, 4, 3);
  } else if (facing === 'west') {
    graphics.fillRect(-6, -12, 4, 3);
  } else {
    graphics.fillRect(-3, -11, 6, 2);
  }

  // Arms / hands
  graphics.fillStyle(0x1b2433);
  graphics.fillRect(-14, 0, 6, 12);
  graphics.fillRect(8, 0, 6, 12);

  // Sword in hand: blade, guard, hilt
  drawNinjaSword(graphics, facing, attacking, swordAngleOffset);
};

/**
 * Draws Ninja's katana held in hand.
 * When attacking, the sword pivots dynamically to trace the slash arc.
 */
const drawNinjaSword = (
  graphics: Phaser.GameObjects.Graphics,
  facing: CardinalFacing,
  attacking: boolean,
  swordAngleOffset: number,
): void => {
  // Hand origin coordinates depending on facing
  let handX = 12;
  let handY = 6;
  let baseAngle = Math.PI * 0.15; // default rest angle tilted forward-down

  if (facing === 'east') {
    handX = 11;
    handY = 5;
    baseAngle = -Math.PI * 0.25;
  } else if (facing === 'west') {
    handX = -11;
    handY = 5;
    baseAngle = -Math.PI * 0.75;
  } else if (facing === 'north') {
    handX = 10;
    handY = -4;
    baseAngle = -Math.PI * 0.6;
  } else {
    // south
    handX = 11;
    handY = 7;
    baseAngle = Math.PI * 0.35;
  }

  const finalAngle = baseAngle + swordAngleOffset;
  const bladeLength = attacking ? 28 : 22;
  const bladeWidth = 3;

  const cos = Math.cos(finalAngle);
  const sin = Math.sin(finalAngle);
  const perpX = -sin;
  const perpY = cos;

  // Hand fist wrap (front glove holding hilt)
  graphics.fillStyle(COLORS.cyan, 1);
  graphics.fillCircle(handX, handY, 3.5);
  graphics.fillStyle(COLORS.ink, 1);
  graphics.strokeCircle(handX, handY, 3.5);

  // Hilt pommel & handle behind hand
  const hiltEndX = handX - cos * 6;
  const hiltEndY = handY - sin * 6;
  graphics.lineStyle(3, 0x181008, 1);
  graphics.lineBetween(handX, handY, hiltEndX, hiltEndY);
  // Gold/brass pommel
  graphics.fillStyle(COLORS.yellow, 1);
  graphics.fillCircle(hiltEndX, hiltEndY, 2);

  // Tsuba (sword guard)
  graphics.lineStyle(3, COLORS.yellow, 1);
  graphics.lineBetween(
    handX + cos * 2 + perpX * 4,
    handY + sin * 2 + perpY * 4,
    handX + cos * 2 - perpX * 4,
    handY + sin * 2 - perpY * 4,
  );

  // Katana steel blade
  const bladeStartX = handX + cos * 3;
  const bladeStartY = handY + sin * 3;
  const bladeTipX = handX + cos * (3 + bladeLength);
  const bladeTipY = handY + sin * (3 + bladeLength);

  // Shadow / back edge
  graphics.lineStyle(bladeWidth + 1, COLORS.ink, 1);
  graphics.lineBetween(bladeStartX, bladeStartY, bladeTipX, bladeTipY);

  // Steel body
  graphics.lineStyle(bladeWidth, COLORS.paper, 1);
  graphics.lineBetween(bladeStartX, bladeStartY, bladeTipX, bladeTipY);

  // Polished cyan-white razor edge glint
  graphics.lineStyle(1, attacking ? 0xffffff : COLORS.cyan, 1);
  graphics.lineBetween(
    bladeStartX + perpX * 1,
    bladeStartY + perpY * 1,
    bladeTipX,
    bladeTipY,
  );
};
