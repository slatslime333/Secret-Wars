import { audioSettings } from './AudioSettings';
import { AUDIO } from '../config/audio';
import { BUS_GAIN, PRIORITY_BUDGET, SOUND_CATALOG } from './catalog';
import { LOOP_PERIOD_MS, synthesize } from './synth';
import type { AudioPriority, PlayOptions, SoundId } from './types';

const NEAR = 220;
const FAR = 980;
const MIN_DISTANCE_GAIN = 0.14;
const VOICE_LIFE_MS = 180;
const TOTAL_VOICE_CAP = 12;
const PRIORITY_RANK: Record<AudioPriority, number> = { high: 3, medium: 2, low: 1 };

type Voice = {
  id: SoundId;
  priority: AudioPriority;
  until: number;
};

type LoopVoice = {
  id: SoundId;
  key: string;
  options: PlayOptions;
  timer: ReturnType<typeof setInterval>;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * One AudioContext, one SFX master (AudioSettings), plus bus / priority /
 * cooldown / distance. Music is a looping bed on its own gain node.
 */
class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicEl: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private listenerX = 0;
  private listenerY = 0;
  private hasListener = false;
  private readonly lastById = new Map<SoundId, number>();
  private readonly lastByGroup = new Map<string, number>();
  private readonly voices: Voice[] = [];
  private readonly loops = new Map<string, LoopVoice>();

  unlock(): void {
    this.ensureContext();
    this.startMusic();
  }

  /** Loop the bed. Peak loudness is AUDIO.musicPeakGain at a full slider. */
  startMusic(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) {
      return;
    }
    this.syncMusicVolume();
    if (!this.musicEl) {
      return;
    }
    if (this.musicEl.paused) {
      void this.musicEl.play().catch(() => undefined);
    }
  }

  syncMusicVolume(): void {
    if (!this.musicGain) {
      return;
    }
    this.musicGain.gain.value = AUDIO.musicPeakGain * audioSettings.getMusicVolume();
  }

  setListener(x: number, y: number): void {
    this.listenerX = x;
    this.listenerY = y;
    this.hasListener = true;
  }

  /** Music slider. Playback peaks at AUDIO.musicPeakGain. */
  getMusicVolume(): number {
    return audioSettings.getMusicVolume();
  }

  play(id: SoundId, options: PlayOptions = {}): boolean {
    const def = SOUND_CATALOG[id];
    if (!def) {
      return false;
    }
    const master = audioSettings.getSfxVolume();
    if (master <= 0.01) {
      return false;
    }

    const now = performance.now();
    if (def.cooldownMs > 0 && now - (this.lastById.get(id) ?? -9999) < def.cooldownMs) {
      return false;
    }
    if (def.group && now - (this.lastByGroup.get(def.group) ?? -9999) < def.cooldownMs) {
      return false;
    }
    if (!this.admit(def.priority, now)) {
      return false;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.master) {
      return false;
    }

    const spatial = def.spatial ? this.distanceGain(options) : 1;
    const gain = ctx.createGain();
    gain.gain.value = clamp01(def.volume * BUS_GAIN[def.bus] * master * spatial);
    gain.connect(this.master);
    synthesize(ctx, gain, id);

    this.lastById.set(id, now);
    if (def.group) {
      this.lastByGroup.set(def.group, now);
    }
    this.voices.push({ id, priority: def.priority, until: now + VOICE_LIFE_MS });
    return true;
  }

  loop(id: SoundId, key: string, options: PlayOptions = {}): void {
    this.stop(key);
    const def = SOUND_CATALOG[id];
    if (!def) {
      return;
    }
    this.play(id, options);
    const period = LOOP_PERIOD_MS[id] ?? 320;
    const timer = setInterval(() => {
      this.play(id, this.loops.get(key)?.options ?? options);
    }, period);
    this.loops.set(key, { id, key, options: { ...options }, timer });
  }

  moveLoop(key: string, x: number, y: number): void {
    const voice = this.loops.get(key);
    if (!voice) {
      return;
    }
    voice.options.x = x;
    voice.options.y = y;
  }

  stop(key: string): void {
    const voice = this.loops.get(key);
    if (!voice) {
      return;
    }
    clearInterval(voice.timer);
    this.loops.delete(key);
  }

  stopAllLoops(): void {
    for (const voice of this.loops.values()) {
      clearInterval(voice.timer);
    }
    this.loops.clear();
  }

  private admit(priority: AudioPriority, now: number): boolean {
    while (this.voices.length > 0 && this.voices[0].until <= now) {
      this.voices.shift();
    }
    const same = this.voices.filter((voice) => voice.priority === priority).length;
    if (same < PRIORITY_BUDGET[priority] && this.voices.length < TOTAL_VOICE_CAP) {
      return true;
    }
    if (priority === 'high') {
      const stealAt = this.voices.findIndex((voice) => PRIORITY_RANK[voice.priority] < PRIORITY_RANK.high);
      if (stealAt >= 0) {
        this.voices.splice(stealAt, 1);
        return true;
      }
      if (same >= PRIORITY_BUDGET.high) {
        return false;
      }
      return true;
    }
    return false;
  }

  private distanceGain(options: PlayOptions): number {
    if (options.self || !this.hasListener || options.x === undefined || options.y === undefined) {
      return 1;
    }
    const dist = Math.hypot(options.x - this.listenerX, options.y - this.listenerY);
    if (dist <= NEAR) {
      return 1;
    }
    if (dist >= FAR) {
      return MIN_DISTANCE_GAIN;
    }
    const t = (dist - NEAR) / (FAR - NEAR);
    return 1 - (1 - MIN_DISTANCE_GAIN) * t;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    this.context ??= new Ctor();
    this.master ??= this.context.createGain();
    this.master.connect(this.context.destination);
    this.master.gain.value = 1;
    this.ensureMusicGraph(this.context);
    void this.context.resume();
    return this.context;
  }

  private ensureMusicGraph(ctx: AudioContext): void {
    if (this.musicEl && this.musicGain) {
      return;
    }
    this.musicEl = new Audio(new URL(AUDIO.musicSrc, document.baseURI).href);
    this.musicEl.loop = true;
    this.musicEl.preload = 'auto';
    this.musicEl.crossOrigin = 'anonymous';
    this.musicEl.setAttribute('data-secret-wars-music', 'bed');
    this.musicEl.style.display = 'none';
    document.body.appendChild(this.musicEl);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = AUDIO.musicPeakGain * audioSettings.getMusicVolume();
    const source = ctx.createMediaElementSource(this.musicEl);
    source.connect(this.musicGain);
    this.musicGain.connect(ctx.destination);
  }
}

export const audio = new AudioManager();
