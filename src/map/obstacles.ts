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
  drawBarrel,
  drawLamp,
} from './drawAssets';
import type { MapObstacle } from './types';

const KEYS: Record<string, string> = {
  'wall:stone': 'sw-wall-stone-v5',
  'wall:stone-damaged': 'sw-wall-stone-damaged-v1',
  'wall:stone-cracked': 'sw-wall-stone-cracked-v1',
  'wall:ruin': 'sw-wall-ruin-v5',
  'wall:ruin-damaged': 'sw-wall-ruin-damaged-v1',
  'wall:ruin-cracked': 'sw-wall-ruin-cracked-v1',
  'wall:wood': 'sw-wall-wood-v5',
  'wall:wood-damaged': 'sw-wall-wood-damaged-v1',
  'wall:wood-cracked': 'sw-wall-wood-cracked-v1',
  'tree:small': 'sw-tree-small-v6',
  'tree:medium': 'sw-tree-medium-v6',
  'tree:broad': 'sw-tree-broad-v6',
  'crate:single': 'sw-crate-single-v4',
  'crate:stack': 'sw-crate-stack-v4',
  'crate:pair': 'sw-crate-pair-v4',
  'building:house': 'sw-building-house-v8',
  'building:house-floor': 'sw-building-house-floor-v4',
  'building:house-roof': 'sw-building-house-roof-v4',
  'building:house-shell': 'sw-building-house-shell-v5',
  'building:stub': 'sw-building-stub-v5',
  'building:stub-floor': 'sw-building-stub-floor-v1',
  'building:stub-roof': 'sw-building-stub-roof-v1',
  'building:stub-shell': 'sw-building-stub-shell-v2',
  'building:shop': 'sw-building-shop-v4',
  'building:shop-floor': 'sw-building-shop-floor-v4',
  'building:shop-roof': 'sw-building-shop-roof-v4',
  'building:shop-shell': 'sw-building-shop-shell-v5',
  'vehicle:truck': 'sw-vehicle-truck-v5',
  'vehicle:truck-damaged': 'sw-vehicle-truck-damaged-v1',
  'vehicle:car': 'sw-vehicle-car-v5',
  'vehicle:car-damaged': 'sw-vehicle-car-damaged-v1',
  'vehicle:car-wreck': 'sw-vehicle-car-wreck-v1',
  'barricade:wood': 'sw-barricade-wood-v4',
  'barricade:metal': 'sw-barricade-metal-v4',
  'sandbag:line': 'sw-sandbag-line-v4',
  'sandbag:corner': 'sw-sandbag-corner-v4',
  'rubble:pile': 'sw-rubble-pile-v4',
  'rubble:chunk': 'sw-rubble-chunk-v4',
  'fence:wood': 'sw-fence-wood-v4',
  'fence:wire': 'sw-fence-wire-v4',
  'barrel:drum': 'sw-barrel-drum-v3',
  'barrel:fuel': 'sw-barrel-fuel-v3',
  'barrel:skull': 'sw-barrel-skull-v2',
  'lamp:street': 'sw-lamp-street-v2',
  'lamp:short': 'sw-lamp-short-v2',
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
  barrel: drawBarrel,
  lamp: drawLamp,
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
  const wear =
    obs.kind === 'wall' && (obs.damageState === 'damaged' || obs.damageState === 'cracked')
      ? `-${obs.damageState}`
      : obs.kind === 'vehicle' && obs.variant === 'car' && (obs.damageState === 'destroyed' || obs.damageState === 'knocked')
        ? '-wreck'
        : obs.kind === 'vehicle' && (obs.damageState === 'damaged' || obs.damageState === 'cracked')
          ? '-damaged'
          : '';
  const id = `${obs.kind}:${obs.variant}${wear}`;
  return KEYS[id] ?? KEYS[`${obs.kind}:${obs.variant}`] ?? KEYS['crate:single'] ?? 'sw-crate-single-v4';
};

export const buildingLayerKey = (obs: MapObstacle, layer: 'floor' | 'roof' | 'shell'): string => {
  const id = `${obs.kind}:${obs.variant}-${layer}`;
  return KEYS[id] ?? textureKeyFor(obs);
};

export const fireTextureKey = (): string => KEYS['fire:small'] ?? 'sw-fire-small-v4';
