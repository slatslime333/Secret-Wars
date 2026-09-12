import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import { createCalmGround, type GroundView } from './ground';
import { ensureObstacleTextures, textureKeyFor } from './obstacles';
import type { MapLayout } from './types';

export type MapView = {
  destroy: () => void;
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

  for (const obs of layout.obstacles) {
    const key = textureKeyFor(obs);
    const variant = obs.variant;
    const image = scene.add.image(obs.x, obs.y, key).setDepth(obs.kind === 'tree' ? 5 : 4);
    if (obs.kind === 'wall') {
      if (obs.collision.h > obs.collision.w) {
        image.setRotation(Math.PI / 2);
        image.setDisplaySize(Math.max(18, obs.collision.h), 18);
      } else {
        image.setDisplaySize(obs.collision.w, Math.max(16, obs.collision.h));
      }
    } else if (obs.kind === 'tree') {
      image.setOrigin(0.5, 0.86);
      image.setScale(variant === 'broad' ? 1.25 : variant === 'medium' ? 1.2 : 1.15);
    } else if (obs.kind === 'crate') {
      image.setScale(variant === 'pair' ? 1.15 : 1.2);
    }
    sprites.push(image);
  }

  return {
    destroy: () => {
      ground.destroy();
      pads.destroy();
      for (const sprite of sprites) {
        sprite.destroy();
      }
    },
  };
};

export type { GroundView };
