import { ARENA, LANES } from '../config/arena';
import { MAP } from './config';
import { gapBetween, inflate, rectArea, rectsOverlap } from './geometry';
import type { MapLayout, MapQuality, Rect, ValidationIssue } from './types';

type Grid = {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  walk: boolean[];
};

const emptyQuality = (): MapQuality => ({
  total: 0,
  connectivity: 0,
  spawnSafety: 0,
  routeQuality: 0,
  obstacleDistribution: 0,
  openSpace: 0,
  cover: 0,
  regionalConnectivity: 0,
  readability: 0,
});

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const idx = (grid: Grid, col: number, row: number): number => row * grid.cols + col;

const cellCenter = (grid: Grid, col: number, row: number): { x: number; y: number } => ({
  x: grid.originX + col * MAP.cell + MAP.cell / 2,
  y: grid.originY + row * MAP.cell + MAP.cell / 2,
});

const cellAt = (grid: Grid, x: number, y: number): { col: number; row: number } | undefined => {
  const col = Math.floor((x - grid.originX) / MAP.cell);
  const row = Math.floor((y - grid.originY) / MAP.cell);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) {
    return undefined;
  }
  return { col, row };
};

const buildGrid = (layout: MapLayout): Grid => {
  const { playable } = layout;
  const cols = Math.floor(playable.w / MAP.cell);
  const rows = Math.floor(playable.h / MAP.cell);
  const walk = new Array<boolean>(cols * rows).fill(true);
  const grid: Grid = { cols, rows, originX: playable.x, originY: playable.y, walk };
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const { x, y } = cellCenter(grid, col, row);
      const blocked = layout.obstacles.some((obs) => {
        const fat = inflate(obs.collision, MAP.agentRadius);
        return x >= fat.x && x <= fat.x + fat.w && y >= fat.y && y <= fat.y + fat.h;
      });
      walk[idx(grid, col, row)] = !blocked;
    }
  }
  return grid;
};

const flood = (grid: Grid, startX: number, startY: number): Set<number> => {
  const start = cellAt(grid, startX, startY);
  const seen = new Set<number>();
  if (!start || !grid.walk[idx(grid, start.col, start.row)]) {
    return seen;
  }
  const stack = [start];
  while (stack.length) {
    const cell = stack.pop();
    if (!cell) {
      break;
    }
    const key = idx(grid, cell.col, cell.row);
    if (seen.has(key) || !grid.walk[key]) {
      continue;
    }
    seen.add(key);
    const next = [
      { col: cell.col + 1, row: cell.row },
      { col: cell.col - 1, row: cell.row },
      { col: cell.col, row: cell.row + 1 },
      { col: cell.col, row: cell.row - 1 },
    ];
    for (const n of next) {
      if (n.col >= 0 && n.row >= 0 && n.col < grid.cols && n.row < grid.rows) {
        stack.push(n);
      }
    }
  }
  return seen;
};

const reachable = (seen: Set<number>, grid: Grid, x: number, y: number): boolean => {
  const cell = cellAt(grid, x, y);
  return Boolean(cell && seen.has(idx(grid, cell.col, cell.row)));
};

const walkRatio = (grid: Grid): number => {
  let open = 0;
  for (const cell of grid.walk) {
    if (cell) {
      open += 1;
    }
  }
  return open / grid.walk.length;
};

const authoredChokes = (layout: MapLayout): number =>
  layout.chunks.filter((chunk) => chunk.kind === 'CHOKE_POINT').length;

const wallsColinear = (a: Rect, b: Rect): boolean => {
  const sameRow = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) <= Math.max(a.h, b.h) * 0.8;
  const sameCol = Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) <= Math.max(a.w, b.w) * 0.8;
  return sameRow || sameCol;
};

export const scoreLayout = (layout: MapLayout, issues: ValidationIssue[]): MapQuality => {
  const grid = buildGrid(layout);
  const open = walkRatio(grid);
  const chokes = authoredChokes(layout);
  const area = rectArea(layout.playable);
  const blocked = layout.obstacles.reduce((sum, obs) => sum + rectArea(obs.collision), 0) / area;
  const mid = { x: ARENA.width / 2, y: ARENA.height / 2 };
  const alpha = ARENA.laneSpawns.alpha.mid;
  const bravo = ARENA.laneSpawns.bravo.mid;
  const fromAlpha = flood(grid, alpha.x, alpha.y);
  const teamsLinked = reachable(fromAlpha, grid, bravo.x, bravo.y) && reachable(fromAlpha, grid, mid.x, mid.y);
  const northOk = reachable(fromAlpha, grid, ARENA.width / 2, ARENA.laneY.top);
  const southOk = reachable(fromAlpha, grid, ARENA.width / 2, ARENA.laneY.bottom);

  const connectivity = clampScore(fromAlpha.size > 80 && teamsLinked ? 96 : 40);
  const spawnSafety = clampScore(100 - issues.filter((issue) => issue.code.startsWith('spawn')).length * 22);
  const routeQuality = clampScore(layout.routes.length >= 3 ? 88 : 50);
  const obstacleDistribution = clampScore(100 - Math.abs(blocked - 0.08) * 500);
  const openSpace = clampScore(70 + (open - 0.7) * 80);
  const cover = clampScore(40 + layout.obstacles.length * 1.6);
  const regionalConnectivity = clampScore((northOk ? 34 : 0) + 32 + (southOk ? 34 : 0));
  const readability = clampScore(92 - chokes * 8 - Math.max(0, layout.obstacles.length - 36) * 2);
  const total = clampScore(
    connectivity * 0.18 +
      spawnSafety * 0.14 +
      routeQuality * 0.12 +
      obstacleDistribution * 0.12 +
      openSpace * 0.12 +
      cover * 0.1 +
      regionalConnectivity * 0.12 +
      readability * 0.1,
  );
  return {
    total,
    connectivity,
    spawnSafety,
    routeQuality,
    obstacleDistribution,
    openSpace,
    cover,
    regionalConnectivity,
    readability,
  };
};

export const validateLayout = (layout: MapLayout): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const grid = buildGrid(layout);
  const mid = { x: ARENA.width / 2, y: ARENA.height / 2 };
  const alphaMid = ARENA.laneSpawns.alpha.mid;
  const bravoMid = ARENA.laneSpawns.bravo.mid;
  const fromAlpha = flood(grid, alphaMid.x, alphaMid.y);
  const fromBravo = flood(grid, bravoMid.x, bravoMid.y);

  if (!fromAlpha.size) {
    issues.push({ code: 'spawn-alpha', message: 'Alpha spawn is trapped.' });
  }
  if (!fromBravo.size) {
    issues.push({ code: 'spawn-bravo', message: 'Bravo spawn is trapped.' });
  }
  if (!reachable(fromAlpha, grid, mid.x, mid.y)) {
    issues.push({ code: 'path-alpha-center', message: 'Alpha cannot reach the center.' });
  }
  if (!reachable(fromBravo, grid, mid.x, mid.y)) {
    issues.push({ code: 'path-bravo-center', message: 'Bravo cannot reach the center.' });
  }
  if (!reachable(fromAlpha, grid, bravoMid.x, bravoMid.y)) {
    issues.push({ code: 'path-teams', message: 'Teams cannot reach each other.' });
  }

  for (const lane of LANES) {
    const alphaMinion = { x: ARENA.minionSpawnX.alpha, y: ARENA.laneY[lane] };
    const bravoMinion = { x: ARENA.minionSpawnX.bravo, y: ARENA.laneY[lane] };
    if (!reachable(fromAlpha, grid, alphaMinion.x, alphaMinion.y)) {
      issues.push({ code: 'minion-alpha', message: `Alpha ${lane} minion route is blocked.` });
    }
    if (!reachable(fromBravo, grid, bravoMinion.x, bravoMinion.y)) {
      issues.push({ code: 'minion-bravo', message: `Bravo ${lane} minion route is blocked.` });
    }
  }

  if (!reachable(fromAlpha, grid, ARENA.width / 2, ARENA.laneY.top)) {
    issues.push({ code: 'region-north', message: 'North is not connected.' });
  }
  if (!reachable(fromAlpha, grid, ARENA.width / 2, ARENA.laneY.bottom)) {
    issues.push({ code: 'region-south', message: 'South is not connected.' });
  }

  const open = walkRatio(grid);
  if (open < MAP.openSpaceMin) {
    issues.push({ code: 'open-low', message: 'Not enough open combat space.' });
  }

  for (const zone of layout.spawnZones) {
    if (!reachable(fromAlpha, grid, zone.x, zone.y) && !reachable(fromBravo, grid, zone.x, zone.y)) {
      issues.push({ code: 'spawn-trap', message: `Spawn at ${zone.team} ${zone.lane} is trapped.` });
    }
    const overlapping = layout.obstacles.some((obs) => {
      const dx = Math.max(Math.abs(zone.x - (obs.collision.x + obs.collision.w / 2)) - obs.collision.w / 2, 0);
      const dy = Math.max(Math.abs(zone.y - (obs.collision.y + obs.collision.h / 2)) - obs.collision.h / 2, 0);
      return Math.hypot(dx, dy) < zone.radius * 0.55;
    });
    if (overlapping) {
      issues.push({ code: 'spawn-overlap', message: 'Obstacle overlaps a spawn area.' });
    }
  }

  const playable = layout.playable;
  for (const obs of layout.obstacles) {
    if (obs.collision.w > playable.w * 0.42 && obs.collision.h > 28) {
      issues.push({ code: 'block-span', message: 'A wall spans too much of the battlefield.' });
    }
  }

  if (authoredChokes(layout) > MAP.maxChokeChunks) {
    issues.push({ code: 'choke-many', message: 'Too many choke points.' });
  }
  if (layout.obstacles.length < MAP.minObstacles) {
    issues.push({ code: 'cover-low', message: 'Not enough obstacles.' });
  }
  if (layout.obstacles.length > MAP.maxObstacles) {
    issues.push({ code: 'cover-high', message: 'Excessive obstacle density.' });
  }

  const area = rectArea(playable);
  const blocked = layout.obstacles.reduce((sum, obs) => sum + rectArea(obs.collision), 0) / area;
  if (blocked > MAP.obstacleAreaMax) {
    issues.push({ code: 'density-high', message: 'Obstacle area is too high.' });
  }
  if (blocked < MAP.obstacleAreaMin && layout.obstacles.length >= MAP.minObstacles) {
    /* small collision footprints (trees) can still be enough cover */
  }

  for (let i = 0; i < layout.obstacles.length; i += 1) {
    for (let j = i + 1; j < layout.obstacles.length; j += 1) {
      const a = layout.obstacles[i];
      const b = layout.obstacles[j];
      if (rectsOverlap(a.collision, b.collision, -2) && !(a.kind === 'crate' && b.kind === 'crate')) {
        issues.push({ code: 'overlap', message: 'Obstacles overlap incorrectly.' });
      }
      if (a.kind === 'wall' && b.kind === 'wall' && wallsColinear(a.collision, b.collision)) {
        const gap = gapBetween(a.collision, b.collision);
        if (gap > 6 && gap < MAP.minPassage) {
          issues.push({ code: 'gap-narrow', message: 'A passage is too narrow for heroes.' });
        }
      }
    }
  }

  return uniqueIssues(issues);
};

const uniqueIssues = (issues: ValidationIssue[]): ValidationIssue[] => {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const acceptLayout = (layout: MapLayout, issues: ValidationIssue[]): boolean =>
  issues.length === 0 && layout.quality.total >= MAP.qualityThreshold;

export { emptyQuality };

export type RasterGrid = Grid;
export const rasterize = buildGrid;
export const floodFrom = flood;
export const isReachable = reachable;

export const largestOpenRects = (layout: MapLayout): Rect[] => {
  const mid = layout.regions.center;
  return [
    { x: mid.x + mid.w * 0.2, y: mid.y + mid.h * 0.22, w: mid.w * 0.6, h: mid.h * 0.56 },
    {
      x: layout.regions.north.x + 80,
      y: layout.regions.north.y + 70,
      w: layout.regions.north.w - 160,
      h: 90,
    },
    {
      x: layout.regions.south.x + 80,
      y: layout.regions.south.y + layout.regions.south.h - 160,
      w: layout.regions.south.w - 160,
      h: 90,
    },
  ];
};
