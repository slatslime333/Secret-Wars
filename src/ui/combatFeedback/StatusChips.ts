import Phaser from 'phaser';
import type { NinjaBody } from '../../heroes/NinjaBody';
import { adoptHud } from '../layout/hudCamera';
import { COLORS, FONTS, hex } from '../theme';
import { selectStatusChips } from './format';

const MAX_CHIPS = 3;
const ROW = 13;

type StatusChipsOpts = {
  parent?: Phaser.GameObjects.Container;
  localX?: number;
  localY?: number;
  hud?: boolean;
};

/** Small labels stacked above the player's nameplate or HUD health bar. */
export class StatusChips {
  private readonly root: Phaser.GameObjects.Container;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly followWorld: boolean;
  private keys = '';

  constructor(scene: Phaser.Scene, opts: StatusChipsOpts = {}) {
    this.followWorld = !opts.parent && !opts.hud;
    this.root = scene.add.container(opts.localX ?? 0, opts.localY ?? 0).setDepth(opts.hud ? 208 : 27);
    const originX = opts.hud ? 0 : 0.5;
    for (let i = 0; i < MAX_CHIPS; i += 1) {
      const label = scene.add
        .text(0, 0, '', {
          fontFamily: FONTS.body,
          fontSize: '10px',
          fontStyle: 'bold',
          color: hex(COLORS.paper),
          stroke: hex(COLORS.ink),
          strokeThickness: 4,
          letterSpacing: 0.6,
        })
        .setOrigin(originX, 1)
        .setVisible(false);
      this.labels.push(label);
      this.root.add(label);
    }
    if (opts.parent) {
      opts.parent.add(this.root);
    }
    if (opts.hud) {
      this.root.setScrollFactor(0);
      adoptHud(scene, this.root);
    }
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  sync(body: NinjaBody, now: number, worldX?: number, worldY?: number): void {
    if (!body.isPresent || body.down) {
      this.root.setVisible(false);
      return;
    }
    this.root.setVisible(true);
    if (this.followWorld) {
      this.root.setPosition(worldX ?? body.x, worldY ?? body.y - 62);
    }
    const mods = selectStatusChips(body.status.playerFacingMods(now), MAX_CHIPS);
    const signature = mods.map((mod) => `${mod.key}:${mod.text}`).join('|');
    if (signature === this.keys) {
      return;
    }
    this.keys = signature;
    this.paint(mods);
  }

  setVisible(value: boolean): void {
    this.root.setVisible(value);
  }

  destroy(): void {
    this.root.destroy();
  }

  private paint(mods: ReturnType<typeof selectStatusChips>): void {
    for (let i = 0; i < this.labels.length; i += 1) {
      const label = this.labels[i];
      const mod = mods[i];
      if (!mod) {
        label.setVisible(false);
        continue;
      }
      label.setVisible(true);
      label.setText(mod.text);
      label.setColor(hex(mod.buff ? COLORS.cyan : COLORS.orange));
      label.setY(-i * ROW);
    }
  }
}
