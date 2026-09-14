import Phaser from 'phaser';
import { ENV } from './palette';
import type { MapLayout, PavementPatch, RoadMark } from './types';

const asphaltFor = (damage: PavementPatch['damage']): number => {
  if (damage === 'overgrown') {
    return 0x3a4a34;
  }
  if (damage === 'broken' || damage === 'missing') {
    return ENV.asphaltDark;
  }
  return ENV.asphalt;
};

const drawPatch = (g: Phaser.GameObjects.Graphics, patch: PavementPatch): void => {
  if (patch.damage === 'missing' && patch.kind !== 'intersection') {
    g.fillStyle(ENV.dirt, 0.85);
    g.fillRect(patch.x + 4, patch.y + 3, Math.max(8, patch.w - 8), Math.max(6, patch.h - 6));
    g.fillStyle(ENV.asphaltDark, 0.7);
    g.fillRect(patch.x, patch.y, 6, patch.h);
    g.fillRect(patch.x + patch.w - 6, patch.y, 6, patch.h);
    return;
  }
  if (patch.kind === 'sidewalk') {
    g.fillStyle(ENV.sidewalk, 1);
    g.fillRect(patch.x, patch.y, patch.w, patch.h);
    g.fillStyle(ENV.curb, 0.9);
    if (patch.heading === 'h') {
      g.fillRect(patch.x, patch.y + (patch.y < 0 ? 0 : patch.h - 3), patch.w, 3);
    } else {
      g.fillRect(patch.x + patch.w - 3, patch.y, 3, patch.h);
    }
    if (patch.damage === 'broken' || patch.damage === 'overgrown') {
      g.fillStyle(ENV.dirt, 0.7);
      g.fillRect(patch.x + patch.w * 0.3, patch.y + 2, 14, Math.max(4, patch.h - 4));
    }
    if (patch.damage === 'missing') {
      g.fillStyle(0x365a32, 1);
      g.fillRect(patch.x + 2, patch.y + 1, patch.w - 4, patch.h - 2);
    }
    return;
  }
  g.fillStyle(asphaltFor(patch.damage), 1);
  g.fillRect(patch.x, patch.y, patch.w, patch.h);
  g.fillStyle(ENV.asphaltLite, 0.28);
  if (patch.heading === 'h') {
    g.fillRect(patch.x + 8, patch.y + patch.h / 2 - 1, patch.w - 16, 2);
  } else {
    g.fillRect(patch.x + patch.w / 2 - 1, patch.y + 8, 2, patch.h - 16);
  }
  if (patch.kind === 'intersection') {
    g.fillStyle(ENV.asphaltDark, 0.35);
    g.fillRect(patch.x + 10, patch.y + 10, patch.w - 20, patch.h - 20);
    return;
  }
};

const drawMark = (g: Phaser.GameObjects.Graphics, mark: RoadMark): void => {
  if (mark.kind === 'crack') {
    g.fillStyle(ENV.inkSoft, 0.9);
    g.fillRect(mark.x, mark.y, mark.w, mark.h);
    return;
  }
  if (mark.kind === 'pothole' || mark.kind === 'hole') {
    g.fillStyle(ENV.asphaltDark, 1);
    g.fillRect(mark.x - mark.w / 2, mark.y - mark.h / 2, mark.w, mark.h);
    g.fillStyle(ENV.dirtDark, 0.85);
    g.fillRect(mark.x - mark.w / 2 + 2, mark.y - mark.h / 2 + 2, mark.w - 4, mark.h - 4);
    return;
  }
  if (mark.kind === 'grass') {
    g.fillStyle(0x3a6234, 0.95);
    g.fillRect(mark.x - 4, mark.y - 3, 9, 6);
    g.fillStyle(0x4a7040, 1);
    g.fillRect(mark.x - 2, mark.y - 5, 1, 5);
    g.fillRect(mark.x + 1, mark.y - 4, 1, 4);
    return;
  }
  if (mark.kind === 'burn') {
    g.fillStyle(ENV.burn, 0.7);
    g.fillRect(mark.x - mark.w / 2, mark.y - mark.h / 2, mark.w, mark.h);
    return;
  }
  g.fillStyle(ENV.dirt, 0.8);
  g.fillRect(mark.x - mark.w / 2, mark.y - mark.h / 2, mark.w, mark.h);
};

export const drawRoadNetwork = (g: Phaser.GameObjects.Graphics, layout: MapLayout): void => {
  for (const patch of layout.roads.patches) {
    if (patch.kind === 'road') {
      drawPatch(g, patch);
    }
  }
  for (const patch of layout.roads.patches) {
    if (patch.kind === 'intersection') {
      drawPatch(g, patch);
    }
  }
  for (const patch of layout.roads.patches) {
    if (patch.kind === 'sidewalk') {
      drawPatch(g, patch);
    }
  }
  for (const mark of layout.roads.marks) {
    drawMark(g, mark);
  }
};
