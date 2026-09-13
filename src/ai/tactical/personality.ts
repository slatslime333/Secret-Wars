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

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const personalityFromSeed = (seed: string): Personality => {
  const aggression = mix(0.32, 0.82, hash01(seed, 1));
  const caution = mix(0.24, 0.8, hash01(seed, 2));
  const teamwork = mix(0.34, 0.86, hash01(seed, 3));
  const patience = mix(0.28, 0.82, hash01(seed, 9));
  const independence = mix(0.22, 0.8, hash01(seed, 10));
  return {
    aggression,
    caution,
    assistTendency: teamwork,
    retreatHp: mix(0.12, 0.3, hash01(seed, 4)),
    persistence: mix(0.32, 0.86, hash01(seed, 5)),
    flankTendency: mix(0.22, 0.8, hash01(seed, 6)),
    bravery: mix(0.3, 0.82, hash01(seed, 7)),
    thinkJitterMs: Math.round(mix(40, 190, hash01(seed, 8))),
    patience,
    teamwork,
    independence,
    riskTolerance: mix(0.22, 0.8, hash01(seed, 11)),
    preferredDistance: mix(0.2, 0.84, hash01(seed, 12)),
    retreatWillingness: mix(0.22, 0.78, hash01(seed, 13)),
    abilityConservation: mix(0.28, 0.84, hash01(seed, 14)),
    targetFixation: mix(0.28, 0.78, hash01(seed, 15)),
    protectionInstinct: mix(0.3, 0.86, hash01(seed, 16)),
    opportunism: mix(0.28, 0.82, hash01(seed, 17)),
    reactionQuality: mix(0.28, 0.82, hash01(seed, 18)),
  };
};

export const withNeutralFallback = (value?: Personality): Personality => value ?? NEUTRAL_PERSONALITY;
