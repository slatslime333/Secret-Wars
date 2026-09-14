import Phaser from 'phaser';
import {
  ASSET_SIZE,
  drawBarricade,
  drawBuilding,
  drawCrate,
  drawFence,
  drawFire,
  drawRubble,
  drawSandbag,
  drawTree,
  drawVehicle,
  drawWall,
} from './drawAssets';
import type { MapObstacle } from './types';

const KEYS: Record<string, string> = {
  'wall:stone': 'sw-wall-stone-v4',
  'wall:ruin': 'sw-wall-ruin-v4',
  'wall:wood': 'sw-wall-wood-v4',
  'tree:small': 'sw-tree-small-v4',
  'tree:medium': 'sw-tree-medium-v4',
  'tree:broad': 'sw-tree-broad-v4',
  'crate:single': 'sw-crate-single-v4',
  'crate:stack': 'sw-crate-stack-v4',
  'crate:pair': 'sw-crate-pair-v4',
  'building:house': 'sw-building-house-v4',
  'building:stub': 'sw-building-stub-v4',
  'vehicle:truck': 'sw-vehicle-truck-v4',
  'vehicle:car': 'sw-vehicle-car-v4',
  'barricade:wood': 'sw-barricade-wood-v4',
  'barricade:metal': 'sw-barricade-metal-v4',
  'sandbag:line': 'sw-sandbag-line-v4',
  'sandbag:corner': 'sw-sandbag-corner-v4',
  'rubble:pile': 'sw-rubble-pile-v4',
  'rubble:chunk': 'sw-rubble-chunk-v4',
  'fence:wood': 'sw-fence-wood-v4',
  'fence:wire': 'sw-fence-wire-v4',
  'fire:small': 'sw-fire-small-v4',
};

const bake = (
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void => {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) {
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  draw(ctx);
  canvas.refresh();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

const drawers: Record<string, (ctx: CanvasRenderingContext2D, variant: string, w: number, h: number) => void> = {
  wall: drawWall,
  tree: drawTree,
  crate: drawCrate,
  building: drawBuilding,
  vehicle: drawVehicle,
  barricade: drawBarricade,
  sandbag: drawSandbag,
  rubble: drawRubble,
  fence: drawFence,
  fire: drawFire,
};

export const ensureObstacleTextures = (scene: Phaser.Scene): void => {
  for (const [id, key] of Object.entries(KEYS)) {
    const [kind, variant] = id.split(':');
    const size = ASSET_SIZE[id];
    const draw = kind ? drawers[kind] : undefined;
    if (!size || !draw || !variant) {
      continue;
    }
    bake(scene, key, size.w, size.h, (ctx) => draw(ctx, variant, size.w, size.h));
  }
};

export const textureKeyFor = (obs: MapObstacle): string => {
  const id = `${obs.kind}:${obs.variant}`;
  return KEYS[id] ?? KEYS['crate:single'] ?? 'sw-crate-single-v4';
};

export const fireTextureKey = (): string => KEYS['fire:small'] ?? 'sw-fire-small-v4';
