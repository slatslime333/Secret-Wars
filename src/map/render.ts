import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { createCalmGround, type GroundView } from './ground';
import { ensureObstacleTextures, fireTextureKey, textureKeyFor } from './obstacles';
import type { MapLayout } from './types';

export type MapView = {
  crateSprites: Map<string, Phaser.GameObjects.Image>;
  destroy: () => void;
};

const depthFor = (kind: string, hierarchy: string): number => {
  if (kind === 'building') {
    return 6;
  }
  if (kind === 'vehicle' || kind === 'tree') {
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
  const fires: Phaser.GameObjects.Image[] = [];

  for (const obs of layout.obstacles) {
    const key = textureKeyFor(obs);
    const image = scene.add.image(obs.x, obs.y, key).setDepth(depthFor(obs.kind, obs.hierarchy));
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
    if (obs.kind === 'crate') {
      crateSprites.set(obs.id, image);
    }
    sprites.push(image);
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
    destroy: () => {
      ground.destroy();
      pads.destroy();
      for (const sprite of sprites) {
        sprite.destroy();
      }
      crateSprites.clear();
    },
  };
};

export type { GroundView };
