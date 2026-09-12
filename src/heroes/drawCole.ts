import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions } from './heroDraw';
import type { CardinalFacing } from './drawNinja';

const paletteFor = (rival: boolean, hitFlash: boolean) => {
  if (hitFlash) {
    return {
      hoodie: 0xffe08a,
      hoodieDark: 0xd4a84a,
      shirt: 0xfff6d8,
      jeans: 0x3a3a48,
      skin: 0xffd0a8,
      hair: 0x6a3a18,
      eye: 0x4a1010,
      band: rival ? COLORS.redBright : COLORS.cyan,
    };
  }
  if (rival) {
    return {
      hoodie: 0xb8860b,
      hoodieDark: 0x6e5208,
      shirt: COLORS.paper,
      jeans: 0x141418,
      skin: 0xc68654,
      hair: 0x3c2414,
      eye: 0x2a1010,
      band: COLORS.redBright,
    };
  }
  return {
    hoodie: 0xd4a017,
    hoodieDark: 0x8a6c10,
    shirt: COLORS.paper,
    jeans: 0x121826,
    skin: 0xd4a06a,
    hair: 0x3a2210,
    eye: COLORS.ink,
    band: COLORS.cyan,
  };
};

/**
 * Same chunky pixel-comic silhouette as Ninja: one body box, block eyes,
 * team band. Brown buzz is the head itself. Open hoodie shows a shirt sliver.
 */
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

  if (facing === 'east') {
    drawColeEast(graphics, palette, liftL, liftR);
    return;
  }

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(0, 16, 22, 8);

  graphics.fillStyle(palette.hoodie);
  graphics.fillRoundedRect(-13, -24, 26, 14, 7);

  graphics.fillStyle(palette.jeans);
  graphics.fillRoundedRect(-11, 6, 22, 8, 2);

  graphics.fillStyle(palette.hoodie);
  graphics.fillRoundedRect(-11, -6, 22, 16, 3);
  graphics.fillStyle(palette.hoodieDark);
  graphics.fillRect(-11, 8, 22, 2);

  graphics.fillStyle(palette.shirt);
  graphics.fillRect(-2, -5, 4, 14);
  graphics.fillRect(-4, -6, 8, 3);

  graphics.fillStyle(palette.hair);
  graphics.fillCircle(0, -14, 11);

  graphics.fillStyle(palette.skin);
  graphics.fillRect(-7, -13, 14, 8);
  graphics.fillCircle(0, -10, 7);

  graphics.fillStyle(palette.band);
  graphics.fillRect(-11, -18, 22, 4);

  graphics.fillStyle(palette.eye);
  if (facing === 'south') {
    graphics.fillRect(-6, -12, 4, 3);
    graphics.fillRect(2, -12, 4, 3);
    graphics.fillRect(-6, -14, 5, 2);
    graphics.fillRect(1, -14, 5, 2);
  } else if (facing === 'west') {
    graphics.fillRect(-6, -12, 4, 3);
    graphics.fillRect(-6, -14, 5, 2);
  } else {
    graphics.fillRect(-4, -12, 8, 2);
  }

  const leftY = 0 - liftL * 10;
  const rightY = 0 - liftR * 10;
  graphics.fillStyle(palette.hoodie);
  graphics.fillRect(-14, leftY, 6, 12);
  graphics.fillRect(8, rightY, 6, 12);
  graphics.fillStyle(palette.skin);
  graphics.fillCircle(-11, leftY + 12, 3.5);
  graphics.fillCircle(11, rightY + 12, 3.5);
};

/** East profile — same hoodie/buzz, body turned so both eyes are not a front stare. */
const drawColeEast = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  liftL: number,
  liftR: number,
): void => {
  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(1, 16, 20, 8);

  graphics.fillStyle(palette.hoodie);
  graphics.fillRoundedRect(-10, -24, 22, 14, 7);

  graphics.fillStyle(palette.jeans);
  graphics.fillRoundedRect(-9, 6, 20, 8, 2);

  graphics.fillStyle(palette.hoodie);
  graphics.fillRoundedRect(-9, -6, 20, 16, 3);
  graphics.fillStyle(palette.hoodieDark);
  graphics.fillRect(-9, 8, 20, 2);

  graphics.fillStyle(palette.shirt);
  graphics.fillRect(1, -5, 3, 14);
  graphics.fillRect(0, -6, 6, 3);

  graphics.fillStyle(palette.hair);
  graphics.fillCircle(2, -14, 11);

  graphics.fillStyle(palette.skin);
  graphics.fillRect(0, -13, 10, 8);
  graphics.fillCircle(4, -10, 6);

  graphics.fillStyle(palette.band);
  graphics.fillRect(-8, -18, 20, 4);

  graphics.fillStyle(palette.eye);
  graphics.fillRect(5, -12, 4, 3);
  graphics.fillRect(4, -14, 5, 2);

  const leftY = 2 - liftL * 8;
  const rightY = 0 - liftR * 10;
  graphics.fillStyle(palette.hoodie);
  graphics.fillRect(-12, leftY, 5, 10);
  graphics.fillRect(8, rightY, 6, 12);
  graphics.fillStyle(palette.skin);
  graphics.fillCircle(-10, leftY + 10, 3);
  graphics.fillCircle(12, rightY + 12, 3.5);
};

const jagged = (
  graphics: Phaser.GameObjects.Graphics,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segs: number,
  jitter: number,
): void => {
  const dx = bx - ax;
  const dy = by - ay;
  graphics.beginPath();
  graphics.moveTo(ax, ay);
  for (let i = 1; i < segs; i += 1) {
    const t = i / segs;
    const px = -dy;
    const py = dx;
    const len = Math.hypot(px, py) || 1;
    const off = (Math.random() - 0.5) * jitter;
    graphics.lineTo(ax + dx * t + (px / len) * off, ay + dy * t + (py / len) * off);
  }
  graphics.lineTo(bx, by);
  graphics.strokePath();
};

/** Dense blue arcs that run shoulder → forearm → hand. */
export const drawColeElectricity = (
  graphics: Phaser.GameObjects.Graphics,
  facing: CardinalFacing,
  now: number,
  liftL = 0,
  liftR = 0,
): void => {
  graphics.clear();
  const leftY = 0 - liftL * 10;
  const rightY = 0 - liftR * 10;
  const west = facing === 'west';
  const arms = [
    { sx: west ? 10 : -11, sy: leftY + 1, ex: west ? 10 : -11, ey: leftY + 12 },
    { sx: west ? -10 : 11, sy: rightY + 1, ex: west ? -10 : 11, ey: rightY + 12 },
  ];
  const pulse = 0.7 + ((now / 80) % 4) * 0.07;
  for (const arm of arms) {
    graphics.lineStyle(4, 0xdff4ff, 0.9 * pulse);
    jagged(graphics, arm.sx, arm.sy, arm.ex, arm.ey, 6, 7);
    graphics.lineStyle(2.4, 0x4aa8ff, 1);
    jagged(graphics, arm.sx + 2, arm.sy, arm.ex + 2, arm.ey, 5, 6);
    graphics.lineStyle(1.6, 0x7ecbff, 0.85);
    jagged(graphics, arm.sx - 2, arm.sy + 1, arm.ex - 2, arm.ey, 5, 5);
    graphics.fillStyle(0xdff4ff, 0.9);
    graphics.fillCircle(arm.ex, arm.ey, 2.2);
    graphics.fillStyle(0x4aa8ff, 0.7);
    graphics.fillCircle(arm.ex + 2, arm.ey - 2, 1.4);
  }
};
