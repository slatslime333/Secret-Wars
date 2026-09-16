import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { presentHero } from '../heroes/heroPortrait';
import type { HeroId } from '../heroes/roster';
import { heroSelectCopy } from '../heroes/selectCopy';
import { COLORS, FONTS, hex } from './theme';

export type HeroPickOption = {
  id: HeroId;
  current?: boolean;
};

/** Screen-space dropdown of legal heroes. Lives above scroll masks. */
export class HeroPickerMenu {
  private root?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene) {}

  get isOpen(): boolean {
    return Boolean(this.root);
  }

  close(): void {
    this.root?.destroy(true);
    this.root = undefined;
  }

  open(
    anchorX: number,
    anchorY: number,
    options: HeroPickOption[],
    team: TeamId,
    onPick: (id: HeroId) => void,
  ): void {
    this.close();
    if (options.length === 0) {
      return;
    }
    const width = Math.min(220, Math.max(168, this.scene.scale.width - 24));
    const rowH = 34;
    const height = Math.min(options.length * rowH + 10, Math.max(120, this.scene.scale.height - 24));
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const px = Phaser.Math.Clamp(anchorX, width / 2 + 8, sw - width / 2 - 8);
    const below = anchorY + 8 + height / 2;
    const py = Phaser.Math.Clamp(
      below + height / 2 > sh - 8 ? anchorY - 8 - height / 2 : below,
      height / 2 + 8,
      sh - height / 2 - 8,
    );
    const accent = team === 'alpha' ? COLORS.cyan : COLORS.redBright;
    const root = this.scene.add.container(0, 0).setDepth(420);
    const veil = this.scene.add.rectangle(sw / 2, sh / 2, sw, sh, COLORS.ink, 0.28);
    const panel = this.scene.add.rectangle(px, py, width, height, COLORS.ink, 0.97);
    panel.setStrokeStyle(2, accent);
    panel.setInteractive();
    root.add([veil, panel]);

    const top = py - height / 2 + 5;
    const visible = Math.min(options.length, Math.floor((height - 10) / rowH));
    options.slice(0, visible).forEach((opt, index) => {
      const rowY = top + index * rowH;
      const hit = this.scene.add.rectangle(px, rowY + rowH / 2, width - 8, rowH - 4, COLORS.panel, opt.current ? 0.98 : 0.82);
      hit.setStrokeStyle(1.4, opt.current ? COLORS.yellow : accent, opt.current ? 0.95 : 0.45);
      hit.setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => {
        this.close();
        onPick(opt.id);
      });
      const art = presentHero(this.scene, px - width / 2 + 28, rowY + 2, opt.id, {
        facing: 'south',
        team,
        scale: 0.52,
      });
      const name = this.scene.add
        .text(px - width / 2 + 50, rowY + rowH / 2, heroSelectCopy(opt.id).name.toUpperCase(), {
          fontFamily: FONTS.display,
          fontSize: '13px',
          color: hex(opt.current ? COLORS.yellow : COLORS.paper),
          letterSpacing: 1,
        })
        .setOrigin(0, 0.5);
      root.add([hit, art, name]);
    });

    this.root = root;
    veil.disableInteractive();
    this.scene.time.delayedCall(160, () => {
      if (this.root !== root) {
        return;
      }
      veil.setInteractive();
      veil.once(Phaser.Input.Events.POINTER_UP, () => this.close());
    });
  }

  destroy(): void {
    this.close();
  }
}
