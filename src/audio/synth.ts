import type { SoundId } from './types';

type OscKind = OscillatorType;

interface ToneStep {
  kind: OscKind | 'noise';
  freq: number;
  endFreq?: number;
  duration: number;
  gain: number;
  delay?: number;
  attack?: number;
}

const VARIATION = new Map<SoundId, number>();

function vary(id: SoundId, amount: number): number {
  const next = ((VARIATION.get(id) ?? 0) + 1) % 3;
  VARIATION.set(id, next);
  return (next - 1) * amount;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playStep(ctx: AudioContext, dest: AudioNode, step: ToneStep, when: number): void {
  const start = when + (step.delay ?? 0);
  const attack = step.attack ?? 0.004;
  const duration = Math.max(0.02, step.duration);
  const env = ctx.createGain();
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(Math.max(0.001, step.gain), start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  if (step.kind === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, duration + 0.05);
    src.connect(env);
    src.start(start);
    src.stop(start + duration + 0.02);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = step.kind;
  osc.frequency.setValueAtTime(step.freq, start);
  if (step.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, step.endFreq), start + duration);
  }
  osc.connect(env);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playRecipe(ctx: AudioContext, dest: AudioNode, steps: ToneStep[]): void {
  const now = ctx.currentTime;
  for (const step of steps) {
    playStep(ctx, dest, step, now);
  }
}

/** Placeholder loop period until real loop assets replace the synth. */
export const LOOP_PERIOD_MS: Partial<Record<SoundId, number>> = {
  'ninja-tornado-loop': 280,
  'cole-storm-loop': 400,
  'death-sweep-loop': 300,
  'rope-spray-loop': 280,
  'shadow-rage-loop': 260,
};

/**
 * Lightweight Web Audio placeholders. Swap in catalog `asset` files later
 * without changing gameplay hooks.
 */
export function synthesize(ctx: AudioContext, dest: AudioNode, id: SoundId): void {
  const v = (base: number, amount: number): number => base + vary(id, amount);

  switch (id) {
    case 'ui-hover':
      playRecipe(ctx, dest, [{ kind: 'sine', freq: 880, duration: 0.04, gain: 0.16 }]);
      return;
    case 'ui-click':
    case 'ui-tick':
      playRecipe(ctx, dest, [{ kind: 'square', freq: 620, duration: 0.05, gain: 0.15 }]);
      return;
    case 'ui-confirm':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 520, duration: 0.08, gain: 0.18 },
        { kind: 'sine', freq: 780, duration: 0.1, gain: 0.14, delay: 0.05 },
      ]);
      return;
    case 'ui-back':
      playRecipe(ctx, dest, [{ kind: 'sine', freq: 420, endFreq: 280, duration: 0.08, gain: 0.15 }]);
      return;
    case 'ui-select-ninja':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 1400, endFreq: 720, duration: 0.08, gain: 0.13 },
        { kind: 'noise', freq: 0, duration: 0.04, gain: 0.04 },
      ]);
      return;
    case 'ui-select-cole':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: 920, endFreq: 1400, duration: 0.07, gain: 0.09 },
        { kind: 'sawtooth', freq: 240, duration: 0.08, gain: 0.05 },
      ]);
      return;
    case 'ui-select-death':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 90, duration: 0.12, gain: 0.2 },
        { kind: 'noise', freq: 0, duration: 0.05, gain: 0.07 },
      ]);
      return;
    case 'ui-select-rope':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 520, endFreq: 240, duration: 0.07, gain: 0.11 },
        { kind: 'triangle', freq: 880, endFreq: 420, duration: 0.08, gain: 0.08, delay: 0.03 },
        { kind: 'noise', freq: 0, duration: 0.04, gain: 0.05 },
      ]);
      return;
    case 'ui-select-witch':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 220, duration: 0.1, gain: 0.14 },
        { kind: 'triangle', freq: 660, endFreq: 330, duration: 0.12, gain: 0.1, delay: 0.04 },
        { kind: 'sawtooth', freq: 90, duration: 0.1, gain: 0.06 },
      ]);
      return;
    case 'ui-select-shadow':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 110, duration: 0.12, gain: 0.16 },
        { kind: 'sawtooth', freq: 240, endFreq: 80, duration: 0.14, gain: 0.1, delay: 0.04 },
        { kind: 'triangle', freq: 420, endFreq: 160, duration: 0.1, gain: 0.08, delay: 0.06 },
      ]);
      return;
    case 'ui-match-start':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 330, duration: 0.12, gain: 0.16 },
        { kind: 'sine', freq: 494, duration: 0.14, gain: 0.14, delay: 0.1 },
        { kind: 'sine', freq: 660, duration: 0.16, gain: 0.13, delay: 0.2 },
      ]);
      return;
    case 'objective-spawn':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 392, duration: 0.1, gain: 0.16 },
        { kind: 'triangle', freq: 587, duration: 0.12, gain: 0.14, delay: 0.07 },
        { kind: 'sine', freq: 784, duration: 0.16, gain: 0.15, delay: 0.14 },
      ]);
      return;
    case 'objective-complete':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 523, duration: 0.1, gain: 0.16 },
        { kind: 'sine', freq: 659, duration: 0.1, gain: 0.15, delay: 0.08 },
        { kind: 'sine', freq: 784, duration: 0.14, gain: 0.16, delay: 0.16 },
        { kind: 'triangle', freq: 1046, duration: 0.12, gain: 0.1, delay: 0.24 },
      ]);
      return;
    case 'objective-contested':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: 220, duration: 0.06, gain: 0.1 },
        { kind: 'sawtooth', freq: 330, endFreq: 180, duration: 0.08, gain: 0.08, delay: 0.04 },
      ]);
      return;
    case 'piggy-hit':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: v(420, 40), duration: 0.05, gain: 0.12 },
        { kind: 'noise', freq: 0, duration: 0.03, gain: 0.04 },
      ]);
      return;
    case 'piggy-break':
      playRecipe(ctx, dest, [
        { kind: 'noise', freq: 0, duration: 0.12, gain: 0.1 },
        { kind: 'triangle', freq: 240, endFreq: 90, duration: 0.18, gain: 0.16 },
        { kind: 'sine', freq: 880, duration: 0.1, gain: 0.1, delay: 0.06 },
      ]);
      return;
    case 'ui-level-up':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 523, duration: 0.1, gain: 0.15 },
        { kind: 'sine', freq: 659, duration: 0.1, gain: 0.15, delay: 0.08 },
        { kind: 'sine', freq: 784, duration: 0.16, gain: 0.16, delay: 0.16 },
      ]);
      return;
    case 'ui-xp':
      playRecipe(ctx, dest, [{ kind: 'sine', freq: 980, duration: 0.05, gain: 0.11 }]);
      return;
    case 'ui-victory':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 392, duration: 0.16, gain: 0.18 },
        { kind: 'sine', freq: 523, duration: 0.16, gain: 0.16, delay: 0.12 },
        { kind: 'sine', freq: 659, duration: 0.22, gain: 0.18, delay: 0.24 },
      ]);
      return;
    case 'ui-defeat':
      playRecipe(ctx, dest, [{ kind: 'triangle', freq: 220, endFreq: 90, duration: 0.28, gain: 0.18 }]);
      return;
    case 'ui-draw':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 330, duration: 0.1, gain: 0.14 },
        { kind: 'sine', freq: 247, duration: 0.14, gain: 0.12, delay: 0.08 },
      ]);
      return;
    case 'ability-ready':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 740, duration: 0.07, gain: 0.16 },
        { kind: 'triangle', freq: 1175, duration: 0.1, gain: 0.13, delay: 0.045 },
        { kind: 'sine', freq: 1480, duration: 0.08, gain: 0.08, delay: 0.09 },
      ]);
      return;

    case 'ninja-light':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: v(1680, 80), endFreq: v(620, 40), duration: 0.07, gain: 0.15 },
        { kind: 'noise', freq: 0, duration: 0.03, gain: 0.05 },
      ]);
      return;
    case 'ninja-smoke':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 180, endFreq: 70, duration: 0.1, gain: 0.13 },
        { kind: 'noise', freq: 0, duration: 0.18, gain: 0.11, delay: 0.02 },
      ]);
      return;
    case 'ninja-kick-whoosh':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 420, endFreq: 160, duration: 0.12, gain: 0.15 },
        { kind: 'noise', freq: 0, duration: 0.1, gain: 0.07 },
      ]);
      return;
    case 'ninja-kick-impact':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 140, duration: 0.1, gain: 0.22 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.11 },
      ]);
      return;
    case 'ninja-tornado-loop':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 90, duration: 0.28, gain: 0.09 },
        { kind: 'noise', freq: 0, duration: 0.26, gain: 0.06 },
      ]);
      return;
    case 'ninja-tornado-slash':
      playRecipe(ctx, dest, [{ kind: 'sawtooth', freq: v(1100, 90), endFreq: 480, duration: 0.08, gain: 0.13 }]);
      return;

    case 'cole-light':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: v(980, 70), endFreq: v(420, 30), duration: 0.06, gain: 0.11 },
        { kind: 'sawtooth', freq: v(220, 20), duration: 0.05, gain: 0.07 },
      ]);
      return;
    case 'cole-ball-cast':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 280, endFreq: 720, duration: 0.1, gain: 0.11 },
        { kind: 'square', freq: 1100, duration: 0.06, gain: 0.07, delay: 0.04 },
      ]);
      return;
    case 'cole-ball-impact':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: 240, endFreq: 90, duration: 0.1, gain: 0.15 },
        { kind: 'noise', freq: 0, duration: 0.07, gain: 0.07 },
      ]);
      return;
    case 'cole-ball-chain':
      playRecipe(ctx, dest, [{ kind: 'square', freq: v(1500, 120), endFreq: 700, duration: 0.07, gain: 0.09 }]);
      return;
    case 'cole-discharge':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 160, endFreq: 520, duration: 0.14, gain: 0.15 },
        { kind: 'square', freq: 80, duration: 0.16, gain: 0.13, delay: 0.08 },
        { kind: 'noise', freq: 0, duration: 0.12, gain: 0.09, delay: 0.1 },
      ]);
      return;
    case 'cole-storm-loop':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 55, duration: 0.4, gain: 0.06 },
        { kind: 'noise', freq: 0, duration: 0.36, gain: 0.045 },
      ]);
      return;
    case 'cole-storm-warn':
      playRecipe(ctx, dest, [{ kind: 'sine', freq: 210, endFreq: 360, duration: 0.16, gain: 0.11 }]);
      return;
    case 'cole-storm-strike':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 70, duration: 0.16, gain: 0.18 },
        { kind: 'noise', freq: 0, duration: 0.12, gain: 0.12 },
        { kind: 'square', freq: 180, endFreq: 60, duration: 0.1, gain: 0.09 },
      ]);
      return;

    case 'death-light':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: v(110, 12), duration: 0.09, gain: 0.2 },
        { kind: 'noise', freq: 0, duration: 0.05, gain: 0.09 },
      ]);
      return;
    case 'death-gun-start':
      playRecipe(ctx, dest, [{ kind: 'square', freq: 140, duration: 0.08, gain: 0.11 }]);
      return;
    case 'death-gun-shot':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: v(180, 16), endFreq: 50, duration: 0.05, gain: 0.14 },
        { kind: 'noise', freq: 0, duration: 0.04, gain: 0.09 },
      ]);
      return;
    case 'death-smash-windup':
      playRecipe(ctx, dest, [{ kind: 'sawtooth', freq: 70, endFreq: 140, duration: 0.22, gain: 0.11 }]);
      return;
    case 'death-smash-impact':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 55, duration: 0.18, gain: 0.26 },
        { kind: 'noise', freq: 0, duration: 0.1, gain: 0.14 },
        { kind: 'sine', freq: 90, duration: 0.14, gain: 0.15 },
      ]);
      return;
    case 'death-sweep-loop':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 80, duration: 0.3, gain: 0.09 },
        { kind: 'noise', freq: 0, duration: 0.28, gain: 0.055 },
      ]);
      return;
    case 'death-sweep-hit':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: v(95, 10), duration: 0.1, gain: 0.16 },
        { kind: 'noise', freq: 0, duration: 0.06, gain: 0.07 },
      ]);
      return;

    case 'rope-light':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: v(2100, 140), endFreq: v(780, 40), duration: 0.045, gain: 0.12 },
        { kind: 'noise', freq: 0, duration: 0.03, gain: 0.045 },
      ]);
      return;
    case 'rope-dash-fire':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 900, endFreq: 340, duration: 0.08, gain: 0.13 },
        { kind: 'noise', freq: 0, duration: 0.06, gain: 0.06 },
      ]);
      return;
    case 'rope-dash-snap':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: 180, duration: 0.05, gain: 0.16 },
        { kind: 'sawtooth', freq: 1400, endFreq: 400, duration: 0.06, gain: 0.1, delay: 0.02 },
      ]);
      return;
    case 'rope-dash-zip':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 240, endFreq: 720, duration: 0.1, gain: 0.13 },
        { kind: 'noise', freq: 0, duration: 0.07, gain: 0.05 },
      ]);
      return;
    case 'rope-dash-whoosh':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 420, endFreq: 140, duration: 0.12, gain: 0.11 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.05 },
      ]);
      return;
    case 'rope-grab-fire':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 760, endFreq: 280, duration: 0.09, gain: 0.14 },
        { kind: 'noise', freq: 0, duration: 0.05, gain: 0.05 },
      ]);
      return;
    case 'rope-grab-catch':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: 150, duration: 0.06, gain: 0.16 },
        { kind: 'triangle', freq: 90, duration: 0.08, gain: 0.12, delay: 0.02 },
      ]);
      return;
    case 'rope-grab-zip':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 200, endFreq: 860, duration: 0.12, gain: 0.14 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.06 },
      ]);
      return;
    case 'rope-grab-impact':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 110, duration: 0.11, gain: 0.22 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.1 },
        { kind: 'sawtooth', freq: 520, endFreq: 180, duration: 0.07, gain: 0.08 },
      ]);
      return;
    case 'rope-punch-jump':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 180, endFreq: 320, duration: 0.1, gain: 0.12 },
        { kind: 'sawtooth', freq: 90, endFreq: 160, duration: 0.12, gain: 0.08 },
      ]);
      return;
    case 'rope-punch-impact':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 70, duration: 0.14, gain: 0.24 },
        { kind: 'square', freq: 140, endFreq: 50, duration: 0.1, gain: 0.14 },
        { kind: 'noise', freq: 0, duration: 0.09, gain: 0.11 },
      ]);
      return;
    case 'rope-spray-whip':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: v(1900, 180), endFreq: v(620, 50), duration: 0.05, gain: 0.09 },
        { kind: 'noise', freq: 0, duration: 0.03, gain: 0.04 },
      ]);
      return;
    case 'rope-spray-loop':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 140, duration: 0.26, gain: 0.06 },
        { kind: 'noise', freq: 0, duration: 0.24, gain: 0.04 },
      ]);
      return;
    case 'rope-wrap':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 220, endFreq: 90, duration: 0.14, gain: 0.13 },
        { kind: 'sawtooth', freq: 480, endFreq: 160, duration: 0.1, gain: 0.08 },
      ]);
      return;
    case 'witch-light':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: v(180, 12), duration: 0.08, gain: 0.12 },
        { kind: 'triangle', freq: v(520, 30), endFreq: 240, duration: 0.1, gain: 0.1 },
        { kind: 'sawtooth', freq: 90, duration: 0.08, gain: 0.05 },
      ]);
      return;
    case 'witch-skull-spawn':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: v(420, 40), duration: 0.05, gain: 0.08 },
        { kind: 'triangle', freq: v(180, 16), duration: 0.06, gain: 0.07 },
      ]);
      return;
    case 'witch-skull-fire':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: v(880, 80), endFreq: v(240, 20), duration: 0.06, gain: 0.1 },
        { kind: 'noise', freq: 0, duration: 0.03, gain: 0.04 },
      ]);
      return;
    case 'witch-skull-impact':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: v(140, 16), duration: 0.06, gain: 0.12 },
        { kind: 'noise', freq: 0, duration: 0.04, gain: 0.05 },
      ]);
      return;
    case 'witch-tombstone-cast':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 90, duration: 0.16, gain: 0.16 },
        { kind: 'triangle', freq: 160, endFreq: 70, duration: 0.18, gain: 0.12 },
        { kind: 'noise', freq: 0, duration: 0.1, gain: 0.06 },
      ]);
      return;
    case 'witch-tombstone-rise':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 70, endFreq: 140, duration: 0.16, gain: 0.14 },
        { kind: 'noise', freq: 0, duration: 0.1, gain: 0.07 },
      ]);
      return;
    case 'witch-skeleton-awaken':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: 80, endFreq: 160, duration: 0.12, gain: 0.12 },
        { kind: 'triangle', freq: 220, duration: 0.08, gain: 0.08, delay: 0.04 },
      ]);
      return;
    case 'witch-hex-cast':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 240, endFreq: 480, duration: 0.14, gain: 0.14 },
        { kind: 'triangle', freq: 720, endFreq: 360, duration: 0.16, gain: 0.1, delay: 0.04 },
      ]);
      return;
    case 'witch-hex-buff':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 520, duration: 0.08, gain: 0.11 },
        { kind: 'sine', freq: 780, duration: 0.1, gain: 0.09, delay: 0.05 },
      ]);
      return;
    case 'witch-ult-cast':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 70, duration: 0.2, gain: 0.18 },
        { kind: 'sawtooth', freq: 110, endFreq: 50, duration: 0.22, gain: 0.1 },
        { kind: 'triangle', freq: 330, duration: 0.14, gain: 0.1, delay: 0.06 },
      ]);
      return;
    case 'witch-ult-aura':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 160, duration: 0.18, gain: 0.12 },
        { kind: 'triangle', freq: 90, duration: 0.2, gain: 0.1 },
      ]);
      return;
    case 'witch-ult-hex':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 180, endFreq: 90, duration: 0.12, gain: 0.11 },
        { kind: 'sine', freq: 420, duration: 0.08, gain: 0.07 },
      ]);
      return;
    case 'shadow-light':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: v(140, 18), endFreq: 70, duration: 0.08, gain: 0.12 },
        { kind: 'triangle', freq: v(420, 30), endFreq: 180, duration: 0.07, gain: 0.08 },
      ]);
      return;
    case 'shadow-claw-mark':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 90, endFreq: 50, duration: 0.1, gain: 0.12 },
        { kind: 'sine', freq: 180, duration: 0.08, gain: 0.06 },
      ]);
      return;
    case 'shadow-claw-charge':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 70, endFreq: 140, duration: 0.18, gain: 0.16 },
        { kind: 'sawtooth', freq: 160, endFreq: 90, duration: 0.16, gain: 0.1 },
      ]);
      return;
    case 'shadow-claw-whoosh':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: v(220, 20), endFreq: 60, duration: 0.14, gain: 0.16 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.07 },
      ]);
      return;
    case 'shadow-claw-impact':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 80, duration: 0.12, gain: 0.18 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.1 },
        { kind: 'sine', freq: 50, duration: 0.14, gain: 0.12 },
      ]);
      return;
    case 'shadow-dash-whoosh':
      playRecipe(ctx, dest, [
        { kind: 'sawtooth', freq: v(280, 30), endFreq: 90, duration: 0.12, gain: 0.14 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.06 },
      ]);
      return;
    case 'shadow-dash-impact':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 120, endFreq: 60, duration: 0.1, gain: 0.16 },
        { kind: 'noise', freq: 0, duration: 0.06, gain: 0.08 },
      ]);
      return;
    case 'shadow-rage-cast':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 55, endFreq: 90, duration: 0.28, gain: 0.18 },
        { kind: 'sawtooth', freq: 90, endFreq: 40, duration: 0.24, gain: 0.1 },
      ]);
      return;
    case 'shadow-rage-loop':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: v(70, 8), duration: 0.22, gain: 0.08 },
        { kind: 'sawtooth', freq: v(110, 12), duration: 0.18, gain: 0.05 },
      ]);
      return;
    case 'shadow-rage-active':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 50, duration: 0.16, gain: 0.2 },
        { kind: 'sawtooth', freq: 140, endFreq: 70, duration: 0.14, gain: 0.12 },
        { kind: 'noise', freq: 0, duration: 0.1, gain: 0.08 },
      ]);
      return;

    case 'combat-hit':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: v(180, 20), duration: 0.07, gain: 0.15 },
        { kind: 'noise', freq: 0, duration: 0.05, gain: 0.07 },
      ]);
      return;
    case 'combat-hit-heavy':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 90, duration: 0.12, gain: 0.2 },
        { kind: 'noise', freq: 0, duration: 0.08, gain: 0.11 },
      ]);
      return;
    case 'combat-block':
      playRecipe(ctx, dest, [{ kind: 'square', freq: 320, duration: 0.05, gain: 0.09 }]);
      return;
    case 'combat-clash':
      playRecipe(ctx, dest, [
        { kind: 'square', freq: 280, duration: 0.06, gain: 0.1 },
        { kind: 'noise', freq: 0, duration: 0.04, gain: 0.055 },
      ]);
      return;
    case 'combat-ability-hit':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: v(150, 18), duration: 0.09, gain: 0.15 },
        { kind: 'noise', freq: 0, duration: 0.06, gain: 0.07 },
      ]);
      return;
    case 'combat-knockback':
      playRecipe(ctx, dest, [
        { kind: 'sine', freq: 70, duration: 0.1, gain: 0.14 },
        { kind: 'noise', freq: 0, duration: 0.07, gain: 0.07 },
      ]);
      return;
    case 'hero-death':
      playRecipe(ctx, dest, [
        { kind: 'triangle', freq: 140, endFreq: 50, duration: 0.22, gain: 0.18 },
        { kind: 'noise', freq: 0, duration: 0.1, gain: 0.07 },
      ]);
      return;
    case 'minion-attack':
      playRecipe(ctx, dest, [{ kind: 'triangle', freq: v(300, 24), duration: 0.05, gain: 0.09 }]);
      return;
    case 'minion-hit':
      playRecipe(ctx, dest, [{ kind: 'triangle', freq: v(240, 20), duration: 0.05, gain: 0.09 }]);
      return;
    case 'minion-death':
      playRecipe(ctx, dest, [{ kind: 'sine', freq: 160, endFreq: 70, duration: 0.12, gain: 0.11 }]);
      return;
  }
}
