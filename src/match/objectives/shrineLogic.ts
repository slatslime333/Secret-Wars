import type { TeamId } from '../../config/hero';

export type ShrineControl = {
  owner: TeamId | null;
  contested: boolean;
};

export const shrineControlOf = (alpha: number, bravo: number): ShrineControl => {
  if (alpha > 0 && bravo > 0) {
    return { owner: null, contested: true };
  }
  if (alpha > 0) {
    return { owner: 'alpha', contested: false };
  }
  if (bravo > 0) {
    return { owner: 'bravo', contested: false };
  }
  return { owner: null, contested: false };
};
