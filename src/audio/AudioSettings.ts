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
  private context: AudioContext | null = null;

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

  /** Short square blip so the SFX slider is audibly doing something. */
  playUiTick(): void {
    if (this.sfxVolume <= 0.01 || typeof window === 'undefined') {
      return;
    }

    const AudioContextImpl =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextImpl) {
      return;
    }

    this.context ??= new AudioContextImpl();
    void this.context.resume();

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = AUDIO.uiTickHz;
    gain.gain.value = 0.045 * this.sfxVolume;
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + AUDIO.uiTickSeconds);
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
