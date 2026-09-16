import type { TeamId } from './hero';

export type LaneId = 'top' | 'mid' | 'bottom';
export type MatchFormat = '3v3' | '6v6';

export const LANES: readonly LaneId[] = ['top', 'mid', 'bottom'];

export type SpawnPad = {
  x: number;
  y: number;
  facingX: number;
  lane: LaneId;
};

/**
 * Compact 3v3 field, ~17.5% larger than the previous 2200×1280 map.
 * 6v6 scales this by 65% so twelve fighters still have room to move.
 */
const BASE_WIDTH = 2584;
const BASE_HEIGHT = 1504;
const BASE_LANE_Y = { top: 294, mid: 752, bottom: 1210 };
const BASE_TEAM_SPAWN_X = { alpha: 258, bravo: 2326 };
const BASE_MINION_SPAWN_X = { alpha: 470, bravo: 2114 };
const SCALE_6V6 = 1.65;
/** Stay this far inside the walls when pushing a lane with nobody to fight. */
const EDGE_INSET = 180;

let currentFormat: MatchFormat = '3v3';

export const matchFormatOf = (): MatchFormat => currentFormat;

export const laneFacing = (team: TeamId): number => (team === 'alpha' ? 1 : -1);

export const ARENA_LANE_Y = { ...BASE_LANE_Y };
export const ARENA_TEAM_SPAWN_X = { ...BASE_TEAM_SPAWN_X };
export const ARENA_MINION_SPAWN_X = { ...BASE_MINION_SPAWN_X };

export const laneSpawn = (team: TeamId, lane: LaneId, slot = 0): SpawnPad => {
  const facingX = laneFacing(team);
  const paired = currentFormat === '6v6';
  const yOff = paired ? (slot === 0 ? -36 : 36) : 0;
  const xOff = paired ? slot * 28 * facingX : 0;
  return {
    x: ARENA_TEAM_SPAWN_X[team] + xOff,
    y: ARENA_LANE_Y[lane] + yOff,
    facingX,
    lane,
  };
};

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
    const dist = Math.abs(y - ARENA.laneY[lane]);
    if (dist < bestDist) {
      best = lane;
      bestDist = dist;
    }
  }
  return best;
};

/** Extra wall fill so a follow-cam past the arena still looks like stone, not void. */
export const CAMERA_BLEED = 1200;
export const ARENA_WALL_COLOR = 0x1a211e;

export const ARENA = {
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  wallThickness: 40,
  spawnRadius: 40,
  edgeInset: EDGE_INSET,
  cameraBleed: CAMERA_BLEED,
  wallColor: ARENA_WALL_COLOR,
  laneY: ARENA_LANE_Y,
  teamSpawnX: ARENA_TEAM_SPAWN_X,
  minionSpawnX: ARENA_MINION_SPAWN_X,
  teamSpawns: TEAM_SPAWNS,
  minionSpawns: MINION_SPAWNS,
  laneSpawns: TEAM_LANE_SPAWNS,
  playerSpawn: TEAM_SPAWNS.alpha,
  enemySpawn: TEAM_SPAWNS.bravo,
};

export const applyMatchFormat = (format: MatchFormat): void => {
  currentFormat = format;
  const s = format === '6v6' ? SCALE_6V6 : 1;
  ARENA.width = Math.round(BASE_WIDTH * s);
  ARENA.height = Math.round(BASE_HEIGHT * s);
  ARENA.laneY.top = Math.round(BASE_LANE_Y.top * s);
  ARENA.laneY.mid = Math.round(BASE_LANE_Y.mid * s);
  ARENA.laneY.bottom = Math.round(BASE_LANE_Y.bottom * s);
  ARENA.teamSpawnX.alpha = Math.round(BASE_TEAM_SPAWN_X.alpha * s);
  ARENA.teamSpawnX.bravo = Math.round(ARENA.width - (BASE_WIDTH - BASE_TEAM_SPAWN_X.bravo) * s);
  ARENA.minionSpawnX.alpha = Math.round(BASE_MINION_SPAWN_X.alpha * s);
  ARENA.minionSpawnX.bravo = Math.round(ARENA.width - (BASE_WIDTH - BASE_MINION_SPAWN_X.bravo) * s);
  TEAM_LANE_SPAWNS.alpha.top = laneSpawn('alpha', 'top');
  TEAM_LANE_SPAWNS.alpha.mid = laneSpawn('alpha', 'mid');
  TEAM_LANE_SPAWNS.alpha.bottom = laneSpawn('alpha', 'bottom');
  TEAM_LANE_SPAWNS.bravo.top = laneSpawn('bravo', 'top');
  TEAM_LANE_SPAWNS.bravo.mid = laneSpawn('bravo', 'mid');
  TEAM_LANE_SPAWNS.bravo.bottom = laneSpawn('bravo', 'bottom');
  TEAM_SPAWNS.alpha = TEAM_LANE_SPAWNS.alpha.mid;
  TEAM_SPAWNS.bravo = TEAM_LANE_SPAWNS.bravo.mid;
  MINION_SPAWNS.alpha = minionLanePad('alpha', 'mid');
  MINION_SPAWNS.bravo = minionLanePad('bravo', 'mid');
  ARENA.playerSpawn = TEAM_SPAWNS.alpha;
  ARENA.enemySpawn = TEAM_SPAWNS.bravo;
};

/** Playable AABB inset by the wall strip and a body radius. */
export const arenaInnerBounds = (bodyRadius: number): { minX: number; minY: number; maxX: number; maxY: number } => {
  const wall = ARENA.wallThickness;
  return {
    minX: wall + bodyRadius,
    minY: wall + bodyRadius,
    maxX: ARENA.width - wall - bodyRadius,
    maxY: ARENA.height - wall - bodyRadius,
  };
};

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
