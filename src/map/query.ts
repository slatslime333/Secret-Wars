import { ARENA } from '../config/arena';
import { MAP } from './config';
import { circleHitsRect, pointInRect } from './geometry';
import type { MapLayout, MapObstacle, MapRegionId, Point, Rect } from './types';

export class MapQuery {
  constructor(readonly layout: MapLayout) {}

  regionAt(x: number, y: number): MapRegionId | undefined {
    for (const id of ['north', 'center', 'south'] as const) {
      if (pointInRect(x, y, this.layout.regions[id])) {
        return id;
      }
    }
    return undefined;
  }

  openAreas(): Rect[] {
    return this.layout.openAreas;
  }

  spawnZones() {
    return this.layout.spawnZones;
  }

  /** Future objectives: open, reachable, away from spawn pads. */
  objectiveCandidates(): Point[] {
    return this.layout.openAreas.map((area) => ({
      x: area.x + area.w / 2,
      y: area.y + area.h / 2,
    }));
  }

  safeLocations(): Point[] {
    return this.layout.spawnZones
      .filter((zone) => zone.role === 'hero')
      .map((zone) => ({ x: zone.x, y: zone.y }));
  }

  inSpawnExclusion(x: number, y: number, extra = 0): boolean {
    return this.layout.spawnZones.some((zone) => Math.hypot(x - zone.x, y - zone.y) < zone.radius + extra);
  }

  obstacleAt(x: number, y: number, radius = 0): MapObstacle | undefined {
    return this.layout.obstacles.find(
      (obs) => obs.blocksMovement && circleHitsRect(x, y, radius, obs.collision),
    );
  }

  blocksMovement(x: number, y: number, radius: number = MAP.agentRadius): boolean {
    if (!pointInRect(x, y, this.layout.playable)) {
      return true;
    }
    return Boolean(this.obstacleAt(x, y, radius));
  }

  blocksProjectile(x: number, y: number, radius = 3): boolean {
    if (x < 0 || y < 0 || x > ARENA.width || y > ARENA.height) {
      return true;
    }
    return this.layout.obstacles.some(
      (obs) => obs.blocksProjectiles && circleHitsRect(x, y, radius, obs.collision),
    );
  }

  blocksLos(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.lineBlocked(x1, y1, x2, y2);
  }

  lineBlocked(x1: number, y1: number, x2: number, y2: number, step = 8): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 1) {
      return this.blocksProjectile(x1, y1);
    }
    const count = Math.ceil(dist / step);
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      if (this.blocksProjectile(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) {
        return true;
      }
    }
    return false;
  }

  occupiesKeepout(x: number, y: number, radius: number): boolean {
    return this.layout.obstacles.some((obs) => circleHitsRect(x, y, radius, obs.keepout ?? obs.collision));
  }

  /** Enough open approaches so an objective is not trapped in a corner. */
  hasApproaches(x: number, y: number, radius: number): boolean {
    const dist = radius + 36;
    let open = 0;
    for (let i = 0; i < 8; i += 1) {
      const ang = (Math.PI / 4) * i;
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * dist;
      if (!this.blocksMovement(px, py, 14) && !this.occupiesKeepout(px, py, 10)) {
        open += 1;
      }
    }
    return open >= 3;
  }

  clearForObjective(x: number, y: number, radius: number): boolean {
    const clear = Math.max(22, radius);
    if (this.inSpawnExclusion(x, y, 72)) {
      return false;
    }
    if (this.blocksMovement(x, y, clear)) {
      return false;
    }
    if (this.occupiesKeepout(x, y, clear)) {
      return false;
    }
    const edge = 56;
    if (
      x < this.layout.playable.x + edge ||
      y < this.layout.playable.y + edge ||
      x > this.layout.playable.x + this.layout.playable.w - edge ||
      y > this.layout.playable.y + this.layout.playable.h - edge
    ) {
      return false;
    }
    return this.hasApproaches(x, y, radius);
  }

  /** Nudge a desired walk vector around nearby solids. */
  steer(x: number, y: number, dx: number, dy: number, look = 34): Point {
    if (this.blocksMovement(x, y, 8)) {
      return escapeAround((px, py, radius) => this.blocksMovement(px, py, radius), x, y, dx, dy, 22);
    }
    return steerAround((px, py, radius) => this.blocksMovement(px, py, radius), x, y, dx, dy, look);
  }

  /** Best free heading when already pressed into geometry. */
  escapeHeading(x: number, y: number, dx: number, dy: number, look = 36): Point {
    return escapeAround((px, py, radius) => this.blocksMovement(px, py, radius), x, y, dx, dy, look);
  }
}

type BlockFn = (x: number, y: number, radius: number) => boolean;

const RECOVER_ANGLES = [0.62, -0.62, Math.PI / 2, -Math.PI / 2, 2.15, -2.15, Math.PI];

const rotate = (nx: number, ny: number, ang: number): { x: number; y: number } => {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  return { x: nx * ca - ny * sa, y: nx * sa + ny * ca };
};

/** Local slide: keep the original heading when open, else pick a free nearby angle. */
export const steerAround = (
  blocked: BlockFn,
  x: number,
  y: number,
  dx: number,
  dy: number,
  look = 34,
  radius = 12,
): Point => {
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  if (!blocked(x + nx * look, y + ny * look, radius)) {
    return { x: nx, y: ny };
  }
  let best: Point | undefined;
  let bestScore = -1e9;
  for (const ang of RECOVER_ANGLES) {
    const dir = rotate(nx, ny, ang);
    if (blocked(x + dir.x * look, y + dir.y * look, radius)) {
      continue;
    }
    const far = !blocked(x + dir.x * look * 1.55, y + dir.y * look * 1.55, radius);
    const align = dir.x * nx + dir.y * ny;
    const score = align * 1.15 + (far ? 0.4 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best ?? { x: 0, y: 0 };
};

const FAN_ANGLES = [0, 0.7, -0.7, Math.PI / 2, -Math.PI / 2, 2.2, -2.2, Math.PI];

/** Sample nearby headings and pick the most open one with some progress toward the want. */
export const escapeAround = (
  blocked: BlockFn,
  x: number,
  y: number,
  dx: number,
  dy: number,
  look = 32,
  radius = 12,
): Point => {
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  let best: Point | undefined;
  let bestScore = -1e9;
  for (const ang of FAN_ANGLES) {
    const dir = rotate(nx, ny, ang);
    const near = blocked(x + dir.x * look * 0.7, y + dir.y * look * 0.7, radius);
    const mid = blocked(x + dir.x * look, y + dir.y * look, radius);
    if (near && mid) {
      continue;
    }
    const far = !blocked(x + dir.x * look * 1.6, y + dir.y * look * 1.6, radius);
    const align = dir.x * nx + dir.y * ny;
    const score = (mid ? -0.8 : 1.1) + (near ? -0.5 : 0.2) + align * 0.55 + (far ? 0.35 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best ?? { x: -nx, y: -ny };
};
