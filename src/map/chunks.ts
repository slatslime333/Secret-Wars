import type { ChunkKind, DecorationKind, ObstacleKind } from './types';

export type LocalObstacle = {
  kind: ObstacleKind;
  variant: string;
  nx: number;
  ny: number;
  w: number;
  h: number;
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
    { kind: 'flower', nx: 0.72, ny: 0.28, variant: 0 },
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
    { kind: 'crate', variant: 'single', nx: 0.22, ny: 0.22, w: 16, h: 16 },
    { kind: 'tree', variant: 'small', nx: 0.8, ny: 0.78, w: 10, h: 10 },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 1 },
    { kind: 'tuft', nx: 0.18, ny: 0.8, variant: 0 },
    { kind: 'tuft', nx: 0.84, ny: 0.2, variant: 2 },
  ],
});

const forest = (): ChunkTemplate => ({
  kind: 'FOREST',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.08,
  maxDensity: 0.16,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: false,
  nearRoute: true,
  obstacles: [
    { kind: 'tree', variant: 'medium', nx: 0.42, ny: 0.4, w: 10, h: 10 },
    { kind: 'tree', variant: 'small', nx: 0.54, ny: 0.32, w: 10, h: 10 },
    { kind: 'tree', variant: 'broad', nx: 0.5, ny: 0.52, w: 12, h: 10 },
    { kind: 'tree', variant: 'small', nx: 0.34, ny: 0.5, w: 10, h: 10 },
    { kind: 'tree', variant: 'medium', nx: 0.6, ny: 0.46, w: 10, h: 10 },
  ],
  decorations: [
    { kind: 'rock', nx: 0.38, ny: 0.58, variant: 0 },
    { kind: 'rock', nx: 0.58, ny: 0.6, variant: 1 },
    { kind: 'tuft', nx: 0.46, ny: 0.62, variant: 1 },
    { kind: 'tuft', nx: 0.32, ny: 0.36, variant: 2 },
    { kind: 'tuft', nx: 0.64, ny: 0.34, variant: 0 },
    { kind: 'flower', nx: 0.44, ny: 0.28, variant: 1 },
  ],
});

const twinWalls = (): ChunkTemplate => ({
  kind: 'TWIN_WALLS',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.08,
  maxDensity: 0.14,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: false,
  nearRoute: true,
  obstacles: [
    { kind: 'wall', variant: 'stone', nx: 0.5, ny: 0.26, w: 168, h: 18 },
    { kind: 'wall', variant: 'stone', nx: 0.5, ny: 0.74, w: 168, h: 18 },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 0 },
    { kind: 'tuft', nx: 0.22, ny: 0.5, variant: 1 },
    { kind: 'tuft', nx: 0.78, ny: 0.5, variant: 2 },
  ],
});

const crateYard = (): ChunkTemplate => ({
  kind: 'CRATE_YARD',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.07,
  maxDensity: 0.13,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'crate', variant: 'stack', nx: 0.32, ny: 0.34, w: 16, h: 24 },
    { kind: 'crate', variant: 'single', nx: 0.42, ny: 0.34, w: 16, h: 16 },
    { kind: 'crate', variant: 'pair', nx: 0.37, ny: 0.62, w: 30, h: 16 },
    { kind: 'crate', variant: 'single', nx: 0.66, ny: 0.38, w: 16, h: 16 },
    { kind: 'crate', variant: 'stack', nx: 0.68, ny: 0.64, w: 16, h: 24 },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 2 },
    { kind: 'tuft', nx: 0.24, ny: 0.72, variant: 0 },
    { kind: 'rock', nx: 0.78, ny: 0.28, variant: 2 },
  ],
});

const ruins = (): ChunkTemplate => ({
  kind: 'RUINS',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.07,
  maxDensity: 0.14,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'wall', variant: 'ruin', nx: 0.36, ny: 0.3, w: 72, h: 18 },
    { kind: 'wall', variant: 'ruin', nx: 0.26, ny: 0.44, w: 18, h: 56 },
    { kind: 'wall', variant: 'stone', nx: 0.7, ny: 0.68, w: 80, h: 18 },
    { kind: 'crate', variant: 'single', nx: 0.62, ny: 0.32, w: 16, h: 16 },
  ],
  decorations: [
    { kind: 'rock', nx: 0.36, ny: 0.58, variant: 1 },
    { kind: 'rock', nx: 0.72, ny: 0.58, variant: 0 },
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 1 },
    { kind: 'tuft', nx: 0.78, ny: 0.26, variant: 2 },
  ],
});

const choke = (): ChunkTemplate => ({
  kind: 'CHOKE_POINT',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.08,
  maxDensity: 0.14,
  hasChoke: true,
  nearSpawn: false,
  nearCenter: false,
  nearRoute: true,
  obstacles: [
    { kind: 'wall', variant: 'wood', nx: 0.24, ny: 0.5, w: 110, h: 18 },
    { kind: 'wall', variant: 'wood', nx: 0.76, ny: 0.5, w: 110, h: 18 },
  ],
  decorations: [
    { kind: 'dirt', nx: 0.5, ny: 0.5, variant: 0 },
    { kind: 'tuft', nx: 0.5, ny: 0.28, variant: 1 },
    { kind: 'tuft', nx: 0.5, ny: 0.72, variant: 2 },
  ],
});

const scattered = (): ChunkTemplate => ({
  kind: 'SCATTERED_COVER',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.05,
  maxDensity: 0.1,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'tree', variant: 'medium', nx: 0.28, ny: 0.3, w: 10, h: 10 },
    { kind: 'crate', variant: 'stack', nx: 0.7, ny: 0.36, w: 16, h: 24 },
    { kind: 'tree', variant: 'small', nx: 0.62, ny: 0.72, w: 10, h: 10 },
    { kind: 'crate', variant: 'single', nx: 0.3, ny: 0.7, w: 16, h: 16 },
  ],
  decorations: [
    { kind: 'tuft', nx: 0.48, ny: 0.48, variant: 0 },
    { kind: 'flower', nx: 0.8, ny: 0.22, variant: 0 },
    { kind: 'rock', nx: 0.2, ny: 0.8, variant: 2 },
  ],
});

const courtyard = (): ChunkTemplate => ({
  kind: 'SMALL_COURTYARD',
  connects: { n: true, e: true, s: true, w: true },
  minDensity: 0.08,
  maxDensity: 0.14,
  hasChoke: false,
  nearSpawn: false,
  nearCenter: true,
  nearRoute: true,
  obstacles: [
    { kind: 'wall', variant: 'stone', nx: 0.34, ny: 0.26, w: 70, h: 16 },
    { kind: 'wall', variant: 'stone', nx: 0.24, ny: 0.4, w: 16, h: 70 },
    { kind: 'wall', variant: 'stone', nx: 0.66, ny: 0.74, w: 70, h: 16 },
    { kind: 'wall', variant: 'stone', nx: 0.76, ny: 0.6, w: 16, h: 70 },
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
    { kind: 'tree', variant: 'small', nx: 0.46, ny: 0.48, w: 10, h: 10 },
    { kind: 'crate', variant: 'single', nx: 0.62, ny: 0.36, w: 16, h: 16 },
  ],
  decorations: [
    { kind: 'rock', nx: 0.4, ny: 0.42, variant: 0 },
    { kind: 'rock', nx: 0.5, ny: 0.4, variant: 1 },
    { kind: 'rock', nx: 0.44, ny: 0.56, variant: 2 },
    { kind: 'rock', nx: 0.56, ny: 0.54, variant: 0 },
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
  'CRATE_YARD',
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
