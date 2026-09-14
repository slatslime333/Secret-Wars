import { ARENA } from '../config/arena';
import { SeededRNG } from './seed';
import type { MapDecoration, MapObstacle } from './types';

const MARGIN = 64;
const KINDS: readonly MapDecoration['kind'][] = [
  'dirt',
  'debris',
  'debris',
  'burn',
  'grassCrack',
  'tuft',
  'rock',
  'curbBit',
];

/** Non-blocking stains and debris so midfield grass does not look empty. */
export const scatterFieldDetails = (rng: SeededRNG, obstacles: readonly MapObstacle[]): MapDecoration[] => {
  const out: MapDecoration[] = [];
  for (let i = 0; i < 72; i += 1) {
    const x = rng.float(MARGIN, ARENA.width - MARGIN);
    const y = rng.float(MARGIN, ARENA.height - MARGIN);
    const onObjectivePocket =
      Math.abs(x - ARENA.width / 2) < 150 && Math.abs(y - ARENA.height / 2) < 80;
    if (onObjectivePocket && rng.chance(0.7)) {
      continue;
    }
    if (obstacles.some((obs) => Math.hypot(obs.x - x, obs.y - y) < 40)) {
      continue;
    }
    out.push({
      kind: KINDS[i % KINDS.length],
      cluster: `scatter-${i}`,
      x,
      y,
      variant: rng.int(0, 2),
    });
  }
  return out;
};
