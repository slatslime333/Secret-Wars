import Phaser from 'phaser';

const FADE_COLOR = { r: 7, g: 10, b: 18 } as const;
const fading = new WeakSet<Phaser.Scene>();

/**
 * Fade the current scene out, then start another.
 * A wall-clock fallback still starts the next scene if the fade event never fires
 * (a paused clock, or a frame that threw before the camera finished).
 */
export const fadeToScene = (
  scene: Phaser.Scene,
  target: string,
  duration = 180,
  data?: object,
): void => {
  if (fading.has(scene)) {
    return;
  }
  fading.add(scene);
  scene.time.paused = false;
  scene.physics.world.resume();
  const camera = scene.cameras.main;
  let started = false;
  let fallback = 0;
  const go = (): void => {
    if (started) {
      return;
    }
    started = true;
    fading.delete(scene);
    window.clearTimeout(fallback);
    try {
      scene.scene.start(target, data);
    } catch (error) {
      console.error(error);
    }
  };
  fallback = window.setTimeout(go, duration + 120);
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  camera.fadeOut(duration, FADE_COLOR.r, FADE_COLOR.g, FADE_COLOR.b);
};
