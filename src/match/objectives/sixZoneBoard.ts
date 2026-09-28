import type { TeamId } from '../../config/hero';

/** Live 6v6 capture zones for tactical scoring. Not the rotating event board. */
export type SixZoneFact = {
  id: 'A' | 'B';
  x: number;
  y: number;
  radius: number;
  phase: 'active' | 'cooldown';
  owner: TeamId | null;
  secured: TeamId | null;
  progress: number;
  contested: boolean;
  leftMs: number;
};

let facts: SixZoneFact[] = [];

export const setSixZoneFacts = (next: readonly SixZoneFact[]): void => {
  facts = next.map((zone) => ({ ...zone }));
};

export const sixZoneFacts = (): readonly SixZoneFact[] => facts;

export const clearSixZoneFacts = (): void => {
  facts = [];
};
