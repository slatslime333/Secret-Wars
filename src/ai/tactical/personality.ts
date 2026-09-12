import type { Personality } from './types';
import { NEUTRAL_PERSONALITY } from './types';

/** Stable 0..1 from a seed string so a CPU keeps the same temperament. */
export const hash01 = (seed: string, salt = 0): number => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const personalityFromSeed = (seed: string): Personality => ({
  aggression: lerp(0.34, 0.78, hash01(seed, 1)),
  caution: lerp(0.28, 0.74, hash01(seed, 2)),
  assistTendency: lerp(0.38, 0.82, hash01(seed, 3)),
  retreatHp: lerp(0.12, 0.28, hash01(seed, 4)),
  persistence: lerp(0.36, 0.84, hash01(seed, 5)),
  flankTendency: lerp(0.24, 0.76, hash01(seed, 6)),
  bravery: lerp(0.32, 0.78, hash01(seed, 7)),
  thinkJitterMs: Math.round(lerp(30, 170, hash01(seed, 8))),
});

export const withNeutralFallback = (value?: Personality): Personality => value ?? NEUTRAL_PERSONALITY;
