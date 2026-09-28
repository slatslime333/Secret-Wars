import { ARENA, matchFormatOf } from '../config/arena';

export const MAP = {
  maxAttempts: 50,
  qualityThreshold: 64,
  grid: {
    cols: 5,
    rows: 3,
  },
  /** Inflate obstacles by this much when testing walkability. Death is 16. */
  agentRadius: 18,
  minPassage: 60,
  spawnHeroRadius: 150,
  spawnMinionRadius: 92,
  openSpaceMin: 0.52,
  obstacleAreaMin: 0.01,
  obstacleAreaMax: 0.18,
  minObstacles: 8,
  maxObstacles: 136,
  maxChokeChunks: 2,
  cell: 28,
  logPrefix: '[map]',
} as const;

export const mapPlayable = () => ({
  x: ARENA.wallThickness,
  y: ARENA.wallThickness,
  w: ARENA.width - ARENA.wallThickness * 2,
  h: ARENA.height - ARENA.wallThickness * 2,
});

export const chunkSize = () => {
  const playable = mapPlayable();
  return {
    w: playable.w / MAP.grid.cols,
    h: playable.h / MAP.grid.rows,
  };
};

/** 6v6 covers more ground, so the prop cap follows area instead of width alone. */
export const maxObstaclesOf = (): number => {
  const widthMul = ARENA.width / 2584;
  const mul = matchFormatOf() === '6v6' ? widthMul * (ARENA.height / 1504) : widthMul;
  return Math.round(MAP.maxObstacles * mul);
};
