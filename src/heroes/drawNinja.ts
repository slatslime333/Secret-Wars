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
      suit: 0x3a3a44,
      suitLite: 0x5a5a68,
      wrap: 0x2a2a32,
      hood: 0x32323c,
      band: rival ? COLORS.redBright : COLORS.cyan,
      eye: 0xfff6a0,
      eyeCore: 0xffee66,
      glove: 0x2a2a32,
    };
  }
  if (rival) {
    return {
      suit: 0x0a080c,
      suitLite: 0x161218,
      wrap: 0x08060a,
      hood: 0x100c12,
      band: COLORS.redBright,
      eye: 0xffe14a,
      eyeCore: 0xfff6a8,
      glove: 0x0c0a0e,
    };
  }
  return {
    suit: 0x0c0c12,
    suitLite: 0x18181f,
    wrap: 0x08080c,
    hood: 0x101016,
    band: COLORS.cyan,
    eye: 0xffe14a,
    eyeCore: 0xfff6a8,
    glove: 0x0a0a10,
  };
};

/** Pixel-comic shinobi: all-black wraps, hooded mask, yellow eyes, katana. */
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
  const lift = attacking ? 0.35 : 0;

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, 18, 6);

  if (facing === 'east') {
    drawNinjaSide(graphics, palette, 1, lift);
  } else if (facing === 'west') {
    drawNinjaSide(graphics, palette, -1, lift);
  } else {
    drawNinjaFront(graphics, palette, facing === 'north', lift);
  }

  drawNinjaSword(graphics, facing, attacking, swordAngleOffset, comboStep, palette.glove, hitFlash);
};

const drawNinjaFront = (
  g: Phaser.GameObjects.Graphics,
  p: ReturnType<typeof paletteFor>,
  north: boolean,
  lift: number,
): void => {
  g.fillStyle(p.wrap);
  g.fillRoundedRect(-7, 8, 5.5, 8, 2);
  g.fillRoundedRect(1.5, 8, 5.5, 8, 2);
  g.fillStyle(p.suit);
  g.fillRect(-6.5, 8, 4, 6);
  g.fillRect(2.5, 8, 4, 6);

  g.fillStyle(p.suit);
  g.fillRoundedRect(-10, -8, 20, 18, 4);
  g.fillStyle(p.suitLite);
  g.fillRect(-8, -6, 16, 3);
  g.fillStyle(p.band);
  g.fillRect(-10, 2, 20, 2);

  const armY = -2 - lift * 8;
  g.fillStyle(p.wrap);
  g.fillRoundedRect(-14, armY, 5, 13, 2);
  g.fillRoundedRect(9, armY - 1, 5, 13, 2);

  g.fillStyle(p.hood);
  g.fillEllipse(0, -16, 22, 22);
  g.fillTriangle(-11, -16, 11, -16, 0, -30);
  g.fillStyle(p.suit);
  g.fillEllipse(0, -15, 18, 18);
  if (!north) {
    g.fillStyle(p.suitLite);
    g.fillEllipse(0, -13.5, 14, 12);
    drawNinjaEyes(g, p, 0, -14.2, 0);
    g.fillStyle(p.wrap);
    g.fillEllipse(0, -10.5, 13, 7);
  }
};

const drawNinjaSide = (
  g: Phaser.GameObjects.Graphics,
  p: ReturnType<typeof paletteFor>,
  dir: number,
  lift: number,
): void => {
  g.fillStyle(p.wrap);
  g.fillRoundedRect(-5 + dir, 8, 10, 8, 2);
  g.fillStyle(p.suit);
  g.fillRect(-4 + dir, 8, 8, 6);

  g.fillStyle(p.suit);
  g.fillRoundedRect(-9 + dir, -8, 18, 18, 4);
  g.fillStyle(p.suitLite);
  g.fillRect(-7 + dir, -6, 14, 3);
  g.fillStyle(p.band);
  g.fillRect(-9 + dir, 2, 18, 2);

  const backY = -1;
  const frontY = -2 - lift * 9;
  g.fillStyle(p.wrap);
  g.fillRoundedRect(-13 * dir - (dir > 0 ? 0 : 5), backY, 5, 12, 2);
  g.fillRoundedRect(8 * dir - (dir > 0 ? 0 : 5), frontY, 5, 13, 2);

  g.fillStyle(p.hood);
  g.fillEllipse(dir * 1.5, -16, 20, 22);
  g.fillTriangle(-8 + dir * 2, -18, 8 + dir * 4, -14, dir * 4, -30);
  g.fillStyle(p.suit);
  g.fillEllipse(dir * 2.2, -14.5, 15, 16);
  g.fillStyle(p.suitLite);
  g.fillEllipse(dir * 3.4, -13.2, 10, 11);
  drawNinjaEyes(g, p, dir * 5.2, -13.8, dir);
  g.fillStyle(p.wrap);
  g.fillEllipse(dir * 3.2, -10, 10, 6);
};

const drawNinjaEyes = (
  g: Phaser.GameObjects.Graphics,
  p: ReturnType<typeof paletteFor>,
  cx: number,
  cy: number,
  dir: number,
): void => {
  const drawOne = (x: number): void => {
    g.fillStyle(p.eye);
    g.fillEllipse(x, cy, 3.4, 2.4);
    g.fillStyle(p.eyeCore);
    g.fillEllipse(x + dir * 0.2, cy, 2.2, 1.5);
    g.fillStyle(COLORS.ink);
    g.fillEllipse(x + dir * 0.25, cy, 1.1, 1.4);
    g.fillStyle(0xffffff);
    g.fillCircle(x - 0.6, cy - 0.4, 0.45);
  };
  if (dir === 0) {
    drawOne(cx - 3.2);
    drawOne(cx + 3.2);
    return;
  }
  drawOne(cx);
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
