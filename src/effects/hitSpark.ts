import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

export const spawnHitSpark = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: { heavy?: boolean; finisher?: boolean; blocked?: boolean; clash?: boolean; dirX?: number; dirY?: number } = {},
): void => {
  const heavy = Boolean(options.heavy);
  const finisher = Boolean(options.finisher);
  const blocked = Boolean(options.blocked);
  const clash = Boolean(options.clash);
  const big = finisher || clash;
  const size = clash ? 20 : finisher ? 22 : heavy ? 16 : blocked ? 13 : 9;
  const fill = blocked ? COLORS.cyan : clash ? COLORS.yellow : finisher ? COLORS.yellow : COLORS.paper;
  const stroke = blocked ? COLORS.paper : COLORS.orange;
  const spark = scene.add.rectangle(x, y, size, size, fill).setDepth(14);
  spark.setStrokeStyle(2, stroke);
  scene.tweens.add({
    targets: spark,
    scale: big ? 3.4 : heavy ? 2.6 : 1.8,
    alpha: 0,
    duration: big ? 170 : heavy ? 140 : 90,
    ease: 'Stepped',
    easeParams: [4],
    onComplete: () => spark.destroy(),
  });
  if (!heavy && !big) {
    return;
  }
  const len = Math.hypot(options.dirX ?? 1, options.dirY ?? 0) || 1;
  const streak = scene.add.rectangle(x, y, big ? 34 : 20, big ? 6 : 4, stroke).setDepth(14);
  streak.setRotation(Math.atan2((options.dirY ?? 0) / len, (options.dirX ?? 1) / len));
  scene.tweens.add({
    targets: streak,
    scaleX: big ? 2.6 : 1.7,
    alpha: 0,
    duration: big ? 160 : 110,
    ease: 'Quad.Out',
    onComplete: () => streak.destroy(),
  });
};
