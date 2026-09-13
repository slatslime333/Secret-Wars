const STORAGE_KEY = 'secret-wars-camera';
const DEFAULT_FOV = 0.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

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

  /** Multiplier on the layout camera zoom. 1 at the default slider. */
  zoomMultiplier(): number {
    return 1.24 - this.fov * 0.48;
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
