import { ARENA } from '../config/arena';
import { ROAD } from './scale';
import { SeededRNG } from './seed';
import type { DamageLevel, PavementKind, PavementPatch, Point, Rect, RoadMark, RoadNetwork } from './types';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const damageOf = (rng: SeededRNG, heat: number): DamageLevel => {
  const roll = rng.float() + heat * 0.22;
  if (roll > 1.05) {
    return 'missing';
  }
  if (roll > 0.86) {
    return 'overgrown';
  }
  if (roll > 0.62) {
    return 'broken';
  }
  if (roll > 0.32) {
    return 'cracked';
  }
  return 'worn';
};

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

const markRoad = (rng: SeededRNG, patches: PavementPatch[]): RoadMark[] => {
  const marks: RoadMark[] = [];
  for (const patch of patches) {
    if (patch.kind === 'sidewalk' && (patch.damage === 'worn' || patch.damage === 'missing')) {
      continue;
    }
    const cx = patch.x + patch.w / 2;
    const cy = patch.y + patch.h / 2;
    if (patch.damage === 'cracked' || patch.damage === 'broken') {
      const cracks = patch.damage === 'broken' ? rng.int(2, 3) : 1;
      for (let i = 0; i < cracks; i += 1) {
        marks.push({
          kind: 'crack',
          x: cx + rng.int(-Math.floor(patch.w * 0.3), Math.floor(patch.w * 0.3)),
          y: cy + rng.int(-Math.floor(patch.h * 0.28), Math.floor(patch.h * 0.28)),
          w: patch.heading === 'h' ? rng.int(18, 42) : rng.int(3, 6),
          h: patch.heading === 'h' ? rng.int(3, 6) : rng.int(18, 40),
          variant: rng.int(0, 2),
        });
      }
    }
    if (patch.damage === 'broken' || patch.damage === 'overgrown') {
      marks.push({
        kind: patch.damage === 'overgrown' ? 'grass' : 'pothole',
        x: cx + rng.int(-16, 16),
        y: cy + rng.int(-10, 10),
        w: rng.int(10, ROAD.pothole),
        h: rng.int(8, 16),
        variant: rng.int(0, 2),
      });
    }
    if (patch.damage === 'missing') {
      marks.push({
        kind: 'hole',
        x: cx,
        y: cy,
        w: Math.max(16, patch.w * 0.45),
        h: Math.max(12, patch.h * 0.45),
        variant: 0,
      });
    }
    if (patch.kind === 'intersection' && rng.chance(0.7)) {
      marks.push({
        kind: rng.chance(0.45) ? 'burn' : 'spill',
        x: cx + rng.int(-18, 18),
        y: cy + rng.int(-14, 14),
        w: rng.int(22, 48),
        h: rng.int(16, 32),
        variant: rng.int(0, 2),
      });
    }
  }
  return marks;
};

const crosses = (ax: number, ay: number, bx: number, by: number): boolean =>
  Math.abs(ax - bx) < ROAD.width * 0.85 && Math.abs(ay - by) < ROAD.width * 0.85;

/**
 * Believable damaged street grid: three east-west roads along the combat
 * belts, plus two north-south connectors. Damage is stronger toward midfield
 * and intersections, never a noisy scatter of fragments.
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
