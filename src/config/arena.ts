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
 * Slightly longer left-to-right battlefield (2200x1500). Height stays
 * the same so north / center / south still read as distinct bands.
 */
const WIDTH = 2200;
const HEIGHT = 1500;

export const laneFacing = (team: TeamId): number => (team === 'alpha' ? 1 : -1);

export const ARENA_LANE_Y = {
  top: 300,
  mid: 750,
  bottom: 1200,
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
  laneY: ARENA_LANE_Y,
  teamSpawnX: ARENA_TEAM_SPAWN_X,
  minionSpawnX: ARENA_MINION_SPAWN_X,
  teamSpawns: TEAM_SPAWNS,
  minionSpawns: MINION_SPAWNS,
  laneSpawns: TEAM_LANE_SPAWNS,
  playerSpawn: TEAM_SPAWNS.alpha,
  enemySpawn: TEAM_SPAWNS.bravo,
} as const;
