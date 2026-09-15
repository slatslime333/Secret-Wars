import Phaser from 'phaser';
import type { TacticalDebugInfo } from './types';

export type OverlaySubject = {
  x: number;
  y: number;
  debug: TacticalDebugInfo;
  target?: { x: number; y: number };
};

/** Lightweight labels for DEV_CHEATS.showAi. Hidden during normal play. */
export class TacticalOverlay {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private idle = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(26);
  }

  draw(subjects: OverlaySubject[], enabled: boolean): void {
    if (!enabled) {
      if (!this.idle) {
        this.gfx.clear();
        this.clearLabels();
        this.idle = true;
      }
      return;
    }
    this.idle = false;
    this.gfx.clear();
    this.clearLabels();
    for (const subject of subjects) {
      const info = subject.debug;
      const lines = [
        `${info.strategy} / ${info.opening}`,
        `${info.action}  ${info.targetLabel}`,
        `thr ${info.threat}  sc ${info.targetScore}${info.projectile ? '  SHOT' : ''}${info.regrouping ? '  REG' : ''}`,
        `rng ${info.preferredRange}${info.savedUlt ? '  saveUlt' : ''}  ${info.hp}`,
        info.reason,
      ];
      if (info.team) {
        lines.push(info.team);
      }
      if (info.objective) {
        lines.push(info.objective);
      }
      if (info.combatNote) {
        lines.push(info.combatNote);
      }
      const text = this.scene.add
        .text(subject.x, subject.y - 34, lines.join('\n'), {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#f6f1de',
          align: 'center',
        })
        .setOrigin(0.5, 1)
        .setDepth(27);
      this.labels.push(text);
      if (subject.target) {
        const color = info.flanking ? 0x7ad7ff : info.assisting ? 0x8ecb5a : 0xffc928;
        this.gfx.lineStyle(1, color, 0.55);
        this.gfx.lineBetween(subject.x, subject.y, subject.target.x, subject.target.y);
      }
    }
  }

  destroy(): void {
    this.gfx.destroy();
    this.clearLabels();
  }

  private clearLabels(): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;
  }
}
