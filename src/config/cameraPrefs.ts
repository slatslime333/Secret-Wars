import { ARENA } from './arena';
import { MATCH } from './match';

const STORAGE_KEY = 'secret-wars-camera';
const DEFAULT_FOV = 0.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Hard camera zoom floor / ceiling after FOV is applied. */
export const CAMERA_ZOOM_MIN = 0.22;
export const CAMERA_ZOOM_MAX = 5.2;

/**
 * Persistent camera / FOV preference. 0.5 is the default battlefield zoom.
 * Lower FOV zooms in; higher FOV zooms out.
 */
class CameraPrefsController {
  private fov = DEFAULT_FOV;

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { fov?: number };
      if (typeof parsed.fov === 'number') {
        this.fov = clamp01(parsed.fov);
      }
    } catch {
      // Private mode should not break the menu.
    }
  }

  getFov(): number {
    return this.fov;
  }

  setFov(value: number): void {
    this.fov = clamp01(value);
    this.save();
  }

  /**
   * Multiplier on the *gameplay* camera zoom only. 1 at the default slider.
   * Low FOV zooms in hard (up to 5×); high FOV still opens the battlefield.
   * Never apply this to menus, HUD, or other UI cameras.
   */
  zoomMultiplier(): number {
    const t = this.fov;
    if (t <= 0.5) {
      return 5 - t * 8;
    }
    return 1.28 - t * 0.56;
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fov: this.fov }));
    } catch {
      // Ignore quota / privacy failures.
    }
  }
}

export const cameraPrefs = new CameraPrefsController();

/** Gameplay zoom after the FOV slider — spectate cannot zoom in closer than this. */
export const gameplayCameraZoomAt = (layoutZoom: number): number =>
  clamp(layoutZoom * cameraPrefs.zoomMultiplier(), CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);

/**
 * Spectate zoom range: cannot zoom in past the FOV slider, and cannot zoom
 * out far enough for the whole map to fill the view.
 */
export const spectatorZoomLimits = (
  width: number,
  height: number,
  layoutZoom: number,
): { min: number; max: number } => {
  const fovZoom = gameplayCameraZoomAt(layoutZoom);
  const fit = Math.min(width / ARENA.width, height / ARENA.height);
  const zoomOut = Math.max(fit * MATCH.spectator.zoomOutFitMul, CAMERA_ZOOM_MIN);
  return { min: Math.min(zoomOut, fovZoom), max: fovZoom };
};
