import { ARENA } from '../config/arena';
import { CRATE } from '../config/crate';
import { APPROACH_KINDS, CENTER_KINDS, SPAWN_KINDS, templateOf, type ChunkTemplate } from './chunks';
import {
  COVER_CLUSTERS,
  EDGE_CLUSTERS,
  plantCratesBeside,
  plantBarrelsBeside,
  plantLampsAlong,
  plantTreesBeside,
  plantFencesBeside,
  plantFencesAlong,
  stampCluster,
  templateById,
  type ClusterId,
} from './clusters';
import { MAP, chunkSize, mapPlayable } from './config';
import { ENV_WORLD } from '../config/environment';
import { buildFallbackLayout } from './fallback';
import { inflate, rectsOverlap } from './geometry';
import { generateRoads } from './roads';
import { buildReservedZones, reservedBlocks, spawnZonesOf } from './reserved';
import { decorateObstacle } from './envProps';
import { visualForProp, PROP } from './scale';
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
  if (kind === 'crate' || kind === 'barricade' || kind === 'sandbag' || kind === 'fence' || kind === 'wall' || kind === 'rubble' || kind === 'tree' || kind === 'lamp') {
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
    obstacles.push(
      decorateObstacle({
        id: `${idBase}-${n}`,
        kind: local.kind,
        variant: local.variant,
        x: cx,
        y: cy,
        collision,
        visual,
        keepout: keepoutOf(local.kind, collision, visual),
        blocksMovement: true,
        blocksProjectiles: local.kind !== 'fence' && local.kind !== 'lamp',
        blocksLos: local.kind === 'building' || local.kind === 'vehicle' || local.kind === 'wall',
        destructible: local.kind === 'crate',
        hierarchy: hierarchyOf(local.kind),
        hp: local.kind === 'crate' ? CRATE.maxHealth : undefined,
      }),
    );
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

const houseWall = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): MapObstacle =>
  decorateObstacle({
    id,
    kind: 'wall',
    variant: 'wood',
    x,
    y,
    collision: { x: x - w / 2, y: y - h / 2, w, h },
    visual: { x: x - w / 2, y: y - h / 2 - 2, w, h: h + 4 },
    keepout: inflate({ x: x - w / 2, y: y - h / 2, w, h }, 4),
    blocksMovement: true,
    blocksProjectiles: true,
    blocksLos: true,
    destructible: true,
    hierarchy: 'cover',
  });

const openHome = (obs: MapObstacle, obstacles: MapObstacle[]): void => {
  obs.enterable = true;
  obs.variant = 'shop';
  obs.visual = visualForProp(PROP.house, obs.x, obs.y);
  obs.keepout = inflate(obs.visual, 6);
  obs.blocksMovement = false;
  obs.blocksProjectiles = false;
  obs.blocksLos = false;
  obs.collision = { x: obs.x - 4, y: obs.y - 4, w: 8, h: 8 };
  const door = ENV_WORLD.houseDoor;
  const v = obs.visual;
  // Shell bricks are 14px. Collision is thicker so a body cannot step the seam.
  const brick = 14;
  const thick = 22;
  const half = thick / 2;
  const northCenter = v.y + 28 + brick / 2;
  const southCenter = v.y + (v.h - 28) + brick / 2;
  const westCenter = v.x + 8 + brick / 2;
  const eastCenter = v.x + v.w - 22 + brick / 2;
  const midX = v.x + v.w / 2;
  const doorLeft = midX - door / 2;
  const doorRight = midX + door / 2;
  const innerWest = westCenter + half;
  const innerEast = eastCenter - half;
  const northBottom = northCenter + half;
  const southTop = southCenter - half;
  const sideH = southTop - northBottom;
  const sideY = (northBottom + southTop) / 2;
  const leftLen = doorLeft - innerWest;
  const rightLen = innerEast - doorRight;
  const leftX = (innerWest + doorLeft) / 2;
  const rightX = (doorRight + innerEast) / 2;
  obs.interior = {
    x: innerWest,
    y: northBottom,
    w: innerEast - innerWest,
    h: sideH,
  };
  obstacles.push(
    houseWall(`${obs.id}-n-l`, leftX, northCenter, leftLen, thick),
    houseWall(`${obs.id}-n-r`, rightX, northCenter, rightLen, thick),
    houseWall(`${obs.id}-s-l`, leftX, southCenter, leftLen, thick),
    houseWall(`${obs.id}-s-r`, rightX, southCenter, rightLen, thick),
    houseWall(`${obs.id}-w`, westCenter, sideY, thick, sideH),
    houseWall(`${obs.id}-e`, eastCenter, sideY, thick, sideH),
  );
  obs.doors = [
    { side: 'front', x: midX, y: southCenter },
    { side: 'back', x: midX, y: northCenter },
  ];
  const room = obs.interior;
  for (const other of obstacles) {
    if (other.id === obs.id || other.id.startsWith(`${obs.id}-`)) {
      continue;
    }
    const hitsRoom = Boolean(room && rectsOverlap(other.collision, room));
    const hitsWall = obstacles.some(
      (wallObs) => wallObs.id.startsWith(`${obs.id}-`) && rectsOverlap(inflate(other.collision, 2), wallObs.collision),
    );
    if (hitsRoom || hitsWall) {
      other.blocksMovement = false;
      other.blocksProjectiles = false;
      other.blocksLos = false;
    }
  }
};

/** Props planted after the shell can sit in the opening. The mouth stays walkable. */
const clearDoorMouths = (obstacles: MapObstacle[]): void => {
  const gap = ENV_WORLD.houseDoor;
  const mouthH = 22;
  for (const home of obstacles) {
    if (!home.enterable || !home.doors) {
      continue;
    }
    for (const door of home.doors) {
      const mouth = { x: door.x - gap / 2, y: door.y - mouthH / 2, w: gap, h: mouthH };
      for (const other of obstacles) {
        if (!other.blocksMovement || other.id === home.id || other.id.startsWith(`${home.id}-`)) {
          continue;
        }
        if (!rectsOverlap(other.collision, mouth)) {
          continue;
        }
        other.blocksMovement = false;
        other.blocksProjectiles = false;
        other.blocksLos = false;
      }
    }
  }
};

const markEnterableBuildings = (
  obstacles: MapObstacle[],
  playable: Rect,
  reserved: ReservedZone[],
): void => {
  const left = playable.x + playable.w / 3;
  const right = playable.x + (playable.w * 2) / 3;
  const midY = playable.y + playable.h * 0.5;
  const candidates = obstacles.filter((obs) => {
    if (obs.kind !== 'building' || obs.enterable) {
      return false;
    }
    if (obs.x > left && obs.x < right) {
      return false;
    }
    return Math.abs(obs.y - midY) > 70;
  });
  let opened = 0;
  for (const obs of candidates) {
    if (opened >= ENV_WORLD.maxEnterable) {
      break;
    }
    openHome(obs, obstacles);
    opened += 1;
  }
  const sx = ARENA.width / 2584;
  const sy = ARENA.height / 1504;
  const sites = [
    { x: Math.round(640 * sx), y: Math.round(500 * sy) },
    { x: Math.round(1944 * sx), y: Math.round(980 * sy) },
    { x: Math.round(640 * sx), y: Math.round(980 * sy) },
    { x: Math.round(1944 * sx), y: Math.round(500 * sy) },
  ];
  for (const site of sites) {
    if (opened >= ENV_WORLD.maxEnterable) {
      break;
    }
    const collision = {
      x: site.x - PROP.building.w / 2,
      y: site.y - PROP.building.h / 2,
      w: PROP.building.w,
      h: PROP.building.h,
    };
    if (reservedBlocks(collision, reserved, 2)) {
      continue;
    }
    if (obstacles.some((obs) => obs.blocksMovement && rectsOverlap(inflate(obs.collision, 10), inflate(collision, 10)))) {
      continue;
    }
    const visual = visualForProp(PROP.building, site.x, site.y);
    const home = decorateObstacle({
      id: `home-${opened}`,
      kind: 'building',
      variant: 'shop',
      x: site.x,
      y: site.y,
      collision,
      visual,
      keepout: inflate(visual, 6),
      blocksMovement: true,
      blocksProjectiles: true,
      blocksLos: true,
      destructible: false,
      hierarchy: 'landmark',
    });
    obstacles.push(home);
    openHome(home, obstacles);
    opened += 1;
  }
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
    const centerPool = row === 1 ? (['OPEN_FIELD'] as const) : CENTER_KINDS;
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

  const sx = ARENA.width / 2584;
  const sy = ARENA.height / 1504;
  const nearMid: Array<{ id: ClusterId; x: number; y: number; mirror: boolean }> = [
    { id: 'collapsed-building', x: Math.round(700 * sx), y: Math.round(430 * sy), mirror: false },
    { id: 'wrecked-car', x: Math.round(920 * sx), y: Math.round(508 * sy), mirror: false },
    { id: 'parked-cars', x: Math.round(1180 * sx), y: Math.round(430 * sy), mirror: false },
    { id: 'overrun-barricade', x: Math.round(920 * sx), y: Math.round(996 * sy), mirror: false },
    { id: 'abandoned-convoy', x: Math.round(1664 * sx), y: Math.round(508 * sy), mirror: true },
    { id: 'supply-dump', x: Math.round(1664 * sx), y: Math.round(996 * sy), mirror: true },
    { id: 'rubble-slide', x: Math.round(820 * sx), y: Math.round(628 * sy), mirror: false },
    { id: 'defensive-nest', x: Math.round(1764 * sx), y: Math.round(876 * sy), mirror: true },
    { id: 'overgrown-ruin', x: Math.round(1880 * sx), y: Math.round(1034 * sy), mirror: true },
    { id: 'corner-shop', x: Math.round(640 * sx), y: Math.round(500 * sy), mirror: false },
    { id: 'corner-shop', x: Math.round(1940 * sx), y: Math.round(980 * sy), mirror: true },
    { id: 'parked-cars', x: Math.round(1480 * sx), y: Math.round(1000 * sy), mirror: true },
  ];
  for (const [index, site] of nearMid.entries()) {
    const stamp = stampCluster(templateById(site.id), site.x, site.y, site.mirror, reserved, obstacles, `mid-${index}`);
    if (stamp) {
      obstacles.push(...stamp.obstacles);
      decorations.push(...stamp.decorations);
    }
  }

  const roads = generateRoads(playable, seed);
  markEnterableBuildings(obstacles, playable, reserved);
  obstacles.push(...plantCratesBeside(obstacles, reserved, obstacles));
  obstacles.push(...plantBarrelsBeside(obstacles, reserved, obstacles));
  obstacles.push(...plantLampsAlong(roads, reserved, obstacles));
  obstacles.push(...plantTreesBeside(obstacles, reserved, obstacles));
  obstacles.push(...plantFencesBeside(obstacles, reserved, obstacles));
  obstacles.push(...plantFencesAlong(roads, reserved, obstacles));
  clearDoorMouths(obstacles);
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
    roads,
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
