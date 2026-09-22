import Phaser from 'phaser';
import { ENV_WORLD } from '../config/environment';
import { COLORS, FONTS } from '../ui/theme';
import type { HouseDoor } from './types';
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
  if (kind === 'vehicle' || kind === 'tree' || kind === 'barrel' || kind === 'lamp') {
    return 5;
  }
  if (hierarchy === 'cover' || kind === 'crate' || kind === 'barricade' || kind === 'sandbag') {
    return 4;
  }
  return 3;
};

const drawHousePortals = (
  scene: Phaser.Scene,
  doors: HouseDoor[],
  visual: { h: number },
  anchorY: number,
  sprites: Phaser.GameObjects.GameObject[],
): void => {
  const gap = scene.add.graphics().setDepth(6);
  const badge = scene.add.graphics().setDepth(12);
  const top = anchorY - 0.78 * visual.h;
  const bottom = anchorY + 0.22 * visual.h;
  for (const door of doors) {
    const inbound = door.side === 'front';
    const accent = inbound ? 0xe0b060 : 0x49dce1;
    const wallY = inbound ? door.y - 20 : door.y + 20;
    const matY = inbound ? bottom + 18 : top - 20;
    gap.lineStyle(6, 0x101410, 1);
    gap.strokeRect(door.x - 42, wallY - 14, 84, 28);
    gap.lineStyle(3, accent, 1);
    gap.strokeRect(door.x - 36, wallY - 10, 72, 20);
    badge.lineStyle(3, accent, 0.95);
    badge.lineBetween(door.x, inbound ? wallY + 14 : wallY - 14, door.x, matY);
    badge.fillStyle(0x101410, 0.96);
    badge.fillRoundedRect(door.x - 28, matY - 14, 56, 28, 4);
    badge.fillStyle(accent, 1);
    badge.fillRoundedRect(door.x - 24, matY - 11, 48, 22, 3);
    badge.fillStyle(0x101410, 1);
    badge.fillTriangle(door.x - 16, matY - 2, door.x - 23, matY + 8, door.x - 9, matY + 8);
    const label = scene.add
      .text(door.x + 8, matY, inbound ? 'IN' : 'OUT', {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: '#101410',
      })
      .setOrigin(0.5)
      .setDepth(13);
    sprites.push(label);
  }
  sprites.push(gap, badge);
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
    } else if (obs.kind === 'fence' || obs.kind === 'lamp') {
      image.setOrigin(0.5, 0.82);
    }
    if (obs.kind === 'wall' && obs.collision.h > obs.collision.w) {
      image.setRotation(Math.PI / 2);
      image.setDisplaySize(Math.max(22, obs.collision.h), Math.max(18, obs.collision.w));
    } else if (obs.facing === 'v' && (obs.kind === 'vehicle' || obs.kind === 'barricade' || obs.kind === 'sandbag' || obs.kind === 'fence')) {
      image.setRotation(Math.PI / 2);
      image.setDisplaySize(obs.visual.h, obs.visual.w);
    }
    byId.set(obs.id, image);
    if (obs.kind === 'crate') {
      crateSprites.set(obs.id, image);
    }
    sprites.push(image);
    if (obs.enterable && obs.doors && obs.doors.length > 0) {
      drawHousePortals(scene, obs.doors, obs.visual, obs.y, sprites);
    }
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
