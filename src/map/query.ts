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
    const length = Math.hypot(dx, dy) || 1;
    const nx = dx / length;
    const ny = dy / length;
    if (!this.blocksMovement(x + nx * look, y + ny * look, 12)) {
      return { x: nx, y: ny };
    }
    const sides = [
      { x: nx, y: 0 },
      { x: 0, y: ny },
      { x: -ny, y: nx },
      { x: ny, y: -nx },
      { x: -nx, y: -ny },
    ];
    for (const dir of sides) {
      const slen = Math.hypot(dir.x, dir.y);
      if (slen < 0.2) {
        continue;
      }
      const sx = dir.x / slen;
      const sy = dir.y / slen;
      if (!this.blocksMovement(x + sx * look, y + sy * look, 12)) {
        return { x: sx, y: sy };
      }
    }
    return { x: 0, y: 0 };
  }
}
