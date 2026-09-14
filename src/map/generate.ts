import { ARENA } from '../config/arena';
import { CRATE } from '../config/crate';
import { APPROACH_KINDS, CENTER_KINDS, SPAWN_KINDS, templateOf, type ChunkTemplate } from './chunks';
import {
  COVER_CLUSTERS,
  EDGE_CLUSTERS,
  plantCratesBeside,
  stampCluster,
  templateById,
  type ClusterId,
} from './clusters';
import { MAP, chunkSize, mapPlayable } from './config';
import { buildFallbackLayout } from './fallback';
import { inflate, rectsOverlap } from './geometry';
import { generateRoads } from './roads';
import { buildReservedZones, reservedBlocks, spawnZonesOf } from './reserved';
import { visualForProp } from './scale';
import { scatterFieldDetails } from './scatter';
import { SeededRNG } from './seed';
import type {
  ChunkKind,
  EnvHierarchy,
  GenerateOptions,
  GenerateResult,
  MapChunkInstance,
  MapDecoration,
  MapLayout,
  MapObstacle,
  MapRegionId,
  MapRoute,
  Rect,
  ReservedZone,
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

const hierarchyOf = (kind: MapObstacle['kind']): EnvHierarchy => {
  if (kind === 'building' || kind === 'vehicle') {
    return 'landmark';
  }
  if (kind === 'crate' || kind === 'barricade' || kind === 'sandbag' || kind === 'fence' || kind === 'wall' || kind === 'rubble' || kind === 'tree') {
    return 'cover';
  }
  return 'detail';
};

const keepoutOf = (kind: MapObstacle['kind'], collision: Rect, visual: Rect): Rect => {
  if (kind === 'building' || kind === 'vehicle') {
    return inflate(visual, 8);
  }
  return inflate(collision, 6);
};

const instantiate = (
  template: ChunkTemplate,
  rect: Rect,
  mirror: boolean,
  reserved: ReservedZone[],
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
    const collision = {
      x: cx - local.spec.w / 2,
      y: cy - local.spec.h / 2,
      w: local.spec.w,
      h: local.spec.h,
    };
    if (reservedBlocks(collision, reserved, 2)) {
      continue;
    }
    if (existing.some((obs) => obs.blocksMovement && rectsOverlap(inflate(obs.collision, 8), inflate(collision, 8)))) {
      continue;
    }
    if (obstacles.some((obs) => rectsOverlap(inflate(obs.collision, 6), inflate(collision, 6)) && obs.kind !== 'crate')) {
      continue;
    }
    const visual = visualForProp(local.spec, cx, cy);
    obstacles.push({
      id: `${idBase}-${n}`,
      kind: local.kind,
      variant: local.variant,
      x: cx,
      y: cy,
      collision,
      visual,
      keepout: keepoutOf(local.kind, collision, visual),
      blocksMovement: true,
      blocksProjectiles: local.kind !== 'fence',
      blocksLos: local.kind === 'building' || local.kind === 'vehicle' || local.kind === 'wall',
      destructible: local.kind === 'crate',
      hierarchy: hierarchyOf(local.kind),
      hp: local.kind === 'crate' ? CRATE.maxHealth : undefined,
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

const clusterPoolFor = (row: number, col: number): readonly ClusterId[] => {
  if (row === 1) {
    return COVER_CLUSTERS;
  }
  if (col === 2) {
    return COVER_CLUSTERS;
  }
  return EDGE_CLUSTERS;
};

const placeApproachCluster = (
  rng: SeededRNG,
  rect: Rect,
  row: number,
  col: number,
  mirror: boolean,
  reserved: ReservedZone[],
  existing: MapObstacle[],
  idBase: string,
): { obstacles: MapObstacle[]; decorations: MapDecoration[] } => {
  const pool = clusterPoolFor(row, col);
  const tries = [...pool];
  for (let i = tries.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const a = tries[i];
    const b = tries[j];
    if (a && b) {
      tries[i] = b;
      tries[j] = a;
    }
  }
  const offsets = [
    { nx: 0.34, ny: 0.16 },
    { nx: 0.66, ny: 0.84 },
    { nx: 0.28, ny: 0.84 },
    { nx: 0.72, ny: 0.16 },
  ];
  for (const id of tries) {
    const template = templateById(id);
    for (const slot of offsets) {
      const nx = mirror ? 1 - slot.nx : slot.nx;
      const cx = rect.x + nx * rect.w;
      const cy = rect.y + slot.ny * rect.h;
      const stamped = stampCluster(template, cx, cy, mirror, reserved, existing, `${idBase}-${id}`);
      if (stamped) {
        return stamped;
      }
    }
  }
  return { obstacles: [], decorations: [] };
};

export const assemble = (seed: number, attempt: number): MapLayout => {
  const rng = new SeededRNG(seed);
  const playable = mapPlayable();
  const size = chunkSize();
  const zones: SpawnZone[] = spawnZonesOf();
  const reserved = buildReservedZones(playable, zones);
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
      const built = instantiate(templateOf(cell.kind), rect, cell.mirror, reserved, obstacles, `${cell.col}-${row}`);
      obstacles.push(...built.obstacles);
      decorations.push(...built.decorations);
      if (cell.col === 1 || cell.col === 3) {
        const cluster = placeApproachCluster(
          rng,
          rect,
          row,
          cell.col,
          cell.mirror,
          reserved,
          obstacles,
          `cl-${cell.col}-${row}`,
        );
        obstacles.push(...cluster.obstacles);
        decorations.push(...cluster.decorations);
      }
    }
  }

  const nearMid: Array<{ id: ClusterId; x: number; y: number; mirror: boolean }> = [
    { id: 'collapsed-building', x: 700, y: 430, mirror: false },
    { id: 'wrecked-car', x: 920, y: 508, mirror: false },
    { id: 'overrun-barricade', x: 920, y: 996, mirror: false },
    { id: 'abandoned-convoy', x: 1664, y: 508, mirror: true },
    { id: 'supply-dump', x: 1664, y: 996, mirror: true },
    { id: 'rubble-slide', x: 820, y: 628, mirror: false },
    { id: 'defensive-nest', x: 1764, y: 876, mirror: true },
    { id: 'overgrown-ruin', x: 1880, y: 1034, mirror: true },
  ];
  for (const [index, site] of nearMid.entries()) {
    const stamp = stampCluster(templateById(site.id), site.x, site.y, site.mirror, reserved, obstacles, `mid-${index}`);
    if (stamp) {
      obstacles.push(...stamp.obstacles);
      decorations.push(...stamp.decorations);
    }
  }

  obstacles.push(...plantCratesBeside(obstacles, reserved, obstacles));
  decorations.push(...scatterFieldDetails(new SeededRNG(seed ^ 0x7e2a), obstacles));

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
    roads: generateRoads(playable, seed),
    reserved,
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
