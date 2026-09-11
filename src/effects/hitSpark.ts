import Phaser from 'phaser';
import { COLORS } from '../ui/theme';

export const spawnHitSpark = (scene: Phaser.Scene, x: number, y: number): void => {
  const spark = scene.add.rectangle(x, y, 12, 12, COLORS.paper).setDepth(14);
  spark.setStrokeStyle(2, COLORS.orange);
  scene.tweens.add({
    targets: spark,
    scale: 2.2,
    alpha: 0,
    duration: 110,
    ease: 'Stepped',
    easeParams: [4],
    onComplete: () => spark.destroy(),
  });
};
