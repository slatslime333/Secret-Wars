import type { LaneId } from '../config/arena';
import type { TeamId } from '../config/hero';

export type MapRegionId = 'north' | 'center' | 'south';

export type ObstacleKind = 'wall' | 'tree' | 'crate';

export type WallVariant = 'stone' | 'ruin' | 'wood';
export type TreeVariant = 'small' | 'medium' | 'broad';
export type CrateVariant = 'single' | 'stack' | 'pair';

export type ChunkKind =
  | 'OPEN_FIELD'
  | 'FOREST'
  | 'TWIN_WALLS'
  | 'CRATE_YARD'
  | 'RUINS'
  | 'CHOKE_POINT'
  | 'SCATTERED_COVER'
  | 'WIDE_PATH'
  | 'SMALL_COURTYARD'
  | 'ROCK_CLUSTER';

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Point = {
  x: number;
  y: number;
};

export type MapObstacle = {
  id: string;
  kind: ObstacleKind;
  variant: string;
  x: number;
  y: number;
  collision: Rect;
  visual: Rect;
  blocksMovement: true;
  blocksProjectiles: true;
  blocksLos: true;
  /** Future hook. Crates stay solid until a destruction system lands. */
  destructible: boolean;
};

export type DecorationKind = 'rock' | 'tuft' | 'flower' | 'dirt';

export type MapDecoration = {
  kind: DecorationKind;
  cluster: string;
  x: number;
  y: number;
  variant: number;
};

export type MapChunkInstance = {
  col: number;
  row: number;
  kind: ChunkKind;
  rect: Rect;
};

export type MapRoute = {
  id: 'direct' | 'covered-north' | 'covered-south';
  waypoints: Point[];
};

export type SpawnZone = {
  team: TeamId;
  role: 'hero' | 'minion';
  lane: LaneId;
  x: number;
  y: number;
  radius: number;
};

export type MapQuality = {
  total: number;
  connectivity: number;
  spawnSafety: number;
  routeQuality: number;
  obstacleDistribution: number;
  openSpace: number;
  cover: number;
  regionalConnectivity: number;
  readability: number;
};

export type ValidationIssue = {
  code: string;
  message: string;
};

export type MapLayout = {
  seed: number;
  attempt: number;
  usedFallback: boolean;
  quality: MapQuality;
  bounds: Rect;
  playable: Rect;
  regions: Record<MapRegionId, Rect>;
  chunks: MapChunkInstance[];
  obstacles: MapObstacle[];
  decorations: MapDecoration[];
  spawnZones: SpawnZone[];
  routes: MapRoute[];
  openAreas: Rect[];
};

export type GenerateOptions = {
  seed?: number;
  maxAttempts?: number;
  log?: boolean;
};

export type GenerateResult = {
  layout: MapLayout;
  seed: number;
  attempt: number;
  usedFallback: boolean;
};
