import Phaser from 'phaser';

const KEY = 'sw-body-dot';

export const ensureBodyTexture = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(KEY)) {
    return;
  }
  const graphics = scene.add.graphics();
  graphics.fillStyle(0xffffff, 1);
  graphics.fillRect(0, 0, 4, 4);
  graphics.generateTexture(KEY, 4, 4);
  graphics.destroy();
};

export const BODY_TEXTURE = KEY;
