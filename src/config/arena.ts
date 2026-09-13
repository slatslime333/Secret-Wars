import type { TeamId } from './hero';

export type LaneId = 'top' | 'mid' | 'bottom';

export const LANES: readonly LaneId[] = ['top', 'mid', 'bottom'];

export type SpawnPad = {
  x: number;
  y: number;
  facingX: number;
  lane: LaneId;
};

/**
 * Wide battlefield (2200×1280). Height is a bit shorter so lanes stay
 * distinct without as much empty vertical space.
 */
const WIDTH = 2200;
const HEIGHT = 1280;
/** Stay this far inside the walls when pushing a lane with nobody to fight. */
const EDGE_INSET = 180;

export const laneFacing = (team: TeamId): number => (team === 'alpha' ? 1 : -1);

export const ARENA_LANE_Y = {
  top: 250,
  mid: 640,
  bottom: 1030,
} as const;

export const ARENA_TEAM_SPAWN_X = {
  alpha: 220,
  bravo: 1980,
} as const;

export const ARENA_MINION_SPAWN_X = {
  alpha: 400,
  bravo: 1800,
} as const;

export const laneSpawn = (team: TeamId, lane: LaneId): SpawnPad => ({
  x: ARENA_TEAM_SPAWN_X[team],
  y: ARENA_LANE_Y[lane],
  facingX: laneFacing(team),
  lane,
});

export const minionLanePad = (team: TeamId, lane: LaneId): SpawnPad => ({
  x: ARENA_MINION_SPAWN_X[team],
  y: ARENA_LANE_Y[lane],
  facingX: laneFacing(team),
  lane,
});

export const TEAM_LANE_SPAWNS: Record<TeamId, Record<LaneId, SpawnPad>> = {
  alpha: {
    top: laneSpawn('alpha', 'top'),
    mid: laneSpawn('alpha', 'mid'),
    bottom: laneSpawn('alpha', 'bottom'),
  },
  bravo: {
    top: laneSpawn('bravo', 'top'),
    mid: laneSpawn('bravo', 'mid'),
    bottom: laneSpawn('bravo', 'bottom'),
  },
};

/** Play Test 1v1 still uses the middle pads. */
export const TEAM_SPAWNS: Record<TeamId, SpawnPad> = {
  alpha: TEAM_LANE_SPAWNS.alpha.mid,
  bravo: TEAM_LANE_SPAWNS.bravo.mid,
};

export const MINION_SPAWNS: Record<TeamId, SpawnPad> = {
  alpha: minionLanePad('alpha', 'mid'),
  bravo: minionLanePad('bravo', 'mid'),
};

export const nearestLane = (y: number): LaneId => {
  let best: LaneId = 'mid';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const lane of LANES) {
    const dist = Math.abs(y - ARENA_LANE_Y[lane]);
    if (dist < bestDist) {
      best = lane;
      bestDist = dist;
    }
  }
  return best;
};

export const ARENA = {
  width: WIDTH,
  height: HEIGHT,
  wallThickness: 40,
  spawnRadius: 40,
  edgeInset: EDGE_INSET,
  laneY: ARENA_LANE_Y,
  teamSpawnX: ARENA_TEAM_SPAWN_X,
  minionSpawnX: ARENA_MINION_SPAWN_X,
  teamSpawns: TEAM_SPAWNS,
  minionSpawns: MINION_SPAWNS,
  laneSpawns: TEAM_LANE_SPAWNS,
  playerSpawn: TEAM_SPAWNS.alpha,
  enemySpawn: TEAM_SPAWNS.bravo,
} as const;

/** Furthest X a unit should walk toward when the lane is empty. */
export const pushLimitX = (team: TeamId): number =>
  team === 'alpha' ? ARENA.width - ARENA.wallThickness - EDGE_INSET : ARENA.wallThickness + EDGE_INSET;

/** True when this body is already at the far edge of its push. */
export const atFarEdge = (team: TeamId, x: number, slack = 56): boolean => {
  const limit = pushLimitX(team);
  return team === 'alpha' ? x >= limit - slack : x <= limit + slack;
};

/** Mid-field point on another lane — hunt / farm instead of walking into the wall. */
export const roamHuntPoint = (team: TeamId, y: number, salt = 0): { x: number; y: number } => {
  const current = nearestLane(y);
  const idx = LANES.indexOf(current);
  const next = LANES[(idx + 1 + (salt & 1)) % LANES.length];
  const midShift = team === 'alpha' ? 140 : -140;
  return { x: ARENA.width / 2 + midShift, y: ARENA.laneY[next] };
};
