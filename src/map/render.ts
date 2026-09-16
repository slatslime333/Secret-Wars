import Phaser from 'phaser';
import { ENV_WORLD } from '../config/environment';
import { COLORS } from '../ui/theme';
import { createCalmGround, type GroundView } from './ground';
import { buildingLayerKey, ensureObstacleTextures, fireTextureKey, textureKeyFor } from './obstacles';
import type { MapLayout } from './types';

export type MapView = {
  crateSprites: Map<string, Phaser.GameObjects.Image>;
  sprites: Map<string, Phaser.GameObjects.Image>;
  roofs: Map<string, Phaser.GameObjects.Image>;
  floors: Map<string, Phaser.GameObjects.Image>;
  destroy: () => void;
};

const depthFor = (kind: string, hierarchy: string, enterable = false): number => {
  if (kind === 'building') {
    return enterable ? 5 : 6;
  }
  if (kind === 'vehicle' || kind === 'tree' || kind === 'barrel') {
    return 5;
  }
  if (hierarchy === 'cover' || kind === 'crate' || kind === 'barricade' || kind === 'sandbag') {
    return 4;
  }
  return 3;
};

const drawSpawnPads = (scene: Phaser.Scene, layout: MapLayout): Phaser.GameObjects.Graphics => {
  const g = scene.add.graphics().setDepth(2);
  for (const zone of layout.spawnZones) {
    if (zone.role !== 'hero') {
      continue;
    }
    const accent = zone.team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    g.fillStyle(0x1a211e, 0.55);
    g.fillCircle(zone.x, zone.y, 30);
    g.lineStyle(2, accent, 0.55);
    g.strokeCircle(zone.x, zone.y, 28);
    g.fillStyle(accent, 0.1);
    g.fillCircle(zone.x, zone.y, 16);
  }
  return g;
};

export const renderMapLayout = (scene: Phaser.Scene, layout: MapLayout): MapView => {
  ensureObstacleTextures(scene);
  const ground = createCalmGround(scene, layout);
  const pads = drawSpawnPads(scene, layout);
  const sprites: Phaser.GameObjects.GameObject[] = [];
  const crateSprites = new Map<string, Phaser.GameObjects.Image>();
  const byId = new Map<string, Phaser.GameObjects.Image>();
  const roofs = new Map<string, Phaser.GameObjects.Image>();
  const floors = new Map<string, Phaser.GameObjects.Image>();
  const fires: Phaser.GameObjects.Image[] = [];

  for (const obs of layout.obstacles) {
    if (obs.kind === 'building' && obs.enterable) {
      const floor = scene.add.image(obs.x, obs.y, buildingLayerKey(obs, 'floor')).setDepth(2);
      floor.setOrigin(0.5, 0.78);
      floor.setDisplaySize(obs.visual.w, obs.visual.h);
      floors.set(obs.id, floor);
      sprites.push(floor);
    }
    const key = obs.kind === 'building' && obs.enterable ? buildingLayerKey(obs, 'shell') : textureKeyFor(obs);
    const image = scene.add.image(obs.x, obs.y, key).setDepth(depthFor(obs.kind, obs.hierarchy, Boolean(obs.enterable)));
    image.setDisplaySize(obs.visual.w, obs.visual.h);
    if (obs.kind === 'tree') {
      image.setOrigin(0.5, 0.86);
    } else if (obs.kind === 'building') {
      image.setOrigin(0.5, 0.78);
    } else if (obs.kind === 'fence') {
      image.setOrigin(0.5, 0.82);
    }
    if (obs.kind === 'wall' && obs.collision.h > obs.collision.w) {
      image.setRotation(Math.PI / 2);
      image.setDisplaySize(Math.max(22, obs.collision.h), Math.max(18, obs.collision.w));
    }
    byId.set(obs.id, image);
    if (obs.kind === 'crate') {
      crateSprites.set(obs.id, image);
    }
    sprites.push(image);
    if (obs.kind === 'building') {
      const roof = scene.add.image(obs.x, obs.y, buildingLayerKey(obs, 'roof')).setDepth(ENV_WORLD.roofDepth);
      roof.setOrigin(0.5, 0.78);
      roof.setDisplaySize(obs.visual.w, obs.visual.h);
      roofs.set(obs.id, roof);
      sprites.push(roof);
    }
  }

  const fireKey = fireTextureKey();
  for (const mark of layout.decorations) {
    if (mark.kind !== 'fire') {
      continue;
    }
    const flame = scene.add.image(mark.x, mark.y, fireKey).setDepth(3);
    flame.setDisplaySize(14, 18);
    flame.setAlpha(0.85);
    scene.tweens.add({
      targets: flame,
      alpha: 0.45,
      scaleY: 1.12,
      duration: 240 + (mark.variant % 3) * 80,
      yoyo: true,
      repeat: -1,
    });
    fires.push(flame);
    sprites.push(flame);
  }

  return {
    crateSprites,
    sprites: byId,
    roofs,
    floors,
    destroy: () => {
      ground.destroy();
      pads.destroy();
      for (const sprite of sprites) {
        sprite.destroy();
      }
      crateSprites.clear();
      byId.clear();
      roofs.clear();
      floors.clear();
    },
  };
};

export type { GroundView };
