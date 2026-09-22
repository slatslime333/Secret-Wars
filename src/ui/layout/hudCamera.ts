import Phaser from 'phaser';

export const HUD_CAMERA_NAME = 'hud';
const HUD_FLAG = 'hudLayer';
const HUD_ADD_HOOK = 'hudAddHook';

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
  syncHudCameraViewport(scene, scene.scale.width, scene.scale.height);
  scene.time.delayedCall(0, () => {
    if (scene.cameras.getCamera(HUD_CAMERA_NAME)) {
      syncHudCameraViewport(scene, scene.scale.width, scene.scale.height);
    }
  });
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
  if (!ui) {
    return;
  }
  ui.setViewport(0, 0, width, height).setSize(width, height).setZoom(1).setScroll(0, 0);
  syncHudCameraViewport(scene, width, height);
};

const syncHudCameraViewport = (scene: Phaser.Scene, width: number, height: number): void => {
  const manager = scene.game.scene;
  const cameras = scene.cameras.cameras;
  const anyCustom = cameras.some(
    (camera) => camera.x !== 0 || camera.y !== 0 || camera.width !== width || camera.height !== height,
  );
  if (!anyCustom && manager.customViewports !== 0) {
    manager.customViewports = 0;
  }
};

export const adoptHud = (scene: Phaser.Scene, ...objects: Phaser.GameObjects.GameObject[]): void => {
  for (const object of objects) {
    flagHud(object);
    const ui = scene.cameras.getCamera(HUD_CAMERA_NAME);
    if (!ui) {
      continue;
    }
    object.cameraFilter &= ~ui.id;
    // Containers are parents: Camera.ignore only flags children, so the
    // container itself stayed on the world camera. Its zoomed hit box then
    // sat on the health bar and score and opened the pause menu.
    object.cameraFilter |= scene.cameras.main.id;
    scene.cameras.main.ignore(object);
    const nested = object as Phaser.GameObjects.Container;
    if (Array.isArray(nested.list)) {
      hookHudAdds(scene, nested);
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
  const parent = (go as Phaser.GameObjects.Container).parentContainer;
  if (isHud(go) || (parent && isHud(parent))) {
    adoptHud(this, go);
    return;
  }
  this.cameras.getCamera(HUD_CAMERA_NAME)?.ignore(go);
}

/** Children added after the first adoptHud still stay on the HUD camera. */
const hookHudAdds = (scene: Phaser.Scene, container: Phaser.GameObjects.Container): void => {
  if (container.getData(HUD_ADD_HOOK)) {
    return;
  }
  container.setData(HUD_ADD_HOOK, true);
  const original = container.addAt.bind(container);
  container.addAt = ((
    child: Phaser.GameObjects.GameObject,
    index?: number,
  ): Phaser.GameObjects.GameObject => {
    const result = original(child, index);
    adoptHud(scene, child);
    return result;
  }) as typeof container.addAt;
};
