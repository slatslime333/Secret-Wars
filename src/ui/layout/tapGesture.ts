import Phaser from 'phaser';

/** Movement above this (game px) is a drag, not a click. */
export const TAP_PX = 12;

export type PointerPress = {
  id: number;
  x: number;
  y: number;
};

export const capturePress = (pointer: Phaser.Input.Pointer): PointerPress => ({
  id: pointer.id,
  x: pointer.x,
  y: pointer.y,
});

/** True when this up belongs to the same press and the pointer barely moved. */
export const isTapRelease = (press: PointerPress | undefined, pointer: Phaser.Input.Pointer): boolean => {
  if (!press || press.id !== pointer.id) {
    return false;
  }
  return Math.hypot(pointer.x - press.x, pointer.y - press.y) <= TAP_PX;
};

/** Wheel pixels clamped so a notch/trackpad flick does not jump the whole list. */
export const normalizedWheelDelta = (
  pointer: Phaser.Input.Pointer,
  dx: number,
  dy: number,
  axis: 'x' | 'y',
): number => {
  const event = pointer.event as WheelEvent | undefined;
  let delta = axis === 'y' ? dy : dx + dy;
  const mode = event?.deltaMode ?? 0;
  if (mode === 1) {
    delta *= 16;
  } else if (mode === 2) {
    delta *= 240;
  }
  return Phaser.Math.Clamp(delta, -72, 72);
};

export const syncHitArea = (object: Phaser.GameObjects.GameObject, width: number, height: number): void => {
  const area = object.input?.hitArea as { width?: number; height?: number } | undefined;
  if (!area) {
    return;
  }
  area.width = width;
  area.height = height;
};
