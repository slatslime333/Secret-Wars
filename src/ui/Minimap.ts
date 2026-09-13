import Phaser from 'phaser';
import { layoutHudChrome } from './layout/hudChrome';
import { adoptHud } from './layout/hudCamera';
import { measureViewport } from './layout/viewport';
import { COLORS } from './theme';
import type { MapLayout } from '../map/types';
import type { NinjaBody } from '../heroes/NinjaBody';
import type { TeamId } from '../config/hero';

type MinimapSource = {
  layout: MapLayout;
  player: NinjaBody;
  heroes: NinjaBody[];
  minions: NinjaBody[];
  objective?: { x: number; y: number; kind: string };
};

/**
 * Player-centered radar. Terrain is faint; heroes read bigger than minions.
 */
export class Minimap {
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly art: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;
  private readonly rangeX = 640;
  private readonly rangeY = 460;

  constructor(scene: Phaser.Scene) {
    const frame = measureViewport(scene.scale.width, scene.scale.height);
    const chrome = layoutHudChrome(frame);
    this.width = chrome.minimap.width;
    this.height = chrome.minimap.height;
    this.root = scene.add.container(chrome.minimap.x, chrome.minimap.y).setScrollFactor(0).setDepth(108);
    this.frame = scene.add
      .rectangle(-this.width, 0, this.width, this.height, 0x0b100e, 0.72)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.paper, 0.55);
    this.art = scene.add.graphics();
    this.root.add([this.frame, this.art]);
    adoptHud(scene, this.root);
    this.layout(scene.scale.width, scene.scale.height);
  }

  layout(viewWidth: number, viewHeight = 0): void {
    const chrome = layoutHudChrome(measureViewport(viewWidth, viewHeight || 1));
    if (chrome.minimap.width !== this.width || chrome.minimap.height !== this.height) {
      this.width = chrome.minimap.width;
      this.height = chrome.minimap.height;
      this.frame.setPosition(-this.width, 0).setSize(this.width, this.height);
    }
    this.root.setPosition(chrome.minimap.x, chrome.minimap.y);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  sync(source: MinimapSource): void {
    const { player, layout } = source;
    this.art.clear();
    const left = -this.width;
    this.art.fillStyle(0x2a4a28, 0.95);
    this.art.fillRect(left + 2, 2, this.width - 4, this.height - 4);

    for (const obs of layout.obstacles) {
      const p = this.project(obs.x, obs.y, player.x, player.y);
      if (!p) {
        continue;
      }
      this.art.fillStyle(obs.kind === 'tree' ? 0x1f3a1c : obs.kind === 'wall' ? 0x4a4f46 : 0x7a5a28, 0.85);
      this.art.fillRect(p.x - 1.5, p.y - 1.5, obs.kind === 'wall' ? 4 : 3, 3);
    }

    for (const minion of source.minions) {
      if (!minion.isPresent || minion.down) {
        continue;
      }
      const p = this.project(minion.x, minion.y, player.x, player.y);
      if (!p) {
        continue;
      }
      this.art.fillStyle(teamColor(minion.team), 0.95);
      this.art.fillCircle(p.x, p.y, 2.2);
    }

    for (const hero of source.heroes) {
      if (!hero.isPresent || hero.down) {
        continue;
      }
      const p = this.project(hero.x, hero.y, player.x, player.y);
      if (!p) {
        continue;
      }
      const self = hero === player;
      this.art.fillStyle(teamColor(hero.team), 1);
      this.art.fillCircle(p.x, p.y, self ? 5 : 4);
      if (self) {
        this.art.lineStyle(1, COLORS.paper, 0.95);
        this.art.strokeCircle(p.x, p.y, 6);
      }
    }

    if (source.objective) {
      const p = this.project(source.objective.x, source.objective.y, player.x, player.y);
      if (p) {
        this.art.fillStyle(COLORS.yellow, 1);
        this.art.fillCircle(p.x, p.y, 3.4);
        this.art.lineStyle(1, COLORS.paper, 0.95);
        this.art.strokeCircle(p.x, p.y, 5);
      }
    }
  }

  destroy(): void {
    this.root.destroy();
  }

  private project(x: number, y: number, originX: number, originY: number): { x: number; y: number } | undefined {
    const nx = (x - originX) / this.rangeX;
    const ny = (y - originY) / this.rangeY;
    const px = -this.width / 2 + nx * (this.width / 2 - 8);
    const py = this.height / 2 + ny * (this.height / 2 - 8);
    if (px < -this.width + 4 || px > -4 || py < 4 || py > this.height - 4) {
      return undefined;
    }
    return { x: px, y: py };
  }
}

const teamColor = (team: TeamId): number => (team === 'alpha' ? COLORS.cyan : COLORS.redBright);
