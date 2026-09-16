import { ARENA } from '../config/arena';
import { ROAD } from './scale';
import { SeededRNG } from './seed';
import type { DamageLevel, PavementKind, PavementPatch, Point, Rect, RoadMark, RoadNetwork } from './types';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const damageOf = (_rng: SeededRNG, _heat: number): DamageLevel => 'worn';

const splitSpine = (
  rng: SeededRNG,
  x: number,
  y: number,
  length: number,
  thickness: number,
  heading: 'h' | 'v',
  kind: PavementKind,
  heat: (t: number) => number,
): PavementPatch[] => {
  const patches: PavementPatch[] = [];
  let cursor = 0;
  while (cursor < length - 24) {
    const span = clamp(ROAD.segment + rng.int(-28, 36), 96, 210);
    const take = Math.min(span, length - cursor);
    const t = (cursor + take * 0.5) / Math.max(1, length);
    const damage = damageOf(rng, heat(t));
    if (heading === 'h') {
      patches.push({
        kind,
        x: x + cursor,
        y: y - thickness / 2,
        w: take,
        h: thickness,
        heading,
        damage,
      });
    } else {
      patches.push({
        kind,
        x: x - thickness / 2,
        y: y + cursor,
        w: thickness,
        h: take,
        heading,
        damage,
      });
    }
    cursor += take;
  }
  return patches;
};

const sidewalksAlong = (
  rng: SeededRNG,
  patches: PavementPatch[],
  heat: (x: number, y: number) => number,
): PavementPatch[] => {
  const walks: PavementPatch[] = [];
  for (const patch of patches) {
    if (patch.kind !== 'road') {
      continue;
    }
    if (rng.chance(0.12)) {
      continue;
    }
    const damage = damageOf(rng, heat(patch.x + patch.w / 2, patch.y + patch.h / 2));
    if (patch.heading === 'h') {
      walks.push({
        kind: 'sidewalk',
        x: patch.x,
        y: patch.y - ROAD.sidewalk,
        w: patch.w,
        h: ROAD.sidewalk,
        heading: 'h',
        damage,
      });
      if (!rng.chance(0.18)) {
        walks.push({
          kind: 'sidewalk',
          x: patch.x,
          y: patch.y + patch.h,
          w: patch.w,
          h: ROAD.sidewalk,
          heading: 'h',
          damage: damageOf(rng, heat(patch.x, patch.y + patch.h)),
        });
      }
    } else {
      walks.push({
        kind: 'sidewalk',
        x: patch.x - ROAD.sidewalk,
        y: patch.y,
        w: ROAD.sidewalk,
        h: patch.h,
        heading: 'v',
        damage,
      });
      if (!rng.chance(0.18)) {
        walks.push({
          kind: 'sidewalk',
          x: patch.x + patch.w,
          y: patch.y,
          w: ROAD.sidewalk,
          h: patch.h,
          heading: 'v',
          damage: damageOf(rng, heat(patch.x + patch.w, patch.y)),
        });
      }
    }
  }
  return walks;
};

const markRoad = (_rng: SeededRNG, _patches: PavementPatch[]): RoadMark[] => [];

const crosses = (ax: number, ay: number, bx: number, by: number): boolean =>
  Math.abs(ax - bx) < ROAD.width * 0.85 && Math.abs(ay - by) < ROAD.width * 0.85;

/**
 * Clean street grid at match start. Combat scars the pavement at runtime.
 */
export const generateRoads = (playable: Rect, seed: number): RoadNetwork => {
  const rng = new SeededRNG(seed ^ 0x51d2);
  const roadW = ROAD.width + rng.int(-4, 6);
  const patches: PavementPatch[] = [];
  const intersections: Point[] = [];

  const yJitter = (lane: 'top' | 'mid' | 'bottom') => ARENA.laneY[lane] + rng.int(-8, 8);
  const horizontals = [
    { y: yJitter('top'), heat: 0.25 },
    { y: yJitter('mid'), heat: 0.7 },
    { y: yJitter('bottom'), heat: 0.28 },
  ];

  const left = playable.x + 36;
  const span = playable.w - 72;
  const v1 = playable.x + playable.w * rng.float(0.28, 0.36);
  const v2 = playable.x + playable.w * rng.float(0.64, 0.72);
  const verticals = [v1, v2];
  const top = playable.y + 28;
  const tall = playable.h - 56;

  const heatAt = (x: number, y: number): number => {
    const mid = 1 - Math.min(1, Math.hypot(x - ARENA.width / 2, y - ARENA.height / 2) / 720);
    return mid;
  };

  for (const row of horizontals) {
    patches.push(
      ...splitSpine(rng, left, row.y, span, roadW, 'h', 'road', (t) => row.heat * (0.45 + t * 0.2 + (t > 0.35 && t < 0.65 ? 0.35 : 0))),
    );
  }
  for (const x of verticals) {
    patches.push(...splitSpine(rng, x, top, tall, roadW - 6, 'v', 'road', (t) => 0.35 + (t > 0.4 && t < 0.6 ? 0.3 : 0)));
  }

  for (const row of horizontals) {
    for (const x of verticals) {
      const ix = x;
      const iy = row.y;
      intersections.push({ x: ix, y: iy });
      patches.push({
        kind: 'intersection',
        x: ix - roadW * 0.62,
        y: iy - roadW * 0.62,
        w: roadW * 1.24,
        h: roadW * 1.24,
        heading: 'h',
        damage: damageOf(rng, 0.85),
      });
      void crosses;
    }
  }

  const walks = sidewalksAlong(rng, patches.filter((p) => p.kind === 'road'), heatAt);
  const all = [...patches, ...walks];
  return {
    patches: all,
    marks: markRoad(rng, all),
    intersections,
  };
};
