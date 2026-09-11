import Phaser from 'phaser';
import { COLORS } from './theme';

export const createBackdrop = (
  scene: Phaser.Scene,
  options: { accent?: number; embers?: boolean } = {},
): void => {
  const accent = options.accent ?? COLORS.cyan;
  const graphics = scene.add.graphics();
  const width = scene.scale.width;
  const height = scene.scale.height;

  graphics.fillStyle(COLORS.ink);
  graphics.fillRect(0, 0, width, height);

  graphics.fillStyle(COLORS.inkSoft);
  graphics.fillTriangle(0, 0, Math.min(460, width * 0.5), 0, 0, Math.min(430, height * 0.8));
  graphics.fillTriangle(width, 80, width, height, Math.max(0, width - 470), height);

  graphics.lineStyle(1, accent, 0.12);
  for (let x = -height; x < width; x += 42) {
    graphics.lineBetween(x, height, x + height, 0);
  }
  for (let y = 54; y < height; y += 54) {
    graphics.lineBetween(0, y, width, y);
  }

  graphics.fillStyle(accent, 0.08);
  graphics.fillTriangle(0, 320, Math.min(360, width * 0.4), 0, Math.min(470, width * 0.5), 0);
  graphics.fillTriangle(width, 190, width, height, Math.max(0, width - 310), height);

  graphics.lineStyle(5, accent, 0.35);
  graphics.lineBetween(0, height - 35, width, height - 35);
  graphics.lineStyle(2, COLORS.paper, 0.12);
  graphics.lineBetween(0, height - 26, width, height - 26);

  if (!options.embers) {
    return;
  }

  for (let i = 0; i < 22; i += 1) {
    const ember = scene.add.rectangle(
      Phaser.Math.Between(18, width - 18),
      Phaser.Math.Between(30, height),
      Phaser.Math.RND.pick([2, 3, 4]),
      Phaser.Math.RND.pick([2, 3, 5]),
      Phaser.Math.RND.pick([COLORS.redBright, COLORS.orange, COLORS.yellow]),
      Phaser.Math.FloatBetween(0.35, 0.8),
    );

    scene.tweens.add({
      targets: ember,
      y: ember.y - Phaser.Math.Between(70, 170),
      x: ember.x + Phaser.Math.Between(-26, 26),
      alpha: 0,
      duration: Phaser.Math.Between(1500, 3000),
      ease: 'Stepped',
      easeParams: [8],
      repeat: -1,
      delay: Phaser.Math.Between(0, 1500),
      onRepeat: () => {
        ember.setPosition(
          Phaser.Math.Between(18, width - 18),
          height + Phaser.Math.Between(0, 70),
        );
        ember.setAlpha(Phaser.Math.FloatBetween(0.35, 0.8));
      },
    });
  }
};
