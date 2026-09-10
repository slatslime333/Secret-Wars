import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './theme';

export const createBackdrop = (
  scene: Phaser.Scene,
  options: { accent?: number; embers?: boolean } = {},
): void => {
  const accent = options.accent ?? COLORS.cyan;
  const graphics = scene.add.graphics();

  graphics.fillStyle(COLORS.ink);
  graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  graphics.fillStyle(COLORS.inkSoft);
  graphics.fillTriangle(0, 0, 460, 0, 0, 430);
  graphics.fillTriangle(GAME_WIDTH, 80, GAME_WIDTH, GAME_HEIGHT, 490, GAME_HEIGHT);

  graphics.lineStyle(1, accent, 0.12);
  for (let x = -GAME_HEIGHT; x < GAME_WIDTH; x += 42) {
    graphics.lineBetween(x, GAME_HEIGHT, x + GAME_HEIGHT, 0);
  }
  for (let y = 54; y < GAME_HEIGHT; y += 54) {
    graphics.lineBetween(0, y, GAME_WIDTH, y);
  }

  graphics.fillStyle(accent, 0.08);
  graphics.fillTriangle(0, 320, 360, 0, 470, 0);
  graphics.fillTriangle(960, 190, 960, 540, 650, 540);

  graphics.lineStyle(5, accent, 0.35);
  graphics.lineBetween(0, 505, 960, 505);
  graphics.lineStyle(2, COLORS.paper, 0.12);
  graphics.lineBetween(0, 514, 960, 514);

  if (!options.embers) {
    return;
  }

  for (let i = 0; i < 22; i += 1) {
    const ember = scene.add.rectangle(
      Phaser.Math.Between(18, GAME_WIDTH - 18),
      Phaser.Math.Between(30, GAME_HEIGHT),
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
          Phaser.Math.Between(18, GAME_WIDTH - 18),
          GAME_HEIGHT + Phaser.Math.Between(0, 70),
        );
        ember.setAlpha(Phaser.Math.FloatBetween(0.35, 0.8));
      },
    });
  }
};
