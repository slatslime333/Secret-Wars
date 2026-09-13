import Phaser from 'phaser';

export const HUD_CAMERA_NAME = 'hud';
const HUD_FLAG = 'hudLayer';

/**
 * World camera zoom/follow must not move HUD or touch controls. A second
 * camera stays at zoom 1 so sticks, buttons, and chrome sit on the screen
 * edges and receive taps where they are drawn.
 */
export const installHudCamera = (scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera => {
  const existing = scene.cameras.getCamera(HUD_CAMERA_NAME);
  if (existing) {
    resizeHudCamera(scene, scene.scale.width, scene.scale.height);
    return existing;
  }
  const ui = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height, false, HUD_CAMERA_NAME);
  ui.setZoom(1).setScroll(0, 0).setRoundPixels(true);
  for (const go of scene.sys.displayList.list) {
    if (isHud(go)) {
      adoptHud(scene, go);
    } else {
      ui.ignore(go);
    }
  }
  scene.sys.events.on('addedtoscene', onAddedToScene, scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.sys.events.off('addedtoscene', onAddedToScene, scene);
  });
  return ui;
};

export const resizeHudCamera = (scene: Phaser.Scene, width: number, height: number): void => {
  const ui = scene.cameras.getCamera(HUD_CAMERA_NAME);
  ui?.setViewport(0, 0, width, height).setSize(width, height).setZoom(1).setScroll(0, 0);
};

export const adoptHud = (scene: Phaser.Scene, ...objects: Phaser.GameObjects.GameObject[]): void => {
  for (const object of objects) {
    flagHud(object);
    const ui = scene.cameras.getCamera(HUD_CAMERA_NAME);
    if (!ui) {
      continue;
    }
    object.cameraFilter &= ~ui.id;
    scene.cameras.main.ignore(object);
    const nested = object as Phaser.GameObjects.Container;
    if (Array.isArray(nested.list)) {
      adoptHud(scene, ...nested.list);
    }
  }
};

/** Canvas-space point for HUD controls. Ignores world-camera zoom. */
export const hudPointer = (
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer,
): { x: number; y: number } => {
  const ui = scene.cameras.getCamera(HUD_CAMERA_NAME);
  if (!ui) {
    return { x: pointer.x, y: pointer.y };
  }
  const point = ui.getWorldPoint(pointer.x, pointer.y);
  return { x: point.x, y: point.y };
};

const isHud = (go: Phaser.GameObjects.GameObject): boolean => Boolean(go.getData(HUD_FLAG));

const flagHud = (go: Phaser.GameObjects.GameObject): void => {
  go.setData(HUD_FLAG, true);
  const nested = go as Phaser.GameObjects.Container;
  if (Array.isArray(nested.list)) {
    nested.list.forEach(flagHud);
  }
};

function onAddedToScene(this: Phaser.Scene, go: Phaser.GameObjects.GameObject): void {
  if (isHud(go)) {
    adoptHud(this, go);
    return;
  }
  this.cameras.getCamera(HUD_CAMERA_NAME)?.ignore(go);
}
