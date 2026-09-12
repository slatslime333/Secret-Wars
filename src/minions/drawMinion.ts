import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { MINION_TEAM_SKIN } from '../config/minion';
import type { TeamId } from '../config/hero';
import type { HeroDrawOptions } from '../heroes/heroDraw';
import type { CardinalFacing } from '../heroes/drawNinja';
import type { MinionKind } from '../config/minion';

const paletteFor = (team: TeamId, hitFlash: boolean) => {
  const skin = MINION_TEAM_SKIN[team];
  if (hitFlash) {
    return {
      skin: 0xf6f1de,
      skinDark: skin.skin,
      cloth: skin.cloth,
      leather: 0xc8a060,
      steel: 0xffffff,
      wood: 0xe8c070,
    };
  }
  return {
    skin: skin.skin,
    skinDark: skin.skinDark,
    cloth: skin.cloth,
    leather: skin.leather,
    steel: 0xe8e4d8,
    wood: 0xb87a3a,
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
 * Small team-colored orc. Not a tiny hero clone — disposable battlefield
 * unit. Skin/body use a muted team color; pennant keeps the bright accent.
 */
export const drawMinion = (
  graphics: Phaser.GameObjects.Graphics,
  options: HeroDrawOptions | CardinalFacing,
  kind: MinionKind = 'sword',
): void => {
  const opts: HeroDrawOptions = typeof options === 'string' ? { facing: options } : options;
  const facing = opts.facing;
  const team = opts.team ?? (opts.rival ? 'bravo' : 'alpha');
  const palette = paletteFor(team, Boolean(opts.hitFlash));
  const flag = team === 'bravo' ? COLORS.redBright : COLORS.cyan;
  const swing = opts.swordAngleOffset ?? 0;
  const east = facing === 'east';
  const west = facing === 'west';

  graphics.clear();
  graphics.fillStyle(COLORS.ink, 0.45);
  graphics.fillEllipse(0, 12, 15, 5);

  const flagX = west ? 6 : -6;
  graphics.lineStyle(1.8, COLORS.ink, 1);
  graphics.lineBetween(flagX, -14, flagX, 5);
  graphics.fillStyle(flag);
  graphics.fillTriangle(flagX, -13, flagX, -3, flagX + (west ? 9 : -9), -8);
  graphics.lineStyle(1.2, COLORS.paper, 0.7);
  graphics.strokeTriangle(flagX, -13, flagX, -3, flagX + (west ? 9 : -9), -8);

  graphics.fillStyle(COLORS.ink, 1);
  graphics.fillRoundedRect(-8, -5, 16, 16, 3);
  graphics.fillStyle(palette.cloth);
  graphics.fillRoundedRect(-7, -4, 14, 14, 3);
  graphics.fillStyle(palette.leather);
  graphics.fillRect(-7, 2, 14, 3);

  graphics.fillStyle(COLORS.ink, 1);
  graphics.fillCircle(0, -9, 7.2);
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

  graphics.fillStyle(COLORS.paper, 0.9);
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

  graphics.fillStyle(COLORS.ink, 1);
  graphics.fillRect(-10, -1, 5, 10);
  graphics.fillRect(5, -1, 5, 10);
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
  palette: ReturnType<typeof paletteFor>,
  facing: CardinalFacing,
  swing: number,
): void => {
  const handX = facing === 'west' ? -8 : 8;
  const base = facing === 'west' ? Math.PI * 0.75 : Math.PI * 0.25;
  const angle = base + swing;
  const tx = handX + Math.cos(angle) * 15;
  const ty = 4 + Math.sin(angle) * 15;
  graphics.lineStyle(4, COLORS.ink, 1);
  graphics.lineBetween(handX, 4, tx, ty);
  graphics.lineStyle(2.2, palette.steel, 1);
  graphics.lineBetween(handX, 4, tx, ty);
  graphics.fillStyle(palette.leather);
  graphics.fillCircle(handX, 4, 2.2);
};

const drawBow = (
  graphics: Phaser.GameObjects.Graphics,
  palette: ReturnType<typeof paletteFor>,
  facing: CardinalFacing,
  swing: number,
  attacking: boolean,
): void => {
  const dir = facing === 'west' ? -1 : 1;
  const ox = dir * 8;
  const pull = attacking ? 3 + swing * 2 : 0;
  graphics.lineStyle(3.4, COLORS.ink, 1);
  graphics.beginPath();
  graphics.arc(ox, 1, 8, dir > 0 ? -1.1 : Math.PI - 1.1, dir > 0 ? 1.1 : Math.PI + 1.1);
  graphics.strokePath();
  graphics.lineStyle(2.3, palette.wood, 1);
  graphics.beginPath();
  graphics.arc(ox, 1, 8, dir > 0 ? -1.1 : Math.PI - 1.1, dir > 0 ? 1.1 : Math.PI + 1.1);
  graphics.strokePath();
  graphics.lineStyle(1.3, palette.steel, 1);
  graphics.lineBetween(ox + dir * 2, -6, ox - dir * pull, 1);
  graphics.lineBetween(ox + dir * 2, 8, ox - dir * pull, 1);
};
