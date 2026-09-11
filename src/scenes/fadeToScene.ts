import Phaser from 'phaser';

const FADE_COLOR = { r: 7, g: 10, b: 18 } as const;

/**
 * Fade the current scene out, then start another.
 * Uses the camera event so a delayed timer cannot outlive a dying scene.
 */
export const fadeToScene = (scene: Phaser.Scene, target: string, duration = 180): void => {
  const camera = scene.cameras.main;
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(target);
  });
  camera.fadeOut(duration, FADE_COLOR.r, FADE_COLOR.g, FADE_COLOR.b);
};
