import Phaser from 'phaser';
import { MapQuery } from './query';
import type { MapLayout } from './types';

/**
 * Static collision bodies that match gameplay obstacle AABBs.
 * Visuals can extend past these (tree canopies) but movement / shots cannot.
 */
export class MapWorld {
  readonly query: MapQuery;
  readonly staticGroup: Phaser.Physics.Arcade.StaticGroup;
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private readonly blockers: Phaser.GameObjects.Rectangle[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    readonly layout: MapLayout,
  ) {
    this.query = new MapQuery(layout);
    this.staticGroup = scene.physics.add.staticGroup();
    for (const obs of layout.obstacles) {
      const { x, y, w, h } = obs.collision;
      const block = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
      scene.physics.add.existing(block, true);
      this.staticGroup.add(block);
      this.blockers.push(block);
    }
  }

  attachMover(sprite: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject): void {
    const collider = this.scene.physics.add.collider(sprite, this.staticGroup);
    this.colliders.push(collider);
  }

  attachGroup(group: Phaser.Physics.Arcade.Group): void {
    this.colliders.push(this.scene.physics.add.collider(group, this.staticGroup));
  }

  destroy(): void {
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
}
