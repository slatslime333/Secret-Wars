import Phaser from 'phaser';
import { MapDebugOverlay } from './debug';
import { generateBattlefield } from './generate';
import { MapQuery } from './query';
import { renderMapLayout, type MapView } from './render';
import type { GenerateResult, MapLayout } from './types';
import { MapWorld } from './world';

export type BattlefieldHost = Phaser.Scene & {
  battlefield?: Battlefield;
};

export const battlefieldOf = (scene: Phaser.Scene): Battlefield | undefined =>
  (scene as BattlefieldHost).battlefield;

export class Battlefield {
  layout: MapLayout;
  query: MapQuery;
  world: MapWorld;
  result: GenerateResult;
  private view: MapView;
  readonly debug: MapDebugOverlay;

  private constructor(
    private readonly scene: Phaser.Scene,
    result: GenerateResult,
  ) {
    this.result = result;
    this.layout = result.layout;
    this.query = new MapQuery(result.layout);
    this.world = new MapWorld(scene, result.layout);
    this.view = renderMapLayout(scene, result.layout);
    this.debug = new MapDebugOverlay(scene, result.layout);
    (scene as BattlefieldHost).battlefield = this;
  }

  static install(scene: Phaser.Scene, options: { seed?: number; log?: boolean }): Battlefield {
    battlefieldOf(scene)?.destroy();
    const result = generateBattlefield({ seed: options.seed, log: options.log });
    return new Battlefield(scene, result);
  }

  attachMover(sprite: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject): void {
    this.world.attachMover(sprite);
  }

  attachGroup(group: Phaser.Physics.Arcade.Group): void {
    this.world.attachGroup(group);
  }

  regenerate(seed: number): GenerateResult {
    const debugOn = this.debug.visible;
    this.world.destroy();
    this.view.destroy();
    this.result = generateBattlefield({ seed, log: true });
    this.layout = this.result.layout;
    this.query = new MapQuery(this.layout);
    this.world = new MapWorld(this.scene, this.layout);
    this.view = renderMapLayout(this.scene, this.layout);
    this.debug.setLayout(this.layout);
    this.debug.setVisible(debugOn);
    return this.result;
  }

  destroy(): void {
    this.debug.destroy();
    this.view.destroy();
    this.world.destroy();
    const host = this.scene as BattlefieldHost;
    if (host.battlefield === this) {
      delete host.battlefield;
    }
  }
}
