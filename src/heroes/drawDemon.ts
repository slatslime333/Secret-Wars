import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions, drawOvalEye } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

type Palette = {
  skin: number;
  skinDark: number;
  horn: number;
  hornDark: number;
  eye: number;
  claw: number;
  flame: number;
  flameHot: number;
  wax: number;
  holder: number;
  band: number;
  shadow: number;
};

const paletteFor = (rival: boolean, hitFlash: boolean): Palette => {
  if (hitFlash) {
    return {
      skin: 0xffd8c8,
      skinDark: 0xe8a090,
      horn: 0xfff0c8,
      hornDark: 0xd4b070,
      eye: COLORS.ink,
      claw: 0xfff6e0,
      flame: 0xfff080,
      flameHot: 0xffffff,
      wax: 0xfff8e8,
      holder: 0xffe080,
      band: rival ? COLORS.redBright : COLORS.cyan,
      shadow: 0x4a2018,
    };
  }
  if (rival) {
    return {
      skin: 0x9a2018,
      skinDark: 0x5a100c,
      horn: 0x2a1810,
      hornDark: 0x140c08,
      eye: 0xffe878,
      claw: 0x1a1010,
      flame: 0xff6a18,
      flameHot: 0xfff080,
      wax: 0xe8d8b0,
      holder: 0x8a6a28,
      band: COLORS.redBright,
      shadow: 0x2a0808,
    };
  }
  return {
    skin: 0xd03028,
    skinDark: 0x8a1814,
    horn: 0x3a2418,
    hornDark: 0x1a100c,
    eye: 0xffe050,
    claw: 0x241818,
    flame: 0xff7a20,
    flameHot: 0xfff2a0,
    wax: 0xf4ead0,
    holder: 0xc4a050,
    band: COLORS.cyan,
    shadow: 0x3a1010,
  };
};

/**
 * Skinny red imp with a candle, or a hulking horned demon, in the same
 * chunky comic language as Cole / Shadow / Mender.
 */
export const drawDemon = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const palette = paletteFor(Boolean(opts.rival), Boolean(opts.hitFlash));
  const liftL = opts.armLiftLeft ?? 0;
  const liftR = opts.armLiftRight ?? 0;
  const form = opts.demonForm ?? 'little';

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  const shadowW = form === 'big' ? 20 : form === 'bat' ? 16 : 12;
  graphics.fillEllipse(facing === 'east' ? 1 : facing === 'west' ? -1 : 0, 16, shadowW, 5);

  if (form === 'bat') {
    drawBat(graphics, palette, facing);
    return;
  }
  if (form === 'big' || form === 'transforming') {
    drawBig(graphics, palette, facing, liftL, liftR, form === 'transforming');
    return;
  }
  drawLittle(graphics, palette, facing, liftL, liftR);
};

export const demonCandleOrigin = (
  x: number,
  y: number,
  aimRad: number,
  reach = 12,
): { x: number; y: number } => ({
  x: x + Math.cos(aimRad) * reach,
  y: y + Math.sin(aimRad) * reach - 4,
});

const drawLittle = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  facing: CardinalFacing,
  liftL: number,
  liftR: number,
): void => {
  const dir = facing === 'west' ? -1 : facing === 'east' ? 1 : 0;
  const north = facing === 'north';

  g.fillStyle(p.skinDark);
  g.fillRoundedRect(-3.4 + dir * 0.4, 9.2, 2.8, 6.2, 1.4);
  g.fillRoundedRect(0.6 + dir * 0.4, 9.2, 2.8, 6.2, 1.4);
  g.fillStyle(p.skin);
  g.fillRoundedRect(-3 + dir * 0.4, 9, 2.2, 5.4, 1.2);
  g.fillRoundedRect(0.8 + dir * 0.4, 9, 2.2, 5.4, 1.2);

  g.fillStyle(p.skinDark);
  g.fillEllipse(dir * 0.3, 3.4, 9.6, 11.4);
  g.fillStyle(p.skin);
  g.fillEllipse(dir * 0.3, 3.2, 8.2, 10);

  g.fillStyle(p.band);
  g.fillRect(-4.2, 1.2, 8.4, 1.6);

  const armY = 1.4;
  g.fillStyle(p.skinDark);
  g.fillEllipse(-6.4 + dir, armY - liftL * 5, 3.4, 6.2);
  g.fillEllipse(6.4 + dir, armY - liftR * 5, 3.4, 6.2);
  g.fillStyle(p.skin);
  g.fillEllipse(-6.1 + dir, armY - 0.4 - liftL * 5, 2.6, 5.2);
  g.fillEllipse(6.1 + dir, armY - 0.4 - liftR * 5, 2.6, 5.2);

  g.fillStyle(p.skinDark);
  g.fillEllipse(dir * 0.4, -8.4, 11.4, 13.2);
  g.fillStyle(p.skin);
  g.fillEllipse(dir * 0.4, -8.6, 10, 11.8);

  drawTinyHorns(g, p, dir, north);
  const faceX = north ? 0 : dir === 0 ? 0 : dir * 1.4;
  if (!north) {
    drawOvalEye(g, faceX - 2.2, -9.2, p.eye, 0.85);
    drawOvalEye(g, faceX + 2.2, -9.2, p.eye, 0.85);
  }

  const candleX = (dir === 0 ? 7.4 : dir * 9.2) + dir * liftR * 2;
  const candleY = armY - 2 - liftR * 6;
  drawCandle(g, p, candleX, candleY);
};

const drawTinyHorns = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number, north: boolean): void => {
  g.fillStyle(p.hornDark);
  g.fillTriangle(-5.2 + dir, -14.6, -2.6 + dir, -14.2, -4.6 + dir, -19.4);
  g.fillTriangle(5.2 + dir, -14.6, 2.6 + dir, -14.2, 4.6 + dir, -19.4);
  g.fillStyle(p.horn);
  g.fillTriangle(-4.6 + dir, -14.4, -3 + dir, -14.2, -4.2 + dir, -18.4);
  g.fillTriangle(4.6 + dir, -14.4, 3 + dir, -14.2, 4.2 + dir, -18.4);
  if (north) {
    g.fillStyle(p.hornDark);
    g.fillTriangle(-3.4, -16, 3.4, -16, 0, -20.4);
  }
};

const drawCandle = (g: Phaser.GameObjects.Graphics, p: Palette, x: number, y: number): void => {
  g.fillStyle(p.holder);
  g.fillEllipse(x, y + 3.4, 4.6, 1.8);
  g.fillRect(x - 0.7, y - 1.2, 1.4, 4.2);
  g.fillStyle(p.wax);
  g.fillRoundedRect(x - 1.3, y - 6.4, 2.6, 5.6, 1);
  g.fillStyle(p.flame);
  g.fillEllipse(x, y - 8.6, 2.6, 4.2);
  g.fillStyle(p.flameHot);
  g.fillEllipse(x, y - 8.2, 1.2, 2.2);
};

const drawBig = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  facing: CardinalFacing,
  liftL: number,
  liftR: number,
  morph: boolean,
): void => {
  const dir = facing === 'west' ? -1 : facing === 'east' ? 1 : 0;
  const north = facing === 'north';
  const grow = morph ? 0.82 : 1;

  g.fillStyle(p.skinDark);
  g.fillRoundedRect((-6.4 + dir * 0.5) * grow, 8.4, 5.2 * grow, 8.2, 2);
  g.fillRoundedRect((1.4 + dir * 0.5) * grow, 8.4, 5.2 * grow, 8.2, 2);
  g.fillStyle(p.skin);
  g.fillRoundedRect((-5.6 + dir * 0.5) * grow, 8.2, 4 * grow, 7.2, 1.8);
  g.fillRoundedRect((1.8 + dir * 0.5) * grow, 8.2, 4 * grow, 7.2, 1.8);

  g.fillStyle(p.skinDark);
  g.fillEllipse(dir * 0.4, 1.6, 16.8 * grow, 16.4 * grow);
  g.fillStyle(p.skin);
  g.fillEllipse(dir * 0.4, 1.2, 14.6 * grow, 14.4 * grow);
  g.fillStyle(p.skinDark);
  g.fillEllipse(dir * 0.2, -1.2, 12.4 * grow, 8.2 * grow);
  g.fillStyle(p.band);
  g.fillRect(-7.2 * grow, -1.4, 14.4 * grow, 2);

  drawClawArm(g, p, -10.6 * grow + dir, 0.6 - liftL * 7, liftL, -1);
  drawClawArm(g, p, 10.6 * grow + dir, 0.6 - liftR * 7, liftR, 1);

  g.fillStyle(p.skinDark);
  g.fillEllipse(dir * 0.5, -11.2 * grow, 14.8 * grow, 16.4 * grow);
  g.fillStyle(p.skin);
  g.fillEllipse(dir * 0.5, -11.6 * grow, 12.8 * grow, 14.6 * grow);

  drawBigHorns(g, p, dir, north, grow);
  if (!north) {
    const faceX = dir * 1.6 * grow;
    drawOvalEye(g, faceX - 3.2 * grow, -12.4 * grow, p.eye, 1.15 * grow);
    drawOvalEye(g, faceX + 3.2 * grow, -12.4 * grow, p.eye, 1.15 * grow);
    g.fillStyle(p.skinDark);
    g.fillTriangle(faceX - 1.2, -7.2 * grow, faceX + 1.2, -7.2 * grow, faceX, -5.2 * grow);
  }
};

const drawClawArm = (
  g: Phaser.GameObjects.Graphics,
  p: Palette,
  x: number,
  y: number,
  lift: number,
  side: number,
): void => {
  g.fillStyle(p.skinDark);
  g.fillEllipse(x, y, 6.4, 9.2);
  g.fillStyle(p.skin);
  g.fillEllipse(x - side * 0.4, y - 0.6, 5.2, 7.8);
  g.fillStyle(p.claw);
  for (let i = 0; i < 3; i += 1) {
    const ox = side * (4.4 + i * 0.4);
    const oy = -2.2 - lift * 2 + (i - 1) * 2.4;
    g.fillTriangle(x + ox * 0.2, y + oy * 0.15, x + ox * 0.1, y + oy * 0.4, x + ox, y + oy - 5.4);
  }
};

const drawBigHorns = (g: Phaser.GameObjects.Graphics, p: Palette, dir: number, north: boolean, grow: number): void => {
  const y = -16.4 * grow;
  g.fillStyle(p.hornDark);
  g.fillTriangle(-6.4 * grow + dir, y, -2.2 * grow + dir, y + 2, -11.4 * grow + dir, y - 12.4 * grow);
  g.fillTriangle(6.4 * grow + dir, y, 2.2 * grow + dir, y + 2, 11.4 * grow + dir, y - 12.4 * grow);
  g.fillStyle(p.horn);
  g.fillTriangle(-5.4 * grow + dir, y + 0.4, -3 * grow + dir, y + 1.4, -9.6 * grow + dir, y - 10.4 * grow);
  g.fillTriangle(5.4 * grow + dir, y + 0.4, 3 * grow + dir, y + 1.4, 9.6 * grow + dir, y - 10.4 * grow);
  if (north) {
    g.fillStyle(p.hornDark);
    g.fillTriangle(-4, y - 2, 4, y - 2, 0, y - 14 * grow);
  }
};

const drawBat = (g: Phaser.GameObjects.Graphics, p: Palette, facing: CardinalFacing): void => {
  const dir = facing === 'west' ? -1 : 1;
  g.fillStyle(p.flame, 0.35);
  g.fillEllipse(0, 1, 22, 10);
  g.fillStyle(p.skinDark);
  g.beginPath();
  g.moveTo(-16 * dir, 2);
  g.lineTo(-2 * dir, -2);
  g.lineTo(-14 * dir, -8);
  g.lineTo(-18 * dir, -1);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(16 * dir, 2);
  g.lineTo(2 * dir, -2);
  g.lineTo(14 * dir, -8);
  g.lineTo(18 * dir, -1);
  g.closePath();
  g.fillPath();
  g.fillStyle(p.flame);
  g.beginPath();
  g.moveTo(-14 * dir, 1);
  g.lineTo(-2 * dir, -1);
  g.lineTo(-12 * dir, -6);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(14 * dir, 1);
  g.lineTo(2 * dir, -1);
  g.lineTo(12 * dir, -6);
  g.closePath();
  g.fillPath();
  g.fillStyle(p.skinDark);
  g.fillEllipse(0, -1, 8.4, 7.6);
  g.fillStyle(p.skin);
  g.fillEllipse(0, -1.4, 6.8, 6.2);
  g.fillStyle(p.flameHot);
  g.fillEllipse(-1.6, -2, 2.2, 2.8);
  g.fillEllipse(1.6, -2, 2.2, 2.8);
  g.fillStyle(p.horn);
  g.fillTriangle(-2.4, -4.4, -0.6, -4, -2.8, -8);
  g.fillTriangle(2.4, -4.4, 0.6, -4, 2.8, -8);
};
