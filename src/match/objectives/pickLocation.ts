import { ARENA } from '../../config/arena';
import { MAP } from '../../map/config';
import type { MapQuery } from '../../map/query';
import type { Point } from '../../map/types';

const SPAWN_PAD = MAP.spawnHeroRadius + 72;
const MID_X = ARENA.width / 2;

const scoreContest = (x: number, y: number): number => {
  const dx = Math.abs(x - MID_X) / (ARENA.width * 0.5);
  const edge = Math.min(y, ARENA.height - y) / (ARENA.height * 0.5);
  const midBias = 1 - Math.min(1, dx * 1.15);
  const vertical = Math.min(1, edge * 1.4);
  return midBias * 0.7 + vertical * 0.3;
};

const valid = (query: MapQuery, x: number, y: number, clearRadius: number): boolean => {
  if (query.inSpawnExclusion(x, y, SPAWN_PAD - MAP.spawnHeroRadius)) {
    return false;
  }
  if (query.blocksMovement(x, y, Math.max(18, clearRadius))) {
    return false;
  }
  return true;
};

/**
 * Random walkable point that is not in either spawn and still contestable.
 * Falls back to open-area centers if rejection sampling fails.
 */
export const pickObjectiveLocation = (query: MapQuery, clearRadius: number, rng: () => number): Point => {
  const areas = query.openAreas();
  let best: Point | undefined;
  let bestScore = -1;
  const tries = 48;
  for (let i = 0; i < tries; i += 1) {
    let x: number;
    let y: number;
    if (areas.length > 0) {
      const area = areas[Math.floor(rng() * areas.length)];
      const pad = Math.min(36, Math.max(8, Math.min(area.w, area.h) * 0.2));
      x = area.x + pad + rng() * Math.max(8, area.w - pad * 2);
      y = area.y + pad + rng() * Math.max(8, area.h - pad * 2);
    } else {
      x = query.layout.playable.x + 80 + rng() * Math.max(40, query.layout.playable.w - 160);
      y = query.layout.playable.y + 80 + rng() * Math.max(40, query.layout.playable.h - 160);
    }
    if (!valid(query, x, y, clearRadius)) {
      continue;
    }
    const jitter = rng() * 0.22;
    const score = scoreContest(x, y) + jitter;
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
    if (score > 0.72 && rng() > 0.35) {
      return { x, y };
    }
  }
  if (best) {
    return best;
  }
  for (const point of query.objectiveCandidates()) {
    if (valid(query, point.x, point.y, clearRadius)) {
      return point;
    }
  }
  return { x: MID_X, y: ARENA.height / 2 };
};
