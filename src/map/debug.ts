import Phaser from 'phaser';
import { COLORS } from '../ui/theme';
import type { MapLayout } from './types';

export class MapDebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  visible = false;

  constructor(
    scene: Phaser.Scene,
    private layout: MapLayout,
  ) {
    this.graphics = scene.add.graphics().setDepth(26);
  }

  setLayout(layout: MapLayout): void {
    this.layout = layout;
    this.redraw();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.redraw();
  }

  toggle(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private redraw(): void {
    this.graphics.clear();
    if (!this.visible) {
      return;
    }
    const regions = this.layout.regions;
    this.graphics.lineStyle(1, 0x89c4ff, 0.35);
    this.graphics.strokeRect(regions.north.x, regions.north.y, regions.north.w, regions.north.h);
    this.graphics.lineStyle(1, 0xffc928, 0.35);
    this.graphics.strokeRect(regions.center.x, regions.center.y, regions.center.w, regions.center.h);
    this.graphics.lineStyle(1, 0x7dff9a, 0.35);
    this.graphics.strokeRect(regions.south.x, regions.south.y, regions.south.w, regions.south.h);

    for (const zone of this.layout.spawnZones) {
      this.graphics.lineStyle(1, zone.role === 'hero' ? COLORS.yellow : COLORS.paper, 0.45);
      this.graphics.strokeCircle(zone.x, zone.y, zone.radius);
    }

    for (const obs of this.layout.obstacles) {
      this.graphics.lineStyle(1, obs.kind === 'tree' ? 0x8ecb5a : obs.kind === 'wall' ? 0xc8c8c8 : 0xd4a050, 0.85);
      this.graphics.strokeRect(obs.collision.x, obs.collision.y, obs.collision.w, obs.collision.h);
    }

    for (const route of this.layout.routes) {
      this.graphics.lineStyle(2, route.id === 'direct' ? 0xffc928 : 0x49dce1, 0.55);
      for (let i = 1; i < route.waypoints.length; i += 1) {
        const a = route.waypoints[i - 1];
        const b = route.waypoints[i];
        this.graphics.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }
}
