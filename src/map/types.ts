import type { LaneId } from '../config/arena';
import type { TeamId } from '../config/hero';

export type MapRegionId = 'north' | 'center' | 'south';

export type ObstacleKind =
  | 'wall'
  | 'tree'
  | 'crate'
  | 'building'
  | 'vehicle'
  | 'barricade'
  | 'sandbag'
  | 'rubble'
  | 'fence'
  | 'barrel'
  | 'lamp';

/** How the live city treats this prop during combat. */
export type PhysicsClass = 'static' | 'breakable' | 'lightweight' | 'explosive' | 'temporary';

export type DamageState = 'intact' | 'damaged' | 'cracked' | 'destroyed' | 'knocked';

export type WallVariant = 'stone' | 'ruin' | 'wood';
export type TreeVariant = 'small' | 'medium' | 'broad';
export type CrateVariant = 'single' | 'stack' | 'pair';
export type VehicleVariant = 'truck' | 'car';
export type BuildingVariant = 'house' | 'stub' | 'shop';
export type BarrelVariant = 'drum' | 'fuel' | 'skull';
export type LampVariant = 'street' | 'short';
export type BarricadeVariant = 'wood' | 'metal';
export type SandbagVariant = 'line' | 'corner';
export type RubbleVariant = 'pile' | 'chunk';
export type FenceVariant = 'wood' | 'wire';

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

export type EnvHierarchy = 'landmark' | 'cover' | 'detail';

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
  keepout: Rect;
  blocksMovement: boolean;
  blocksProjectiles: boolean;
  blocksLos: boolean;
  destructible: boolean;
  hierarchy: EnvHierarchy;
  hp?: number;
  maxHp?: number;
  physicsClass?: PhysicsClass;
  damageState?: DamageState;
  explosive?: boolean;
  enterable?: boolean;
  interior?: Rect;
};

export type DecorationKind =
  | 'rock'
  | 'tuft'
  | 'flower'
  | 'dirt'
  | 'debris'
  | 'burn'
  | 'sign'
  | 'fire'
  | 'grassCrack'
  | 'curbBit';

export type MapDecoration = {
  kind: DecorationKind;
  cluster: string;
  x: number;
  y: number;
  variant: number;
};

export type PavementKind = 'road' | 'sidewalk' | 'intersection';
export type DamageLevel = 'worn' | 'cracked' | 'broken' | 'missing' | 'overgrown';

export type PavementPatch = {
  kind: PavementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  heading: 'h' | 'v';
  damage: DamageLevel;
};

export type RoadMark = {
  kind: 'crack' | 'pothole' | 'spill' | 'grass' | 'burn' | 'hole';
  x: number;
  y: number;
  w: number;
  h: number;
  variant: number;
};

export type RoadNetwork = {
  patches: PavementPatch[];
  marks: RoadMark[];
  intersections: Point[];
};

export type ReservedKind = 'spawn' | 'objective' | 'lane-flow';

export type ReservedZone = {
  kind: ReservedKind;
  id: string;
  rect: Rect;
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
  roads: RoadNetwork;
  reserved: ReservedZone[];
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
