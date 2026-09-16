import { PROP } from './scale';
import type { ChunkKind, DecorationKind, ObstacleKind } from './types';
import type { PropSpec } from './scale';

export type LocalObstacle = {
  kind: ObstacleKind;
  variant: string;
  nx: number;
  ny: number;
  spec: PropSpec;
};

export type LocalDecoration = {
  kind: DecorationKind;
  nx: number;
  ny: number;
  variant: number;
};

export type ChunkTemplate = {
  kind: ChunkKind;
  connects: { n: boolean; e: boolean; s: boolean; w: boolean };
  minDensity: number;
  maxDensity: number;
  hasChoke: boolean;
  nearSpawn: boolean;
  nearCenter: boolean;
  nearRoute: boolean;
  obstacles: LocalObstacle[];
  decorations: LocalDecoration[];
};

const field = (): ChunkTemplate => ({
  kind: 'OPEN_FIELD',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0,
  maxDensity: 0.04,
  hasChoke: false,
  nearSpawn: true,
  nearCenter: true,
  nearRoute: true,
  obstacles: [],
  decorations: [
    { kind: 'dirt', nx: 0.48, ny: 0.52, variant: 0 },
    { kind: 'tuft', nx: 0.3, ny: 0.7, variant: 1 },
    { kind: 'grassCrack', nx: 0.62, ny: 0.36, variant: 0 },
  ],
});

const widePath = (): ChunkTemplate => ({
  kind: 'WIDE_PATH',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.02,
  maxDensity: 0.08,
  hasChoke: false,
  nearSpawn: true,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'sandbag', variant: 'line', nx: 0.22, ny: 0.2, spec: PROP.sandbag },
    { kind: 'tree', variant: 'small', nx: 0.78, ny: 0.18, spec: PROP.treeSmall },
    { kind: 'fence', variant: 'wire', nx: 0.16, ny: 0.78, spec: PROP.fence },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 1 },
    { kind: 'tuft', nx: 0.18, ny: 0.8, variant: 0 },
    { kind: 'debris', nx: 0.78, ny: 0.24, variant: 1 },
  ],
});

const forest = (): ChunkTemplate => ({
  kind: 'FOREST',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.06,
  maxDensity: 0.12,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: false,
  nearRoute: true,
  obstacles: [
    { kind: 'tree', variant: 'medium', nx: 0.28, ny: 0.24, spec: PROP.treeMedium },
    { kind: 'tree', variant: 'small', nx: 0.72, ny: 0.22, spec: PROP.treeSmall },
    { kind: 'tree', variant: 'broad', nx: 0.78, ny: 0.76, spec: PROP.treeBroad },
    { kind: 'tree', variant: 'small', nx: 0.46, ny: 0.7, spec: PROP.treeSmall },
    { kind: 'fence', variant: 'wood', nx: 0.18, ny: 0.62, spec: PROP.fence },
    { kind: 'rubble', variant: 'chunk', nx: 0.3, ny: 0.78, spec: PROP.rubbleSmall },
  ],
  decorations: [
    { kind: 'tuft', nx: 0.46, ny: 0.62, variant: 1 },
    { kind: 'tuft', nx: 0.32, ny: 0.36, variant: 2 },
    { kind: 'grassCrack', nx: 0.54, ny: 0.48, variant: 0 },
    { kind: 'flower', nx: 0.4, ny: 0.3, variant: 1 },
  ],
});

const twinWalls = (): ChunkTemplate => ({
  kind: 'TWIN_WALLS',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.06,
  maxDensity: 0.12,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: false,
  nearRoute: true,
  obstacles: [
    { kind: 'sandbag', variant: 'line', nx: 0.5, ny: 0.2, spec: PROP.sandbag },
    { kind: 'barricade', variant: 'wood', nx: 0.5, ny: 0.8, spec: PROP.barricade },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 0 },
    { kind: 'debris', nx: 0.28, ny: 0.22, variant: 1 },
    { kind: 'debris', nx: 0.74, ny: 0.78, variant: 2 },
  ],
});

const crateYard = (): ChunkTemplate => ({
  kind: 'CRATE_YARD',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.05,
  maxDensity: 0.1,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'fence', variant: 'wood', nx: 0.24, ny: 0.28, spec: PROP.fence },
    { kind: 'lamp', variant: 'street', nx: 0.5, ny: 0.18, spec: PROP.lamp },
    { kind: 'rubble', variant: 'chunk', nx: 0.76, ny: 0.72, spec: PROP.rubbleSmall },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 2 },
    { kind: 'debris', nx: 0.34, ny: 0.7, variant: 0 },
  ],
});

const ruins = (): ChunkTemplate => ({
  kind: 'RUINS',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.05,
  maxDensity: 0.12,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'wall', variant: 'ruin', nx: 0.28, ny: 0.22, spec: PROP.wallRuin },
    { kind: 'wall', variant: 'stone', nx: 0.74, ny: 0.78, spec: PROP.wallStone },
  ],
  decorations: [
    { kind: 'debris', nx: 0.4, ny: 0.4, variant: 1 },
    { kind: 'burn', nx: 0.62, ny: 0.32, variant: 0 },
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 1 },
  ],
});

const choke = (): ChunkTemplate => ({
  kind: 'CHOKE_POINT',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.06,
  maxDensity: 0.12,
  hasChoke: true,
  nearSpawn: false,
  nearCenter: false,
  nearRoute: true,
  obstacles: [
    { kind: 'vehicle', variant: 'car', nx: 0.26, ny: 0.2, spec: PROP.car },
    { kind: 'barricade', variant: 'metal', nx: 0.74, ny: 0.8, spec: PROP.barricade },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 0 },
    { kind: 'burn', nx: 0.3, ny: 0.28, variant: 1 },
    { kind: 'debris', nx: 0.5, ny: 0.22, variant: 2 },
  ],
});

const scattered = (): ChunkTemplate => ({
  kind: 'SCATTERED_COVER',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.04,
  maxDensity: 0.1,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'barricade', variant: 'wood', nx: 0.24, ny: 0.22, spec: PROP.barricade },
    { kind: 'sandbag', variant: 'line', nx: 0.76, ny: 0.76, spec: PROP.sandbag },
    { kind: 'tree', variant: 'medium', nx: 0.2, ny: 0.72, spec: PROP.treeMedium },
    { kind: 'lamp', variant: 'short', nx: 0.82, ny: 0.28, spec: PROP.lampShort },
  ],
  decorations: [
    { kind: 'debris', nx: 0.48, ny: 0.48, variant: 0 },
    { kind: 'tuft', nx: 0.8, ny: 0.22, variant: 0 },
    { kind: 'dirt', nx: 0.3, ny: 0.7, variant: 1 },
  ],
});

const courtyard = (): ChunkTemplate => ({
  kind: 'SMALL_COURTYARD',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.06,
  maxDensity: 0.12,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'wall', variant: 'stone', nx: 0.28, ny: 0.22, spec: PROP.wallStone },
    { kind: 'wall', variant: 'stone', nx: 0.74, ny: 0.78, spec: PROP.buildingStub },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 2 },
    { kind: 'flower', nx: 0.5, ny: 0.46, variant: 1 },
    { kind: 'tuft', nx: 0.42, ny: 0.58, variant: 0 },
  ],
});

const rocks = (): ChunkTemplate => ({
  kind: 'ROCK_CLUSTER',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.03,
  maxDensity: 0.08,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: false,
  nearRoute: true,
  obstacles: [
    { kind: 'rubble', variant: 'pile', nx: 0.3, ny: 0.28, spec: PROP.rubble },
    { kind: 'rubble', variant: 'chunk', nx: 0.7, ny: 0.72, spec: PROP.rubbleSmall },
  ],
  decorations: [
    { kind: 'debris', nx: 0.44, ny: 0.5, variant: 0 },
    { kind: 'tuft', nx: 0.36, ny: 0.6, variant: 1 },
    { kind: 'tuft', nx: 0.6, ny: 0.62, variant: 2 },
  ],
});

export const CHUNK_LIBRARY: readonly ChunkTemplate[] = [
  field(),
  widePath(),
  forest(),
  twinWalls(),
  crateYard(),
  ruins(),
  choke(),
  scattered(),
  courtyard(),
  rocks(),
];

export const templateOf = (kind: ChunkKind): ChunkTemplate => {
  const found = CHUNK_LIBRARY.find((entry) => entry.kind === kind);
  if (!found) {
    throw new Error(`Missing chunk template ${kind}`);
  }
  return found;
};

export const SPAWN_KINDS: readonly ChunkKind[] = ['OPEN_FIELD', 'WIDE_PATH'];
export const CENTER_KINDS: readonly ChunkKind[] = [
  'OPEN_FIELD',
  'WIDE_PATH',
  'SCATTERED_COVER',
  'SMALL_COURTYARD',
];
export const APPROACH_KINDS: readonly ChunkKind[] = [
  'FOREST',
  'TWIN_WALLS',
  'CRATE_YARD',
  'RUINS',
  'CHOKE_POINT',
  'SCATTERED_COVER',
  'WIDE_PATH',
  'SMALL_COURTYARD',
  'ROCK_CLUSTER',
];
