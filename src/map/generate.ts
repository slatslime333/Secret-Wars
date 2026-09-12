import { ARENA, LANES } from '../config/arena';
import type { TeamId } from '../config/hero';
import { APPROACH_KINDS, CENTER_KINDS, SPAWN_KINDS, templateOf, type ChunkTemplate } from './chunks';
import { MAP, chunkSize, mapPlayable } from './config';
import { buildFallbackLayout } from './fallback';
import { inflate, rectsOverlap } from './geometry';
import { SeededRNG } from './seed';
import type {
  ChunkKind,
  GenerateOptions,
  GenerateResult,
  MapChunkInstance,
  MapDecoration,
  MapLayout,
  MapObstacle,
  MapRegionId,
  MapRoute,
  Rect,
  SpawnZone,
} from './types';
import { acceptLayout, largestOpenRects, scoreLayout, validateLayout } from './validate';

const logLine = (message: string): void => {
  console.info(`${MAP.logPrefix} ${message}`);
};

const regionRects = (playable: Rect): Record<MapRegionId, Rect> => {
  const h = playable.h / 3;
  return {
    north: { x: playable.x, y: playable.y, w: playable.w, h },
    center: { x: playable.x, y: playable.y + h, w: playable.w, h },
    south: { x: playable.x, y: playable.y + h * 2, w: playable.w, h },
  };
};

const chunkRect = (col: number, row: number, playable: Rect, size: { w: number; h: number }): Rect => ({
  x: playable.x + col * size.w,
  y: playable.y + row * size.h,
  w: size.w,
  h: size.h,
});

const spawnZones = (): SpawnZone[] => {
  const zones: SpawnZone[] = [];
  for (const team of ['alpha', 'bravo'] as TeamId[]) {
    for (const lane of LANES) {
      const hero = ARENA.laneSpawns[team][lane];
      zones.push({
        team,
        role: 'hero',
        lane,
        x: hero.x,
        y: hero.y,
        radius: MAP.spawnHeroRadius,
      });
      zones.push({
        team,
        role: 'minion',
        lane,
        x: ARENA.minionSpawnX[team],
        y: ARENA.laneY[lane],
        radius: MAP.spawnMinionRadius,
      });
    }
  }
  return zones;
};

const inExclusion = (x: number, y: number, w: number, h: number, zones: SpawnZone[]): boolean => {
  const rect = { x: x - w / 2, y: y - h / 2, w, h };
  return zones.some((zone) => {
    const nearestX = Math.max(rect.x, Math.min(zone.x, rect.x + rect.w));
    const nearestY = Math.max(rect.y, Math.min(zone.y, rect.y + rect.h));
    return Math.hypot(zone.x - nearestX, zone.y - nearestY) < zone.radius;
  });
};

const visualFor = (kind: MapObstacle['kind'], variant: string, cx: number, cy: number, w: number, h: number): Rect => {
  if (kind === 'tree') {
    const vw = variant === 'broad' ? 30 : variant === 'medium' ? 26 : 22;
    const vh = variant === 'broad' ? 28 : variant === 'medium' ? 32 : 28;
    return { x: cx - vw / 2, y: cy - vh + 8, w: vw, h: vh };
  }
  if (kind === 'crate' && variant === 'stack') {
    return { x: cx - 9, y: cy - 14, w: 18, h: 26 };
  }
  if (kind === 'crate' && variant === 'pair') {
    return { x: cx - 16, y: cy - 10, w: 32, h: 18 };
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};

const instantiate = (
  template: ChunkTemplate,
  rect: Rect,
  mirror: boolean,
  zones: SpawnZone[],
  existing: MapObstacle[],
  idBase: string,
): { obstacles: MapObstacle[]; decorations: MapDecoration[] } => {
  const obstacles: MapObstacle[] = [];
  const decorations: MapDecoration[] = [];
  let n = 0;
  for (const local of template.obstacles) {
    const nx = mirror ? 1 - local.nx : local.nx;
    const cx = rect.x + nx * rect.w;
    const cy = rect.y + local.ny * rect.h;
    if (inExclusion(cx, cy, local.w, local.h, zones)) {
      continue;
    }
    const collision = { x: cx - local.w / 2, y: cy - local.h / 2, w: local.w, h: local.h };
    if (existing.some((obs) => rectsOverlap(inflate(obs.collision, 8), inflate(collision, 8)))) {
      continue;
    }
    if (obstacles.some((obs) => rectsOverlap(inflate(obs.collision, 6), inflate(collision, 6)) && obs.kind !== 'crate')) {
      continue;
    }
    obstacles.push({
      id: `${idBase}-${n}`,
      kind: local.kind,
      variant: local.variant,
      x: cx,
      y: cy,
      collision,
      visual: visualFor(local.kind, local.variant, cx, cy, local.w, local.h),
      blocksMovement: true,
      blocksProjectiles: true,
      blocksLos: true,
      destructible: local.kind === 'crate',
    });
    n += 1;
  }
  for (const local of template.decorations) {
    const nx = mirror ? 1 - local.nx : local.nx;
    decorations.push({
      kind: local.kind,
      cluster: idBase,
      x: rect.x + nx * rect.w,
      y: rect.y + local.ny * rect.h,
      variant: local.variant,
    });
  }
  return { obstacles, decorations };
};

const pickKind = (rng: SeededRNG, pool: readonly ChunkKind[], avoidChoke: boolean): ChunkKind => {
  const filtered = avoidChoke ? pool.filter((kind) => !templateOf(kind).hasChoke) : pool;
  return rng.pick(filtered.length ? filtered : pool);
};

const buildRoutes = (playable: Rect): MapRoute[] => {
  const yMid = ARENA.laneY.mid;
  const yNorth = ARENA.laneY.top;
  const ySouth = ARENA.laneY.bottom;
  const left = playable.x + 80;
  const right = playable.x + playable.w - 80;
  const midX = playable.x + playable.w / 2;
  return [
    {
      id: 'direct',
      waypoints: [
        { x: left, y: yMid },
        { x: midX, y: yMid },
        { x: right, y: yMid },
      ],
    },
    {
      id: 'covered-north',
      waypoints: [
        { x: left, y: yNorth },
        { x: midX - 120, y: yNorth },
        { x: midX, y: yMid - 80 },
        { x: midX + 120, y: yNorth },
        { x: right, y: yNorth },
      ],
    },
    {
      id: 'covered-south',
      waypoints: [
        { x: left, y: ySouth },
        { x: midX - 120, y: ySouth },
        { x: midX, y: yMid + 80 },
        { x: midX + 120, y: ySouth },
        { x: right, y: ySouth },
      ],
    },
  ];
};

export const assemble = (seed: number, attempt: number): MapLayout => {
  const rng = new SeededRNG(seed);
  const playable = mapPlayable();
  const size = chunkSize();
  const zones = spawnZones();
  const chunks: MapChunkInstance[] = [];
  const obstacles: MapObstacle[] = [];
  const decorations: MapDecoration[] = [];
  let chokeCount = 0;

  for (let row = 0; row < MAP.grid.rows; row += 1) {
    const spawnKind = pickKind(rng, SPAWN_KINDS, true);
    const avoidChoke = chokeCount >= 2 || row === 1;
    const approachKind = pickKind(rng, APPROACH_KINDS, avoidChoke);
    if (templateOf(approachKind).hasChoke) {
      chokeCount += 1;
    }
    const centerPool = row === 1 ? (['OPEN_FIELD', 'WIDE_PATH', 'SCATTERED_COVER'] as const) : CENTER_KINDS;
    const centerKind = pickKind(rng, centerPool, true);

    const plan: Array<{ col: number; kind: ChunkKind; mirror: boolean }> = [
      { col: 0, kind: spawnKind, mirror: false },
      { col: 1, kind: approachKind, mirror: false },
      { col: 2, kind: centerKind, mirror: false },
      { col: 3, kind: approachKind, mirror: true },
      { col: 4, kind: spawnKind, mirror: true },
    ];

    for (const cell of plan) {
      const rect = chunkRect(cell.col, row, playable, size);
      chunks.push({ col: cell.col, row, kind: cell.kind, rect });
      const built = instantiate(templateOf(cell.kind), rect, cell.mirror, zones, obstacles, `${cell.col}-${row}`);
      obstacles.push(...built.obstacles);
      decorations.push(...built.decorations);
    }
  }

  const layout: MapLayout = {
    seed,
    attempt,
    usedFallback: false,
    quality: {
      total: 0,
      connectivity: 0,
      spawnSafety: 0,
      routeQuality: 0,
      obstacleDistribution: 0,
      openSpace: 0,
      cover: 0,
      regionalConnectivity: 0,
      readability: 0,
    },
    bounds: { x: 0, y: 0, w: ARENA.width, h: ARENA.height },
    playable,
    regions: regionRects(playable),
    chunks,
    obstacles,
    decorations,
    spawnZones: zones,
    routes: buildRoutes(playable),
    openAreas: [],
  };
  layout.openAreas = largestOpenRects(layout);
  layout.quality = scoreLayout(layout, validateLayout(layout));
  return layout;
};

export const generateBattlefield = (options: GenerateOptions = {}): GenerateResult => {
  const maxAttempts = options.maxAttempts ?? MAP.maxAttempts;
  const baseSeed = (options.seed ?? (Date.now() ^ 0x85ebca6b)) >>> 0 || 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const seed = (baseSeed + attempt - 1) >>> 0 || 1;
    const layout = assemble(seed, attempt);
    const issues = validateLayout(layout);
    layout.quality = scoreLayout(layout, issues);
    if (acceptLayout(layout, issues)) {
      if (options.log !== false) {
        logLine(`Generated map seed: ${seed}`);
        logLine(`Map quality: ${layout.quality.total}`);
        logLine(`Generation attempt: ${attempt}`);
      }
      return { layout, seed, attempt, usedFallback: false };
    }
  }

  const fallback = buildFallbackLayout(baseSeed, maxAttempts);
  if (options.log !== false) {
    logLine(`Generated map seed: ${fallback.seed} (fallback)`);
    logLine(`Map quality: ${fallback.quality.total}`);
    logLine(`Generation attempt: ${maxAttempts}`);
  }
  return { layout: fallback, seed: fallback.seed, attempt: maxAttempts, usedFallback: true };
};

export const generateFromSeed = (seed: number, log = true): GenerateResult =>
  generateBattlefield({ seed, log });
