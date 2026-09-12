import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { MINION, MinionKind, minionStatsOf } from '../config/minion';
import type { TeamId } from '../config/hero';
import { NinjaBody } from '../heroes/NinjaBody';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { drawRangerMinion, drawSwordMinion } from './drawMinion';
import { MinionBrain, MinionDebugInfo } from './MinionBrain';

export type MinionRecord = {
  body: NinjaBody;
  brain: MinionBrain;
  kind: MinionKind;
};

/**
 * Living minion set + spawn helpers. Wave timing is intentionally absent;
 * spawn points and composition live here so a later director can call in.
 */
export class MinionWorld {
  private readonly units: MinionRecord[] = [];
  private readonly debug: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.debug = scene.add.graphics().setDepth(24);
  }

  get size(): number {
    return this.units.filter((unit) => !unit.body.down).length;
  }

  allBodies(): NinjaBody[] {
    return this.units.map((unit) => unit.body);
  }

  livingBodies(): NinjaBody[] {
    return this.units.filter((unit) => !unit.body.down).map((unit) => unit.body);
  }

  spawn(kind: MinionKind, team: TeamId, x?: number, y?: number): MinionRecord | undefined {
    if (this.size >= MINION.wave.maxLiving) {
      return undefined;
    }
    const pad = ARENA.minionSpawns[team];
    const px = x ?? pad.x + (Math.random() - 0.5) * MINION.groupJitter;
    const py = y ?? pad.y + (Math.random() - 0.5) * MINION.groupJitter * 1.6;
    const body = new NinjaBody(this.scene, px, py, {
      team,
      rival: team === 'bravo',
      stats: minionStatsOf(kind),
      draw: kind === 'ranger' ? drawRangerMinion : drawSwordMinion,
      handSparks: false,
    });
    body.setAim(pad.facingX, 0);
    const brain = new MinionBrain(body, kind);
    const record = { body, brain, kind };
    this.units.push(record);
    return record;
  }

  spawnMany(kind: MinionKind, team: TeamId, count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.spawn(kind, team);
    }
  }

  spawnMixed(team: TeamId, swords = MINION.wave.defaultComposition.sword, rangers = MINION.wave.defaultComposition.ranger): void {
    this.spawnMany('sword', team, swords);
    this.spawnMany('ranger', team, rangers);
  }

  clear(): void {
    for (const unit of this.units) {
      unit.body.destroy();
    }
    this.units.length = 0;
    this.debug.clear();
    this.clearLabels();
  }

  update(now: number, delta: number, combatants: NinjaBody[], world: AbilityWorld): void {
    for (let i = this.units.length - 1; i >= 0; i -= 1) {
      const unit = this.units[i];
      if (unit.body.down) {
        this.fadeOut(unit);
        this.units.splice(i, 1);
        continue;
      }
      unit.body.syncView();
      unit.brain.update(now, delta, combatants, world, this.scene);
    }
    this.separate();
  }

  debugSnapshot(now: number): MinionDebugInfo[] {
    return this.units.map((unit) => unit.brain.debugInfo(now));
  }

  drawDebug(showRanges: boolean, showAi: boolean, showHitboxes: boolean, now: number): void {
    this.debug.clear();
    this.clearLabels();
    if (!showRanges && !showAi && !showHitboxes) {
      return;
    }
    for (const unit of this.units) {
      const { body, brain, kind } = unit;
      if (showHitboxes) {
        this.debug.lineStyle(1, body.team === 'alpha' ? 0x49dce1 : 0xff4d4d, 0.7);
        this.debug.strokeCircle(body.x, body.y, body.stats.bodyRadius);
      }
      if (showRanges) {
        this.debug.lineStyle(1, kind === 'ranger' ? 0xc8a060 : 0x8ecb5a, 0.35);
        this.debug.strokeCircle(body.x, body.y, body.stats.attackRange);
      }
      if (showAi) {
        const info = brain.debugInfo(now);
        const text = this.scene.add
          .text(body.x, body.y - 28, `${info.state}\n${info.targetLabel}`, {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#f6f1de',
            align: 'center',
          })
          .setOrigin(0.5, 1)
          .setDepth(25);
        this.labels.push(text);
        if (brain.target && !brain.target.down) {
          this.debug.lineStyle(1, 0xffc928, 0.55);
          this.debug.lineBetween(body.x, body.y, brain.target.x, brain.target.y);
        }
      }
    }
  }

  destroy(): void {
    this.clear();
    this.debug.destroy();
  }

  private separate(): void {
    const living = this.livingBodies();
    for (let i = 0; i < living.length; i += 1) {
      for (let j = i + 1; j < living.length; j += 1) {
        const a = living[i];
        const b = living[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1 || dist >= MINION.separateRadius) {
          continue;
        }
        const push = ((MINION.separateRadius - dist) / MINION.separateRadius) * MINION.separatePush;
        const nx = dx / dist;
        const ny = dy / dist;
        a.body?.setVelocity(a.body.velocity.x - nx * push, a.body.velocity.y - ny * push);
        b.body?.setVelocity(b.body.velocity.x + nx * push, b.body.velocity.y + ny * push);
      }
    }
  }

  private fadeOut(unit: MinionRecord): void {
    const view = unit.body.view;
    this.scene.tweens.add({
      targets: view,
      alpha: 0,
      scale: 0.4,
      duration: MINION.deathFadeMs,
      onComplete: () => unit.body.destroy(),
    });
  }

  private clearLabels(): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;
  }
}
