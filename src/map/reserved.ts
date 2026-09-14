import { ARENA } from '../config/arena';
import { MAP, mapPlayable } from './config';
import { inflate, rectsOverlap } from './geometry';
import type { Rect, ReservedZone, SpawnZone } from './types';

const laneFlowHalf = 40;

export const spawnZonesOf = (): SpawnZone[] => {
  const zones: SpawnZone[] = [];
  for (const team of ['alpha', 'bravo'] as const) {
    for (const lane of ['top', 'mid', 'bottom'] as const) {
      const hero = ARENA.laneSpawns[team][lane];
      zones.push({
        team,
        role: 'hero',
        lane,
        x: hero.x,
        y: hero.y,
        radius: MAP.spawnHeroRadius,
      });
      zones.push({
        team,
        role: 'minion',
        lane,
        x: ARENA.minionSpawnX[team],
        y: ARENA.laneY[lane],
        radius: MAP.spawnMinionRadius,
      });
    }
  }
  return zones;
};

export const buildReservedZones = (playable: Rect, zones: SpawnZone[]): ReservedZone[] => {
  const reserved: ReservedZone[] = [];
  for (const zone of zones) {
    const r = zone.radius;
    reserved.push({
      kind: 'spawn',
      id: `spawn-${zone.team}-${zone.role}-${zone.lane}`,
      rect: { x: zone.x - r, y: zone.y - r, w: r * 2, h: r * 2 },
    });
  }

  reserved.push({
    kind: 'objective',
    id: 'objective-center',
    rect: { x: ARENA.width / 2 - 240, y: ARENA.height / 2 - 150, w: 480, h: 300 },
  });
  reserved.push({
    kind: 'objective',
    id: 'objective-north',
    rect: { x: ARENA.width / 2 - 200, y: ARENA.laneY.top - 90, w: 400, h: 180 },
  });
  reserved.push({
    kind: 'objective',
    id: 'objective-south',
    rect: { x: ARENA.width / 2 - 200, y: ARENA.laneY.bottom - 90, w: 400, h: 180 },
  });

  for (const lane of ['top', 'mid', 'bottom'] as const) {
    reserved.push({
      kind: 'lane-flow',
      id: `lane-${lane}`,
      rect: {
        x: playable.x + 24,
        y: ARENA.laneY[lane] - laneFlowHalf,
        w: playable.w - 48,
        h: laneFlowHalf * 2,
      },
    });
  }

  return reserved;
};

export const reservedBlocks = (collision: Rect, reserved: readonly ReservedZone[], pad = 4): boolean =>
  reserved.some((zone) => rectsOverlap(collision, inflate(zone.rect, pad)));

export const objectiveRects = (reserved: readonly ReservedZone[]): Rect[] =>
  reserved.filter((zone) => zone.kind === 'objective').map((zone) => zone.rect);

export const defaultPlayableReserved = (): { playable: Rect; reserved: ReservedZone[]; zones: SpawnZone[] } => {
  const playable = mapPlayable();
  const zones = spawnZonesOf();
  return { playable, zones, reserved: buildReservedZones(playable, zones) };
};
