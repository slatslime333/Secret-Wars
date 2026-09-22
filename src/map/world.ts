import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { circleHitsRect, resolveCircleRect } from './geometry';
import { MapQuery } from './query';
import type { MapLayout, MapObstacle, Rect } from './types';

/**
 * Static collision bodies that match gameplay obstacle AABBs.
 * Visuals can extend past these (tree canopies, ruined roofs) but movers cannot.
 */
export class MapWorld {
  readonly query: MapQuery;
  readonly staticGroup: Phaser.Physics.Arcade.StaticGroup;
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly blockers: Phaser.GameObjects.Rectangle[] = [];
  private readonly movers = new Set<Phaser.GameObjects.GameObject>();
  private readonly groups: Phaser.Physics.Arcade.Group[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    readonly layout: MapLayout,
  ) {
    this.query = new MapQuery(layout);
    this.staticGroup = scene.physics.add.staticGroup();
    this.addPerimeterWalls();
    for (const obs of layout.obstacles) {
      if (!obs.blocksMovement) {
        continue;
      }
      const { x, y, w, h } = obs.collision;
      const block = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
      block.setData('obstacleId', obs.id);
      scene.physics.add.existing(block, true);
      this.staticGroup.add(block);
      this.blockers.push(block);
    }
    scene.physics.world.on('worldstep', this.sweepMovers);
  }

  attachMover(sprite: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject): void {
    this.movers.add(sprite);
    const collider = this.scene.physics.add.collider(sprite, this.staticGroup);
    this.colliders.push(collider);
  }

  attachGroup(group: Phaser.Physics.Arcade.Group): void {
    this.groups.push(group);
    this.colliders.push(this.scene.physics.add.collider(group, this.staticGroup));
  }

  setBlocking(id: string, blocks: boolean): void {
    const obs = this.layout.obstacles.find((item) => item.id === id);
    if (obs) {
      obs.blocksMovement = blocks;
      if (!blocks) {
        obs.blocksProjectiles = false;
        obs.blocksLos = false;
      }
    }
    const index = this.blockers.findIndex((block) => block.getData('obstacleId') === id);
    if (!blocks && index >= 0) {
      const block = this.blockers[index];
      this.staticGroup.remove(block, true, true);
      block.destroy();
      this.blockers.splice(index, 1);
      return;
    }
    if (blocks && index < 0 && obs) {
      this.addBlocker(obs);
    }
  }

  refreshCollision(id: string): void {
    const obs = this.layout.obstacles.find((item) => item.id === id);
    if (!obs) {
      return;
    }
    const index = this.blockers.findIndex((block) => block.getData('obstacleId') === id);
    if (index >= 0) {
      const block = this.blockers[index];
      this.staticGroup.remove(block, true, true);
      block.destroy();
      this.blockers.splice(index, 1);
    }
    if (obs.blocksMovement) {
      this.addBlocker(obs);
    }
  }

  restoreObstacle(obs: MapObstacle): void {
    if (!this.layout.obstacles.some((item) => item.id === obs.id)) {
      this.layout.obstacles.push(obs);
    }
    this.refreshCollision(obs.id);
  }

  private addBlocker(obs: MapObstacle): void {
    const { x, y, w, h } = obs.collision;
    const block = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    block.setData('obstacleId', obs.id);
    this.scene.physics.add.existing(block, true);
    this.staticGroup.add(block);
    this.blockers.push(block);
  }

  removeObstacle(id: string): void {
    const index = this.blockers.findIndex((block) => block.getData('obstacleId') === id);
    if (index < 0) {
      return;
    }
    const block = this.blockers[index];
    this.staticGroup.remove(block, true, true);
    block.destroy();
    this.blockers.splice(index, 1);
    const layoutIndex = this.layout.obstacles.findIndex((obs) => obs.id === id);
    if (layoutIndex >= 0) {
      this.layout.obstacles.splice(layoutIndex, 1);
    }
  }

  private addPerimeterWalls(): void {
    const { width, height, wallThickness: wall } = ARENA;
    const strips: Array<{ x: number; y: number; w: number; h: number }> = [
      { x: width / 2, y: wall / 2, w: width, h: wall },
      { x: width / 2, y: height - wall / 2, w: width, h: wall },
      { x: wall / 2, y: height / 2, w: wall, h: height },
      { x: width - wall / 2, y: height / 2, w: wall, h: height },
    ];
    for (const strip of strips) {
      const block = this.scene.add.rectangle(strip.x, strip.y, strip.w, strip.h, 0x000000, 0);
      this.scene.physics.add.existing(block, true);
      this.staticGroup.add(block);
      this.blockers.push(block);
    }
  }

  /** Arcade steps can skip a thin slab. Pull movers back along the step and slide. */
  private readonly sweepMovers = (): void => {
    const rects = this.blockerRects();
    if (rects.length === 0) {
      return;
    }
    const seen = new Set<Phaser.Physics.Arcade.Body>();
    const visit = (body: Phaser.Physics.Arcade.Body | null | undefined): void => {
      if (!body?.enable || body.immovable || seen.has(body)) {
        return;
      }
      seen.add(body);
      this.separateBody(body, rects);
    };
    for (const sprite of this.movers) {
      const withBody = sprite as Phaser.Types.Physics.Arcade.GameObjectWithBody;
      visit(withBody.body as Phaser.Physics.Arcade.Body | null);
    }
    for (const group of this.groups) {
      for (const child of group.getChildren()) {
        visit((child as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.Body | null }).body);
      }
    }
  };

  private blockerRects(): Rect[] {
    const rects: Rect[] = [];
    for (const block of this.blockers) {
      const body = block.body as Phaser.Physics.Arcade.StaticBody | null;
      if (!body || !block.active) {
        continue;
      }
      rects.push({ x: body.x, y: body.y, w: body.width, h: body.height });
    }
    return rects;
  }

  private separateBody(body: Phaser.Physics.Arcade.Body, rects: Rect[]): void {
    const radius = Math.max(body.halfWidth, body.halfHeight);
    const prevX = body.prev.x + body.halfWidth;
    const prevY = body.prev.y + body.halfHeight;
    const cx = body.center.x;
    const cy = body.center.y;
    const travel = Math.hypot(cx - prevX, cy - prevY);
    let px = cx;
    let py = cy;
    if (travel > 0.5 && travel <= 72) {
      const steps = Math.max(1, Math.ceil(travel / 6));
      let freeX = prevX;
      let freeY = prevY;
      let hit = false;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const sx = prevX + (cx - prevX) * t;
        const sy = prevY + (cy - prevY) * t;
        if (rects.some((rect) => circleHitsRect(sx, sy, radius, rect))) {
          hit = true;
          break;
        }
        freeX = sx;
        freeY = sy;
      }
      if (hit) {
        px = freeX;
        py = freeY;
      }
    }
    for (let pass = 0; pass < 4; pass += 1) {
      let pushed = false;
      for (const rect of rects) {
        const next = resolveCircleRect(px, py, radius, rect);
        if (!next) {
          continue;
        }
        px = next.x;
        py = next.y;
        pushed = true;
      }
      if (!pushed) {
        break;
      }
    }
    if (Math.hypot(px - cx, py - cy) < 0.05) {
      return;
    }
    const go = body.gameObject as (Phaser.GameObjects.GameObject & { x: number; y: number }) | null;
    if (!go) {
      return;
    }
    go.x += px - cx;
    go.y += py - cy;
    body.updateFromGameObject();
    const nx = px - cx;
    const ny = py - cy;
    const nlen = Math.hypot(nx, ny) || 1;
    const ux = nx / nlen;
    const uy = ny / nlen;
    const into = body.velocity.x * ux + body.velocity.y * uy;
    if (into < 0) {
      body.setVelocity(body.velocity.x - ux * into, body.velocity.y - uy * into);
    }
  }

  destroy(): void {
    this.scene.physics.world.off('worldstep', this.sweepMovers);
    for (const collider of this.colliders) {
      collider.destroy();
    }
    this.colliders.length = 0;
    for (const block of this.blockers) {
      block.destroy();
    }
    this.blockers.length = 0;
    this.staticGroup.destroy(true);
  }
};
