import { AUDIO } from '../config/audio';

type StoredSettings = {
  musicVolume: number;
  sfxVolume: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Persistent volume bus. Settings writes here; later combat/UI sounds should
 * read these getters instead of inventing a second volume path.
 */
class AudioSettingsController {
  private musicVolume: number = AUDIO.defaultMusicVolume;
  private sfxVolume: number = AUDIO.defaultSfxVolume;
  private uiTickPlayer: (() => void) | null = null;

  load(): void {
    try {
      const raw = localStorage.getItem(AUDIO.storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      if (typeof parsed.musicVolume === 'number') {
        this.musicVolume = clamp01(parsed.musicVolume);
      }
      if (typeof parsed.sfxVolume === 'number') {
        this.sfxVolume = clamp01(parsed.sfxVolume);
      }
    } catch {
      // Private mode / blocked storage should not break the menu.
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setMusicVolume(value: number): void {
    this.musicVolume = clamp01(value);
    this.save();
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = clamp01(value);
    this.save();
  }

  /** Lets AudioManager own the one-shot so SFX volume stays on this bus. */
  bindUiTick(player: () => void): void {
    this.uiTickPlayer = player;
  }

  /** Short tick so the SFX slider is audibly doing something. */
  playUiTick(): void {
    this.uiTickPlayer?.();
  }

  private save(): void {
    try {
      const payload: StoredSettings = {
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume,
      };
      localStorage.setItem(AUDIO.storageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota / privacy failures.
    }
  }
}

export const audioSettings = new AudioSettingsController();
