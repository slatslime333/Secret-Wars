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

/**
 * Random walkable point that is not in either spawn and still contestable.
 * Environmental keepout and approach tests keep objectives off props.
 */
export const pickObjectiveLocation = (query: MapQuery, clearRadius: number, rng: () => number): Point => {
  const areas = query.openAreas();
  let best: Point | undefined;
  let bestScore = -1;
  const tries = 64;
  for (let i = 0; i < tries; i += 1) {
    let x: number;
    let y: number;
    if (areas.length > 0) {
      const area = areas[Math.floor(rng() * areas.length)];
      const pad = Math.min(48, Math.max(12, Math.min(area.w, area.h) * 0.22));
      x = area.x + pad + rng() * Math.max(8, area.w - pad * 2);
      y = area.y + pad + rng() * Math.max(8, area.h - pad * 2);
    } else {
      x = query.layout.playable.x + 80 + rng() * Math.max(40, query.layout.playable.w - 160);
      y = query.layout.playable.y + 80 + rng() * Math.max(40, query.layout.playable.h - 160);
    }
    if (query.inSpawnExclusion(x, y, SPAWN_PAD - MAP.spawnHeroRadius)) {
      continue;
    }
    if (!query.clearForObjective(x, y, clearRadius)) {
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
    if (query.clearForObjective(point.x, point.y, clearRadius)) {
      return point;
    }
  }
  return { x: MID_X, y: ARENA.height / 2 };
};

export const pickCenterObjectiveLocation = (query: MapQuery, clearRadius: number): Point => {
  const x = MID_X;
  const y = ARENA.height / 2;
  if (query.clearForObjective(x, y, clearRadius)) {
    return { x, y };
  }
  return pickObjectiveLocation(query, clearRadius, () => 0.5);
};

type ClusterHero = { alive: boolean; team: 'alpha' | 'bravo'; body: { x: number; y: number } };

/** Prefer the live fight, not a random empty patch of map. */
export const pickFightCluster = (heroes: readonly ClusterHero[], rng: () => number): Point => {
  const live = heroes.filter((hero) => hero.alive);
  if (live.length === 0) {
    return { x: MID_X, y: ARENA.height / 2 };
  }
  const engaged = live.filter((hero) =>
    live.some(
      (other) => other.team !== hero.team && Math.hypot(other.body.x - hero.body.x, other.body.y - hero.body.y) < 340,
    ),
  );
  const pool = engaged.length > 0 ? engaged : live;
  const seed = pool[Math.floor(rng() * pool.length)] ?? live[0];
  if (!seed) {
    return { x: MID_X, y: ARENA.height / 2 };
  }
  let nearest: ClusterHero | undefined;
  let nearestD = 9999;
  for (const other of live) {
    if (other.team === seed.team) {
      continue;
    }
    const d = Math.hypot(other.body.x - seed.body.x, other.body.y - seed.body.y);
    if (d < nearestD) {
      nearest = other;
      nearestD = d;
    }
  }
  if (!nearest) {
    return { x: seed.body.x, y: seed.body.y };
  }
  return {
    x: (seed.body.x + nearest.body.x) * 0.5 + (rng() - 0.5) * 48,
    y: (seed.body.y + nearest.body.y) * 0.5 + (rng() - 0.5) * 48,
  };
};
