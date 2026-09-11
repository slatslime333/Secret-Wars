import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

export const spawnHitSpark = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: { heavy?: boolean; blocked?: boolean; clash?: boolean } = {},
): void => {
  const heavy = Boolean(options.heavy);
  const blocked = Boolean(options.blocked);
  const clash = Boolean(options.clash);
  const size = clash ? 18 : heavy ? 16 : blocked ? 14 : 12;
  const fill = blocked ? COLORS.cyan : clash ? COLORS.yellow : COLORS.paper;
  const stroke = blocked ? COLORS.paper : clash ? COLORS.orange : COLORS.orange;
  const spark = scene.add.rectangle(x, y, size, size, fill).setDepth(14);
  spark.setStrokeStyle(2, stroke);
  scene.tweens.add({
    targets: spark,
    scale: heavy || clash ? 2.8 : 2.2,
    alpha: 0,
    duration: heavy || clash ? 150 : 110,
    ease: 'Stepped',
    easeParams: [4],
    onComplete: () => spark.destroy(),
  });
};
