import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { HeroDrawOptions } from '../heroes/heroDraw';
import type { CardinalFacing } from '../heroes/drawNinja';

/**
 * Minion-sized bone bodyguard. Readable skull + ribs, purple sockets,
 * team band so packs stay obvious at gameplay distance.
 */
export const drawWitchSkeleton = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const hit = Boolean(opts.hitFlash);
  const rival = Boolean(opts.rival);
  const bone = hit ? 0xfff6de : 0xe8e0d0;
  const boneDark = hit ? 0xd4c8b0 : 0x9a8e7a;
  const voidCol = 0x1a1014;
  const glow = 0x9b4dff;
  const band = rival ? COLORS.redBright : COLORS.cyan;
  const swing = opts.swordAngleOffset ?? 0;
  const east = facing === 'east';
  const west = facing === 'west';

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.4);
  graphics.fillEllipse(0, 12, 14, 5);

  graphics.fillStyle(COLORS.ink);
  graphics.fillRoundedRect(-7, -3, 14, 14, 3);
  graphics.fillStyle(boneDark);
  graphics.fillRoundedRect(-6, -2, 12, 12, 3);
  graphics.fillStyle(bone);
  graphics.fillRect(-5, 0, 10, 2);
  graphics.fillRect(-5, 4, 10, 2);
  graphics.fillRect(-5, 8, 10, 2);

  graphics.fillStyle(band);
  graphics.fillRect(-6, -3, 12, 2);

  graphics.fillStyle(COLORS.ink);
  graphics.fillCircle(0, -9, 6.6);
  graphics.fillStyle(bone);
  graphics.fillCircle(0, -9, 5.6);

  if (facing !== 'north') {
    graphics.fillStyle(voidCol);
    graphics.fillCircle(east ? -1.4 : west ? 1.4 : -1.6, -9.4, 1.5);
    graphics.fillCircle(east ? 1.8 : west ? -1.8 : 1.6, -9.4, 1.5);
    graphics.fillStyle(glow);
    graphics.fillCircle(east ? -1.4 : west ? 1.4 : -1.6, -9.4, 0.8);
    graphics.fillCircle(east ? 1.8 : west ? -1.8 : 1.6, -9.4, 0.8);
    graphics.fillStyle(voidCol);
    graphics.fillRect(-1.4, -7.2, 2.8, 1.4);
  }

  graphics.fillStyle(boneDark);
  graphics.fillRoundedRect(-9, 0, 4, 9, 1);
  graphics.fillRoundedRect(5, 0, 4, 9, 1);

  const handX = east ? 8 : west ? -8 : 7;
  const ang = (east ? 0.4 : west ? Math.PI - 0.4 : 0.9) + swing;
  graphics.lineStyle(2.2, boneDark, 1);
  graphics.lineBetween(handX, 2, handX + Math.cos(ang) * 10, 2 + Math.sin(ang) * 10);
  graphics.fillStyle(bone);
  graphics.fillCircle(handX + Math.cos(ang) * 10, 2 + Math.sin(ang) * 10, 2);
};
