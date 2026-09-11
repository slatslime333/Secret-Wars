import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { ComboStep } from '../config/combat';

export type CardinalFacing = 'north' | 'south' | 'east' | 'west';

export type NinjaDrawOptions = {
  facing: CardinalFacing;
  attacking?: boolean;
  swordAngleOffset?: number;
  comboStep?: ComboStep;
  hitFlash?: boolean;
  rival?: boolean;
};

export const facingFromAim = (aimX: number, aimY: number): CardinalFacing => {
  if (Math.abs(aimX) >= Math.abs(aimY)) {
    return aimX >= 0 ? 'east' : 'west';
  }
  return aimY >= 0 ? 'south' : 'north';
};

const paletteFor = (rival: boolean, hitFlash: boolean) => {
  if (hitFlash) {
    return {
      tunic: 0x7a1820,
      sash: COLORS.redBright,
      sashTie: 0xffd0d4,
      head: 0x8a2430,
      mask: 0xffecec,
      band: COLORS.redBright,
      arms: 0x6a1420,
      glove: COLORS.paper,
    };
  }
  if (rival) {
    return {
      tunic: 0x1a1218,
      sash: COLORS.red,
      sashTie: COLORS.orange,
      head: 0x24141a,
      mask: 0xf6f1de,
      band: COLORS.redBright,
      arms: 0x24141a,
      glove: COLORS.orange,
    };
  }
  return {
    tunic: 0x121826,
    sash: COLORS.cyanDark,
    sashTie: COLORS.red,
    head: 0x1b2433,
    mask: COLORS.paper,
    band: COLORS.cyan,
    arms: 0x1b2433,
    glove: COLORS.cyan,
  };
};

/** Pixel-comic Ninja. Original silhouette — equipped with a steel katana in hand. */
export const drawNinja = (
  graphics: Phaser.GameObjects.Graphics,
  facingOrOptions: CardinalFacing | NinjaDrawOptions,
  attackingLegacy: boolean = false,
  swordAngleOffsetLegacy: number = 0,
): void => {
  const options: NinjaDrawOptions =
    typeof facingOrOptions === 'string'
      ? {
          facing: facingOrOptions,
          attacking: attackingLegacy,
          swordAngleOffset: swordAngleOffsetLegacy,
        }
      : facingOrOptions;

  const facing = options.facing;
  const attacking = Boolean(options.attacking);
  const swordAngleOffset = options.swordAngleOffset ?? 0;
  const comboStep: ComboStep = options.comboStep ?? 1;
  const hitFlash = Boolean(options.hitFlash);
  const rival = Boolean(options.rival);
  const palette = paletteFor(rival, hitFlash);

  graphics.clear();

  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(0, 16, 22, 8);

  graphics.fillStyle(palette.tunic);
  graphics.fillRoundedRect(-11, -6, 22, 20, 3);

  graphics.fillStyle(palette.sash);
  graphics.fillRect(-12, 2, 24, 5);

  graphics.fillStyle(palette.sashTie);
  if (facing === 'east') {
    graphics.fillTriangle(10, -2, 22, 4, 10, 10);
  } else if (facing === 'west') {
    graphics.fillTriangle(-10, -2, -22, 4, -10, 10);
  } else {
    graphics.fillTriangle(-4, 8, 4, 8, 0, 18);
  }

  graphics.fillStyle(palette.head);
  graphics.fillCircle(0, -14, 11);
  graphics.fillStyle(palette.mask);
  graphics.fillCircle(0, -13, 8);
  graphics.fillStyle(0x0c1118);
  graphics.fillRect(-8, -16, 16, 5);

  graphics.fillStyle(palette.band);
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

  graphics.fillStyle(palette.arms);
  graphics.fillRect(-14, 0, 6, 12);
  graphics.fillRect(8, 0, 6, 12);

  drawNinjaSword(graphics, facing, attacking, swordAngleOffset, comboStep, palette.glove, hitFlash);
};

/**
 * Draws Ninja's katana held in hand.
 * Light / heavy swings scale blade length and sweep weight with combo step.
 */
const drawNinjaSword = (
  graphics: Phaser.GameObjects.Graphics,
  facing: CardinalFacing,
  attacking: boolean,
  swordAngleOffset: number,
  comboStep: ComboStep,
  glove: number,
  hitFlash: boolean,
): void => {
  let handX = 12;
  let handY = 6;
  let baseAngle = Math.PI * 0.15;

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
    handX = 11;
    handY = 7;
    baseAngle = Math.PI * 0.35;
  }

  const finalAngle = baseAngle + swordAngleOffset;
  const bladeLength = attacking ? 24 + comboStep * 6 : 26;
  const bladeWidth = attacking ? 3 + comboStep : 4;

  const cos = Math.cos(finalAngle);
  const sin = Math.sin(finalAngle);
  const perpX = -sin;
  const perpY = cos;

  graphics.fillStyle(glove, 1);
  graphics.fillCircle(handX, handY, 4);
  graphics.fillStyle(COLORS.ink, 1);
  graphics.strokeCircle(handX, handY, 4);

  const hiltEndX = handX - cos * 8;
  const hiltEndY = handY - sin * 8;
  graphics.lineStyle(4, 0x181008, 1);
  graphics.lineBetween(handX, handY, hiltEndX, hiltEndY);
  graphics.fillStyle(COLORS.yellow, 1);
  graphics.fillCircle(hiltEndX, hiltEndY, 3);

  graphics.lineStyle(4, COLORS.yellow, 1);
  graphics.lineBetween(
    handX + cos * 2 + perpX * 5,
    handY + sin * 2 + perpY * 5,
    handX + cos * 2 - perpX * 5,
    handY + sin * 2 - perpY * 5,
  );

  const bladeStartX = handX + cos * 3;
  const bladeStartY = handY + sin * 3;
  const bladeTipX = handX + cos * (3 + bladeLength);
  const bladeTipY = handY + sin * (3 + bladeLength);

  graphics.lineStyle(bladeWidth + 2, COLORS.ink, 1);
  graphics.lineBetween(bladeStartX, bladeStartY, bladeTipX, bladeTipY);

  graphics.lineStyle(bladeWidth, hitFlash ? COLORS.redBright : 0xffffff, 1);
  graphics.lineBetween(bladeStartX, bladeStartY, bladeTipX, bladeTipY);

  graphics.lineStyle(2, attacking ? 0xffffff : COLORS.cyan, 1);
  graphics.lineBetween(
    bladeStartX + perpX * 1.5,
    bladeStartY + perpY * 1.5,
    bladeTipX,
    bladeTipY,
  );
};
