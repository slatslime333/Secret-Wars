import { CRATE } from '../config/crate';
import { ENV_WORLD } from '../config/environment';
import { ARENA } from '../config/arena';
import { decorateObstacle } from './envProps';
import { PROP, visualForProp, type PropSpec } from './scale';
import { inflate, rectsOverlap } from './geometry';
import { reservedBlocks } from './reserved';
import type { EnvHierarchy, MapDecoration, MapObstacle, ObstacleKind, Rect, ReservedZone, RoadNetwork } from './types';

export type ClusterId =
  | 'collapsed-building'
  | 'abandoned-convoy'
  | 'overrun-barricade'
  | 'supply-dump'
  | 'wrecked-car'
  | 'parked-cars'
  | 'overgrown-ruin'
  | 'defensive-nest'
  | 'rubble-slide'
  | 'corner-shop';

type LocalSolid = {
  kind: ObstacleKind;
  variant: string;
  ox: number;
  oy: number;
  spec: PropSpec;
  hierarchy: EnvHierarchy;
  destructible?: boolean;
};

type LocalDeco = {
  kind: MapDecoration['kind'];
  ox: number;
  oy: number;
  variant: number;
};

export type ClusterTemplate = {
  id: ClusterId;
  story: string;
  w: number;
  h: number;
  solids: LocalSolid[];
  deco: LocalDeco[];
};

const t = (
  id: ClusterId,
  story: string,
  w: number,
  h: number,
  solids: LocalSolid[],
  deco: LocalDeco[],
): ClusterTemplate => ({ id, story, w, h, solids, deco });

export const CLUSTER_LIBRARY: readonly ClusterTemplate[] = [
  t(
    'collapsed-building',
    'A building was destroyed here.',
    170,
    140,
    [
      { kind: 'building', variant: 'house', ox: -18, oy: -8, spec: PROP.building, hierarchy: 'landmark' },
      { kind: 'rubble', variant: 'pile', ox: 52, oy: 28, spec: PROP.rubble, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: 58, oy: -18, spec: PROP.crate, hierarchy: 'cover', destructible: true },
      { kind: 'crate', variant: 'single', ox: 78, oy: 8, spec: PROP.crate, hierarchy: 'cover', destructible: true },
    ],
    [
      { kind: 'debris', ox: 36, oy: 48, variant: 1 },
      { kind: 'debris', ox: -40, oy: 40, variant: 2 },
      { kind: 'burn', ox: 10, oy: 30, variant: 0 },
      { kind: 'sign', ox: 70, oy: -40, variant: 1 },
      { kind: 'grassCrack', ox: 48, oy: 56, variant: 0 },
    ],
  ),
  t(
    'abandoned-convoy',
    'A vehicle was abandoned during the fighting.',
    190,
    120,
    [
      { kind: 'vehicle', variant: 'car', ox: -10, oy: 0, spec: PROP.car, hierarchy: 'landmark' },
      { kind: 'rubble', variant: 'chunk', ox: 70, oy: 18, spec: PROP.rubbleSmall, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: 88, oy: 10, spec: PROP.crate, hierarchy: 'cover', destructible: true },
    ],
    [
      { kind: 'burn', ox: -40, oy: 20, variant: 1 },
      { kind: 'debris', ox: 40, oy: 32, variant: 0 },
      { kind: 'debris', ox: -70, oy: 24, variant: 2 },
      { kind: 'fire', ox: -28, oy: 8, variant: 0 },
    ],
  ),
  t(
    'overrun-barricade',
    'A barricade was overwhelmed.',
    150,
    110,
    [
      { kind: 'barricade', variant: 'wood', ox: -20, oy: 4, spec: PROP.barricade, hierarchy: 'cover' },
      { kind: 'sandbag', variant: 'line', ox: 36, oy: -8, spec: PROP.sandbag, hierarchy: 'cover' },
      { kind: 'fence', variant: 'wood', ox: -48, oy: 28, spec: PROP.fence, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: 48, oy: 22, spec: PROP.crate, hierarchy: 'cover', destructible: true },
    ],
    [
      { kind: 'debris', ox: 8, oy: 28, variant: 1 },
      { kind: 'debris', ox: -40, oy: 24, variant: 0 },
      { kind: 'sign', ox: -48, oy: -20, variant: 0 },
      { kind: 'dirt', ox: 0, oy: 0, variant: 2 },
    ],
  ),
  t(
    'supply-dump',
    'Supplies were being stored here.',
    150,
    120,
    [
      { kind: 'fence', variant: 'wood', ox: -36, oy: -8, spec: PROP.fence, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: 8, oy: -6, spec: PROP.crate, hierarchy: 'cover', destructible: true },
      { kind: 'crate', variant: 'single', ox: 36, oy: 10, spec: PROP.crate, hierarchy: 'cover', destructible: true },
      { kind: 'crate', variant: 'single', ox: 18, oy: 28, spec: PROP.crate, hierarchy: 'cover', destructible: true },
      { kind: 'rubble', variant: 'chunk', ox: -20, oy: 28, spec: PROP.rubbleSmall, hierarchy: 'cover' },
    ],
    [
      { kind: 'debris', ox: 40, oy: 36, variant: 2 },
      { kind: 'dirt', ox: 0, oy: 8, variant: 1 },
    ],
  ),
  t(
    'wrecked-car',
    'A vehicle was wrecked at the intersection.',
    140,
    100,
    [
      { kind: 'vehicle', variant: 'car', ox: -8, oy: 0, spec: PROP.car, hierarchy: 'landmark' },
      { kind: 'barricade', variant: 'metal', ox: 52, oy: 16, spec: PROP.barricade, hierarchy: 'cover' },
    ],
    [
      { kind: 'burn', ox: -16, oy: 18, variant: 0 },
      { kind: 'debris', ox: 20, oy: 28, variant: 1 },
      { kind: 'fire', ox: -4, oy: 6, variant: 1 },
      { kind: 'sign', ox: 60, oy: -28, variant: 2 },
    ],
  ),
  t(
    'parked-cars',
    'Cars left in the street.',
    160,
    110,
    [
      { kind: 'vehicle', variant: 'car', ox: -28, oy: -6, spec: PROP.car, hierarchy: 'landmark' },
      { kind: 'vehicle', variant: 'car', ox: 36, oy: 12, spec: PROP.car, hierarchy: 'landmark' },
      { kind: 'barricade', variant: 'wood', ox: 70, oy: -18, spec: PROP.barricade, hierarchy: 'cover' },
    ],
    [
      { kind: 'debris', ox: 8, oy: 28, variant: 1 },
      { kind: 'dirt', ox: -20, oy: 20, variant: 0 },
    ],
  ),
  t(
    'overgrown-ruin',
    'The battlefield has been fought over for some time.',
    160,
    130,
    [
      { kind: 'building', variant: 'stub', ox: -24, oy: -10, spec: PROP.building, hierarchy: 'landmark' },
      { kind: 'tree', variant: 'medium', ox: 56, oy: 12, spec: PROP.treeMedium, hierarchy: 'cover' },
      { kind: 'tree', variant: 'small', ox: 84, oy: -22, spec: PROP.treeSmall, hierarchy: 'cover' },
      { kind: 'fence', variant: 'wood', ox: 20, oy: 48, spec: PROP.fence, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: 20, oy: 32, spec: PROP.crate, hierarchy: 'cover', destructible: true },
    ],
    [
      { kind: 'grassCrack', ox: 10, oy: 40, variant: 1 },
      { kind: 'grassCrack', ox: -30, oy: 36, variant: 0 },
      { kind: 'tuft', ox: 48, oy: 36, variant: 2 },
      { kind: 'tuft', ox: -48, oy: 24, variant: 1 },
    ],
  ),
  t(
    'defensive-nest',
    'A defensive position was established here.',
    140,
    100,
    [
      { kind: 'sandbag', variant: 'corner', ox: -24, oy: 0, spec: PROP.sandbag, hierarchy: 'cover' },
      { kind: 'sandbag', variant: 'line', ox: 28, oy: 12, spec: PROP.sandbag, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: 8, oy: -16, spec: PROP.crate, hierarchy: 'cover', destructible: true },
      { kind: 'fence', variant: 'wire', ox: -8, oy: 32, spec: PROP.fence, hierarchy: 'cover' },
    ],
    [
      { kind: 'debris', ox: 36, oy: -20, variant: 0 },
      { kind: 'dirt', ox: 0, oy: 8, variant: 0 },
    ],
  ),
  t(
    'rubble-slide',
    'Rubble where a building wall collapsed.',
    140,
    110,
    [
      { kind: 'wall', variant: 'ruin', ox: -30, oy: -12, spec: PROP.wallRuin, hierarchy: 'cover' },
      { kind: 'rubble', variant: 'pile', ox: 18, oy: 10, spec: PROP.rubble, hierarchy: 'cover' },
      { kind: 'rubble', variant: 'chunk', ox: 52, oy: -8, spec: PROP.rubbleSmall, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: -8, oy: 28, spec: PROP.crate, hierarchy: 'cover', destructible: true },
    ],
    [
      { kind: 'debris', ox: 30, oy: 32, variant: 2 },
      { kind: 'debris', ox: -20, oy: 24, variant: 1 },
      { kind: 'grassCrack', ox: 40, oy: 40, variant: 1 },
    ],
  ),
  t(
    'corner-shop',
    'A small shop on a side street.',
    150,
    128,
    [
      { kind: 'building', variant: 'shop', ox: -8, oy: -8, spec: PROP.building, hierarchy: 'landmark' },
      { kind: 'tree', variant: 'small', ox: 72, oy: -22, spec: PROP.treeSmall, hierarchy: 'cover' },
      { kind: 'fence', variant: 'wood', ox: 78, oy: 36, spec: PROP.fence, hierarchy: 'cover' },
      { kind: 'crate', variant: 'single', ox: 58, oy: 16, spec: PROP.crate, hierarchy: 'cover', destructible: true },
    ],
    [
      { kind: 'sign', ox: 62, oy: -30, variant: 1 },
      { kind: 'curbBit', ox: 36, oy: 34, variant: 0 },
    ],
  ),
];

export const EDGE_CLUSTERS: readonly ClusterId[] = [
  'collapsed-building',
  'abandoned-convoy',
  'overgrown-ruin',
  'wrecked-car',
  'rubble-slide',
  'corner-shop',
];

export const COVER_CLUSTERS: readonly ClusterId[] = [
  'overrun-barricade',
  'supply-dump',
  'defensive-nest',
  'wrecked-car',
];

export const templateById = (id: ClusterId): ClusterTemplate => {
  const found = CLUSTER_LIBRARY.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Missing cluster ${id}`);
  }
  return found;
};

const densityCap = (n: number): number => Math.max(n, Math.round(n * (ARENA.width / 2584)));

const keepoutFor = (kind: ObstacleKind, collision: Rect): Rect => {
  if (kind === 'building' || kind === 'vehicle') {
    return inflate(collision, 16);
  }
  if (kind === 'crate' || kind === 'barrel') {
    return inflate(collision, 6);
  }
  return inflate(collision, 8);
};

export const stampCluster = (
  template: ClusterTemplate,
  cx: number,
  cy: number,
  mirror: boolean,
  reserved: readonly ReservedZone[],
  existing: readonly MapObstacle[],
  idBase: string,
): { obstacles: MapObstacle[]; decorations: MapDecoration[] } | undefined => {
  const footprint: Rect = {
    x: cx - template.w / 2,
    y: cy - template.h / 2,
    w: template.w,
    h: template.h,
  };
  if (existing.some((obs) => obs.blocksMovement && rectsOverlap(inflate(obs.collision, 10), footprint))) {
    return undefined;
  }

  const obstacles: MapObstacle[] = [];
  const decorations: MapDecoration[] = [];
  let n = 0;
  for (const local of template.solids) {
    const ox = mirror ? -local.ox : local.ox;
    const x = cx + ox;
    const y = cy + local.oy;
    const vertical =
      (local.kind === 'vehicle' || local.kind === 'barricade' || local.kind === 'sandbag') &&
      ((idBase.length + n + local.ox + local.oy) & 3) === 1;
    const cw = vertical ? local.spec.h : local.spec.w;
    const ch = vertical ? local.spec.w : local.spec.h;
    const vw = vertical ? local.spec.vh : local.spec.vw;
    const vh = vertical ? local.spec.vw : local.spec.vh;
    const collision = { x: x - cw / 2, y: y - ch / 2, w: cw, h: ch };
    const visual = vertical
      ? { x: x - vw / 2, y: y - vh / 2 - local.spec.lift, w: vw, h: vh }
      : visualForProp(local.spec, x, y);
    if (reservedBlocks(collision, reserved, 2)) {
      continue;
    }
    if (existing.some((obs) => obs.blocksMovement && rectsOverlap(inflate(obs.collision, 6), collision))) {
      continue;
    }
    if (obstacles.some((obs) => rectsOverlap(inflate(obs.collision, 4), collision) && obs.kind !== 'crate')) {
      continue;
    }
    obstacles.push(
      decorateObstacle({
        id: `${idBase}-${n}`,
        kind: local.kind,
        variant: local.variant,
        x,
        y,
        collision,
        visual,
        keepout:
          local.hierarchy === 'landmark'
            ? inflate(visual, 8)
            : keepoutFor(local.kind, collision),
        blocksMovement: true,
        blocksProjectiles: local.kind !== 'fence' && local.kind !== 'lamp',
        blocksLos: local.kind === 'building' || local.kind === 'vehicle' || local.kind === 'wall',
        destructible: Boolean(local.destructible),
        hierarchy: local.hierarchy,
        hp: local.kind === 'crate' ? CRATE.maxHealth : undefined,
        facing: vertical ? 'v' : 'h',
      }),
    );
    n += 1;
  }
  if (obstacles.length < 1) {
    return undefined;
  }
  for (const local of template.deco) {
    decorations.push({
      kind: local.kind,
      cluster: idBase,
      x: cx + (mirror ? -local.ox : local.ox),
      y: cy + local.oy,
      variant: local.variant,
    });
  }
  return { obstacles, decorations };
};

const crateObstacle = (id: string, x: number, y: number, spec: PropSpec, variant: string): MapObstacle => {
  const collision = { x: x - spec.w / 2, y: y - spec.h / 2, w: spec.w, h: spec.h };
  const visual = visualForProp(spec, x, y);
  return decorateObstacle({
    id,
    kind: 'crate',
    variant,
    x,
    y,
    collision,
    visual,
    keepout: inflate(collision, 6),
    blocksMovement: true,
    blocksProjectiles: true,
    blocksLos: false,
    destructible: true,
    hierarchy: 'cover',
    hp: CRATE.maxHealth,
  });
};

/** Tuck supply crates beside landmarks so they never sit alone in open grass. */
export const plantCratesBeside = (
  hosts: readonly MapObstacle[],
  reserved: readonly ReservedZone[],
  existing: MapObstacle[],
): MapObstacle[] => {
  const extras: MapObstacle[] = [];
  const anchors = hosts.filter((obs) => obs.kind === 'building' || obs.kind === 'vehicle' || obs.kind === 'barricade');
  let n = 0;
  for (const host of anchors) {
    if (existing.filter((obs) => obs.kind === 'crate').length + extras.length >= densityCap(ENV_WORLD.maxCrates)) {
      break;
    }
    const already = [...existing, ...extras].filter(
      (obs) => obs.kind === 'crate' && Math.hypot(obs.x - host.x, obs.y - host.y) < 90,
    ).length;
    if (already >= 2) {
      continue;
    }
    const box = host.kind === 'building' ? host.visual : host.collision;
    const slots = [
      { x: box.x + box.w + PROP.crate.w / 2 + 8, y: host.y },
      { x: box.x - PROP.crate.w / 2 - 8, y: host.y + 10 },
      { x: host.x + 12, y: box.y + box.h + PROP.crate.h / 2 + 6 },
    ];
    let placed = already;
    for (const slot of slots) {
      if (placed >= 2) {
        break;
      }
      const spec = PROP.crate;
      const variant = 'single';
      const crate = crateObstacle(`supply-${host.id}-${n}`, slot.x, slot.y, spec, variant);
      if (reservedBlocks(crate.collision, reserved, 2)) {
        continue;
      }
      if ([...existing, ...extras].some((obs) => obs.blocksMovement && rectsOverlap(inflate(obs.collision, 4), crate.collision) && obs.kind !== 'crate')) {
        continue;
      }
      extras.push(crate);
      n += 1;
      placed += 1;
    }
  }
  return extras;
};

const barrelObstacle = (id: string, x: number, y: number, variant: 'drum' | 'fuel' | 'skull'): MapObstacle => {
  const spec = PROP.barrel;
  const collision = { x: x - spec.w / 2, y: y - spec.h / 2, w: spec.w, h: spec.h };
  const visual = visualForProp(spec, x, y);
  return decorateObstacle({
    id,
    kind: 'barrel',
    variant,
    x,
    y,
    collision,
    visual,
    keepout: inflate(collision, 6),
    blocksMovement: true,
    blocksProjectiles: true,
    blocksLos: false,
    destructible: true,
    hierarchy: 'cover',
    explosive: true,
  });
};

/** A few drums in alleys beside cars and shops, never mid-lane. */
export const plantBarrelsBeside = (
  hosts: readonly MapObstacle[],
  reserved: readonly ReservedZone[],
  existing: MapObstacle[],
): MapObstacle[] => {
  const extras: MapObstacle[] = [];
  const anchors = hosts.filter(
    (obs) => obs.kind === 'vehicle' || obs.kind === 'building' || obs.kind === 'barricade',
  );
  let n = 0;
  for (const host of anchors) {
    if (existing.filter((obs) => obs.kind === 'barrel').length + extras.length >= densityCap(ENV_WORLD.maxBarrels)) {
      break;
    }
    if (Math.abs(host.y - ARENA.laneY.mid) < 70) {
      continue;
    }
    const already = [...existing, ...extras].filter(
      (obs) => obs.kind === 'barrel' && Math.hypot(obs.x - host.x, obs.y - host.y) < 100,
    ).length;
    if (already >= 1) {
      continue;
    }
    const box = host.kind === 'building' ? host.visual : host.collision;
    const slots = [
      { x: box.x + box.w + PROP.barrel.w / 2 + 10, y: host.y + 16 },
      { x: box.x - PROP.barrel.w / 2 - 10, y: host.y - 12 },
    ];
    for (const slot of slots) {
      const barrel = barrelObstacle(`drum-${host.id}-${n}`, slot.x, slot.y, 'skull');
      if (reservedBlocks(barrel.collision, reserved, 2)) {
        continue;
      }
      if (
        [...existing, ...extras].some(
          (obs) => obs.blocksMovement && rectsOverlap(inflate(obs.collision, 4), barrel.collision),
        )
      ) {
        continue;
      }
      extras.push(barrel);
      n += 1;
      break;
    }
  }
  return extras;
};

const inInterior = (x: number, y: number, hosts: readonly MapObstacle[]): boolean =>
  hosts.some((obs) => {
    const room = obs.interior;
    if (!obs.enterable || !room) {
      return false;
    }
    return x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h;
  });

const tryPlace = (
  obs: MapObstacle,
  reserved: readonly ReservedZone[],
  existing: readonly MapObstacle[],
  extras: readonly MapObstacle[],
): boolean => {
  if (reservedBlocks(obs.collision, reserved, 2)) {
    return false;
  }
  if (inInterior(obs.x, obs.y, existing)) {
    return false;
  }
  return ![...existing, ...extras].some(
    (other) => other.blocksMovement && rectsOverlap(inflate(other.collision, 4), obs.collision),
  );
};

const makeSolid = (
  id: string,
  kind: ObstacleKind,
  variant: string,
  x: number,
  y: number,
  spec: PropSpec,
  hierarchy: EnvHierarchy,
): MapObstacle => {
  const collision = { x: x - spec.w / 2, y: y - spec.h / 2, w: spec.w, h: spec.h };
  const visual = visualForProp(spec, x, y);
  return decorateObstacle({
    id,
    kind,
    variant,
    x,
    y,
    collision,
    visual,
    keepout: inflate(collision, kind === 'lamp' ? 4 : 8),
    blocksMovement: true,
    blocksProjectiles: kind !== 'fence' && kind !== 'lamp',
    blocksLos: false,
    destructible: true,
    hierarchy,
  });
};

/** Street lamps along sidewalks. Lightweight, breakable. */
export const plantLampsAlong = (
  roads: RoadNetwork,
  reserved: readonly ReservedZone[],
  existing: MapObstacle[],
): MapObstacle[] => {
  const extras: MapObstacle[] = [];
  let n = 0;
  for (const patch of roads.patches) {
    if (patch.kind !== 'sidewalk') {
      continue;
    }
    const step = 220;
    if (patch.heading === 'h') {
      for (let x = patch.x + 48; x < patch.x + patch.w - 36; x += step) {
        if (existing.filter((obs) => obs.kind === 'lamp').length + extras.length >= densityCap(ENV_WORLD.maxLamps)) {
          return extras;
        }
        const y = patch.y + patch.h / 2;
        if (Math.abs(y - ARENA.laneY.mid) < 36) {
          continue;
        }
        const short = n % 3 === 0;
        const lamp = makeSolid(
          `lamp-${n}`,
          'lamp',
          short ? 'short' : 'street',
          x,
          y,
          short ? PROP.lampShort : PROP.lamp,
          'detail',
        );
        if (!tryPlace(lamp, reserved, existing, extras)) {
          continue;
        }
        extras.push(lamp);
        n += 1;
      }
    } else {
      for (let y = patch.y + 48; y < patch.y + patch.h - 36; y += step) {
        if (existing.filter((obs) => obs.kind === 'lamp').length + extras.length >= densityCap(ENV_WORLD.maxLamps)) {
          return extras;
        }
        const x = patch.x + patch.w / 2;
        const lamp = makeSolid(`lamp-v-${n}`, 'lamp', 'street', x, y, PROP.lamp, 'detail');
        if (!tryPlace(lamp, reserved, existing, extras)) {
          continue;
        }
        extras.push(lamp);
        n += 1;
      }
    }
  }
  return extras;
};

/** Extra trees beside buildings and existing cover, collision kept compact. */
export const plantTreesBeside = (
  hosts: readonly MapObstacle[],
  reserved: readonly ReservedZone[],
  existing: MapObstacle[],
): MapObstacle[] => {
  const extras: MapObstacle[] = [];
  const anchors = hosts.filter(
    (obs) => obs.kind === 'building' || obs.kind === 'fence' || obs.kind === 'wall' || obs.kind === 'tree',
  );
  let n = 0;
  for (const host of anchors) {
    if (n >= densityCap(ENV_WORLD.maxExtraTrees)) {
      break;
    }
    const already = [...existing, ...extras].filter(
      (obs) => obs.kind === 'tree' && Math.hypot(obs.x - host.x, obs.y - host.y) < 64,
    ).length;
    if (already >= 2) {
      continue;
    }
    const box = host.kind === 'building' ? host.visual : host.collision;
    const slots = [
      { x: box.x - PROP.treeSmall.w / 2 - 10, y: box.y + 8 },
      { x: box.x + box.w + PROP.treeSmall.w / 2 + 10, y: box.y + 12 },
    ];
    for (const slot of slots) {
      if (Math.abs(slot.y - ARENA.laneY.mid) < 50) {
        continue;
      }
      const spec = n % 3 === 0 ? PROP.treeMedium : PROP.treeSmall;
      const variant = n % 3 === 0 ? 'medium' : n % 5 === 0 ? 'broad' : 'small';
      const tree = makeSolid(`tree-${host.id}-${n}`, 'tree', variant, slot.x, slot.y, spec, 'cover');
      if (!tryPlace(tree, reserved, existing, extras)) {
        continue;
      }
      extras.push(tree);
      n += 1;
      break;
    }
  }
  return extras;
};

/** Extra fences along yards and shops. */
export const plantFencesBeside = (
  hosts: readonly MapObstacle[],
  reserved: readonly ReservedZone[],
  existing: MapObstacle[],
): MapObstacle[] => {
  const extras: MapObstacle[] = [];
  const anchors = hosts.filter((obs) => obs.kind === 'building' || obs.kind === 'barricade' || obs.kind === 'sandbag');
  let n = 0;
  for (const host of anchors) {
    if (n >= densityCap(ENV_WORLD.maxExtraFences)) {
      break;
    }
    const already = [...existing, ...extras].filter(
      (obs) => obs.kind === 'fence' && Math.hypot(obs.x - host.x, obs.y - host.y) < 80,
    ).length;
    if (already >= 1 || (host.id.length + n) % 5 === 0) {
      continue;
    }
    const box = host.kind === 'building' ? host.visual : host.collision;
    const slots = [
      { x: host.x, y: box.y + box.h + PROP.fence.h / 2 + 8, facing: 'h' as const },
      { x: host.x, y: box.y - PROP.fence.h / 2 - 8, facing: 'h' as const },
      { x: box.x - PROP.fence.h / 2 - 8, y: host.y + 18, facing: 'v' as const },
    ];
    for (const slot of slots) {
      if (Math.abs(slot.y - ARENA.laneY.mid) < 60) {
        continue;
      }
      const vertical = slot.facing === 'v';
      const spec = PROP.fence;
      const cw = vertical ? spec.h : spec.w;
      const ch = vertical ? spec.w : spec.h;
      const fence = decorateObstacle({
        id: `fence-${host.id}-${n}`,
        kind: 'fence',
        variant: n % 2 === 0 ? 'wood' : 'wire',
        x: slot.x,
        y: slot.y,
        collision: { x: slot.x - cw / 2, y: slot.y - ch / 2, w: cw, h: ch },
        visual: vertical
          ? { x: slot.x - spec.vh / 2, y: slot.y - spec.vw / 2 - spec.lift, w: spec.vh, h: spec.vw }
          : visualForProp(spec, slot.x, slot.y),
        keepout: inflate({ x: slot.x - cw / 2, y: slot.y - ch / 2, w: cw, h: ch }, 4),
        blocksMovement: true,
        blocksProjectiles: false,
        blocksLos: false,
        destructible: true,
        hierarchy: 'cover',
        facing: slot.facing,
      });
      if (!tryPlace(fence, reserved, existing, extras)) {
        continue;
      }
      extras.push(fence);
      n += 1;
      break;
    }
  }
  return extras;
};

/** Occasional fences along sidewalks, not a wall on every block. */
export const plantFencesAlong = (
  roads: RoadNetwork,
  reserved: readonly ReservedZone[],
  existing: MapObstacle[],
): MapObstacle[] => {
  const extras: MapObstacle[] = [];
  let n = 0;
  for (const patch of roads.patches) {
    if (patch.kind !== 'sidewalk' || (Math.round(patch.x + patch.y + patch.w) % 5 === 0)) {
      continue;
    }
    if (n + existing.filter((obs) => obs.kind === 'fence').length >= densityCap(ENV_WORLD.maxExtraFences)) {
      return extras;
    }
    const vertical = patch.heading === 'v';
    const spec = PROP.fence;
    const x = vertical ? patch.x + patch.w / 2 : patch.x + patch.w * 0.45;
    const y = vertical ? patch.y + patch.h * 0.4 : patch.y + patch.h / 2;
    if (Math.abs(y - ARENA.laneY.mid) < 50) {
      continue;
    }
    const cw = vertical ? spec.h : spec.w;
    const ch = vertical ? spec.w : spec.h;
    const fence = decorateObstacle({
      id: `road-fence-${n}`,
      kind: 'fence',
      variant: n % 2 === 0 ? 'wood' : 'wire',
      x,
      y,
      collision: { x: x - cw / 2, y: y - ch / 2, w: cw, h: ch },
      visual: vertical
        ? { x: x - spec.vh / 2, y: y - spec.vw / 2 - spec.lift, w: spec.vh, h: spec.vw }
        : visualForProp(spec, x, y),
      keepout: inflate({ x: x - cw / 2, y: y - ch / 2, w: cw, h: ch }, 4),
      blocksMovement: true,
      blocksProjectiles: false,
      blocksLos: false,
      destructible: true,
      hierarchy: 'cover',
      facing: vertical ? 'v' : 'h',
    });
    if (!tryPlace(fence, reserved, existing, extras)) {
      continue;
    }
    extras.push(fence);
    n += 1;
  }
  return extras;
};
