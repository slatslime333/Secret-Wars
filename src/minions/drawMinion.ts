import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import type { HeroDrawOptions } from '../heroes/heroDraw';
import type { CardinalFacing } from '../heroes/drawNinja';
import type { MinionKind } from '../config/minion';

const orcPalette = (hitFlash: boolean) => {
  if (hitFlash) {
    return {
      skin: 0xb6e06a,
      skinDark: 0x6a8a30,
      cloth: 0x4a3a22,
      leather: 0x7a5a28,
      steel: 0xf0ece0,
      wood: 0xc68654,
    };
  }
  return {
    skin: 0x5a8a28,
    skinDark: 0x3a5c18,
    cloth: 0x2a2418,
    leather: 0x5a3e1c,
    steel: 0xd0ccc0,
    wood: 0x8a5a28,
  };
};

export const drawSwordMinion = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions,
): void => drawMinion(graphics, options, 'sword');

export const drawRangerMinion = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions,
): void => drawMinion(graphics, options, 'ranger');

/**
 * Small green orc. Not a tiny hero clone — disposable battlefield unit
 * with a team pennant on the back.
 */
export const drawMinion = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
  kind: MinionKind = 'sword',
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const palette = orcPalette(Boolean(opts.hitFlash));
  const team = opts.team ?? (opts.rival ? 'bravo' : 'alpha');
  const flag = team === 'bravo' ? COLORS.redBright : COLORS.cyan;
  const swing = opts.swordAngleOffset ?? 0;
  const east = facing === 'east';
  const west = facing === 'west';

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.4);
  graphics.fillEllipse(0, 12, 14, 5);

  const flagX = west ? 5 : -5;
  graphics.fillStyle(flag);
  graphics.fillTriangle(flagX, -10, flagX, -2, flagX + (west ? 7 : -7), -6);
  graphics.lineStyle(1.4, COLORS.ink, 0.9);
  graphics.lineBetween(flagX, -11, flagX, 4);

  graphics.fillStyle(palette.cloth);
  graphics.fillRoundedRect(-7, -4, 14, 14, 3);
  graphics.fillStyle(palette.leather);
  graphics.fillRect(-7, 2, 14, 3);

  graphics.fillStyle(palette.skin);
  graphics.fillCircle(0, -9, 6.5);
  graphics.fillStyle(palette.skinDark);
  if (east) {
    graphics.fillTriangle(5, -11, 9, -8, 5, -6);
  } else if (west) {
    graphics.fillTriangle(-5, -11, -9, -8, -5, -6);
  } else if (facing === 'south') {
    graphics.fillTriangle(-4, -8, -1, -5, -5, -5);
    graphics.fillTriangle(4, -8, 1, -5, 5, -5);
  }

  graphics.fillStyle(COLORS.ink);
  if (facing === 'north') {
    graphics.fillRect(-2, -10, 4, 1);
  } else if (west) {
    graphics.fillRect(-4, -10, 2, 2);
  } else {
    graphics.fillRect(east ? 1 : -3, -10, 2, 2);
    if (!east) {
      graphics.fillRect(1, -10, 2, 2);
    }
  }

  graphics.fillStyle(palette.skin);
  graphics.fillRect(-9, 0, 4, 8);
  graphics.fillRect(5, 0, 4, 8);

  if (kind === 'ranger') {
    drawBow(graphics, palette, facing, swing, Boolean(opts.attacking));
  } else {
    drawSword(graphics, palette, facing, swing);
  }
};

const drawSword = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof orcPalette>,
  facing: CardinalFacing,
  swing: number,
): void => {
  const handX = facing === 'west' ? -8 : 8;
  const base = facing === 'west' ? Math.PI * 0.75 : Math.PI * 0.25;
  const angle = base + swing;
  const tx = handX + Math.cos(angle) * 14;
  const ty = 4 + Math.sin(angle) * 14;
  graphics.lineStyle(3.2, COLORS.ink, 1);
  graphics.lineBetween(handX, 4, tx, ty);
  graphics.lineStyle(2, palette.steel, 1);
  graphics.lineBetween(handX, 4, tx, ty);
  graphics.fillStyle(palette.leather);
  graphics.fillCircle(handX, 4, 2);
};

const drawBow = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof orcPalette>,
  facing: CardinalFacing,
  swing: number,
  attacking: boolean,
): void => {
  const dir = facing === 'west' ? -1 : 1;
  const ox = dir * 8;
  const pull = attacking ? 3 + swing * 2 : 0;
  graphics.lineStyle(2.2, palette.wood, 1);
  graphics.beginPath();
  graphics.arc(ox, 1, 8, dir > 0 ? -1.1 : Math.PI - 1.1, dir > 0 ? 1.1 : Math.PI + 1.1);
  graphics.strokePath();
  graphics.lineStyle(1, palette.steel, 0.9);
  graphics.lineBetween(ox + dir * 2, -6, ox - dir * pull, 1);
  graphics.lineBetween(ox + dir * 2, 8, ox - dir * pull, 1);
};
