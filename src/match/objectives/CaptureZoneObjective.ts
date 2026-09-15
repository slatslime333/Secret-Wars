import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import type { HeroRuntime } from '../HeroRuntime';
import { emptyCapture, tickCapture, type CaptureSnap } from './captureLogic';
import type { MatchObjective, ObjectiveCompleteEvent, ObjectiveContext, ObjectiveHint, ObjectiveUiState } from './types';

const TEAM_COLOR: Record<TeamId, number> = {
  alpha: COLORS.cyan,
  bravo: COLORS.redBright,
};

export type CaptureZoneDeps = {
  scene: Phaser.Scene;
  x: number;
  y: number;
};

export class CaptureZoneObjective implements MatchObjective {
  readonly kind = 'capture_zone' as const;
  readonly x: number;
  readonly y: number;
  readonly radius = OBJECTIVE.capture.radius;
  private readonly scene: Phaser.Scene;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Arc;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly barTrack: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barLabel: Phaser.GameObjects.Text;
  private snap: CaptureSnap = emptyCapture();
  private awarded = false;
  private pulse = 0;

  constructor(deps: CaptureZoneDeps) {
    this.scene = deps.scene;
    this.x = deps.x;
    this.y = deps.y;
    this.gfx = deps.scene.add.graphics().setDepth(6);
    this.fill = deps.scene.add.circle(this.x, this.y, this.radius, 0xf6f1de, 0.1).setDepth(5);
    this.ring = deps.scene.add.circle(this.x, this.y, this.radius, 0xf6f1de, 0).setDepth(6);
    this.ring.setStrokeStyle(3, COLORS.paper, 0.85);
    this.barTrack = deps.scene.add.rectangle(0, 0, 118, 12, COLORS.ink, 0.86).setStrokeStyle(1.6, COLORS.paper, 0.85);
    this.barFill = deps.scene.add.rectangle(-56, 0, 2, 8, COLORS.paper).setOrigin(0, 0.5);
    this.barLabel = deps.scene.add
      .text(0, -18, 'NEUTRAL', {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
        letterSpacing: 1,
      })
      .setOrigin(0.5, 1);
    this.barRoot = deps.scene.add.container(this.x, this.y - this.radius - 18, [this.barTrack, this.barFill, this.barLabel]).setDepth(24);
  }

  spawn(now: number): void {
    void now;
    this.awarded = false;
    this.snap = emptyCapture();
    audio.play('objective-spawn');
    this.redraw(0);
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.awarded || !ctx.playing) {
      return undefined;
    }
    const occupancy = { alpha: 0, bravo: 0 };
    for (const hero of ctx.heroes) {
      if (!hero.alive) {
        continue;
      }
      if (Math.hypot(hero.body.x - this.x, hero.body.y - this.y) > this.radius) {
        continue;
      }
      occupancy[hero.team] += 1;
    }
    const previous = this.snap.phase;
    const result = tickCapture(this.snap, occupancy, ctx.delta);
    this.snap = result.snap;
    this.pulse += ctx.delta;
    if (this.snap.phase === 'contested' && previous !== 'contested') {
      audio.play('objective-contested');
    }
    this.redraw(ctx.now);
    if (result.capturedBy && !this.awarded) {
      this.awarded = true;
      audio.play('objective-complete');
      this.burst(result.capturedBy);
      return { kind: this.kind, winner: result.capturedBy };
    }
    return undefined;
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    const occ = this.occupancyNear(heroes, this.radius);
    const near = this.occupancyNear(heroes, this.radius + 220);
    const selfProgress = this.snap.owner === team ? this.snap.progress : 0;
    const enemyProgress = this.snap.owner && this.snap.owner !== team ? this.snap.progress : 0;
    const occupyingAllies = occ[team];
    const occupyingEnemies = occ[team === 'alpha' ? 'bravo' : 'alpha'];
    let urgency = 0.35 + selfProgress * 0.35 + enemyProgress * 0.45;
    if (this.snap.phase === 'contested') {
      urgency += 0.12;
    }
    if (this.snap.phase === 'decaying' && this.snap.owner === team) {
      urgency += 0.18;
    }
    if (occupyingEnemies > occupyingAllies) {
      urgency += 0.08;
    }
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      contested: this.snap.phase === 'contested',
      decaying: this.snap.phase === 'decaying',
      owner: this.snap.owner,
      selfProgress,
      enemyProgress,
      occupyingAllies,
      occupyingEnemies,
      nearbyAllies: near[team],
      nearbyEnemies: near[team === 'alpha' ? 'bravo' : 'alpha'],
      urgency: Math.max(0, Math.min(1, urgency)),
    };
  }

  ui(): ObjectiveUiState {
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      label: OBJECTIVE_LABEL[this.kind],
      owner: this.snap.owner,
      contested: this.snap.phase === 'contested',
      decaying: this.snap.phase === 'decaying',
      progress: this.snap.progress,
      alphaProgress: this.snap.owner === 'alpha' ? this.snap.progress : 0,
      bravoProgress: this.snap.owner === 'bravo' ? this.snap.progress : 0,
      barMode: 'single',
      prompt: 'Control the zone!',
    };
  }

  cleanup(): void {
    this.gfx.destroy();
    this.fill.destroy();
    this.ring.destroy();
    this.barRoot.destroy();
  }

  private occupancyNear(heroes: readonly HeroRuntime[], radius: number): { alpha: number; bravo: number } {
    const occ = { alpha: 0, bravo: 0 };
    for (const hero of heroes) {
      if (!hero.alive) {
        continue;
      }
      if (Math.hypot(hero.body.x - this.x, hero.body.y - this.y) <= radius) {
        occ[hero.team] += 1;
      }
    }
    return occ;
  }

  private burst(team: TeamId): void {
    const color = TEAM_COLOR[team];
    const ring = this.scene.add.circle(this.x, this.y, this.radius * 0.4, color, 0.28).setDepth(20);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private redraw(now: number): void {
    void now;
    const { owner, progress, phase } = this.snap;
    let color: number = COLORS.paper;
    let fillAlpha = 0.1;
    let label = 'NEUTRAL';
    if (phase === 'contested') {
      color = COLORS.orange;
      fillAlpha = 0.16 + Math.sin(this.pulse * 0.012) * 0.05;
      label = 'CONTESTED';
    } else if (owner) {
      color = TEAM_COLOR[owner];
      fillAlpha = 0.14 + progress * 0.1;
      if (phase === 'decaying') {
        label = 'LOSING';
        fillAlpha = 0.1 + Math.sin(this.pulse * 0.02) * 0.06;
      } else if (phase === 'grace') {
        label = owner === 'alpha' ? 'ALPHA HOLD' : 'BRAVO HOLD';
      } else {
        label = owner === 'alpha' ? 'ALPHA' : 'BRAVO';
      }
    }
    this.fill.setFillStyle(color, fillAlpha);
    this.ring.setStrokeStyle(3.2, color, phase === 'contested' ? 0.95 : 0.88);
    this.gfx.clear();
    this.gfx.lineStyle(2, color, 0.35);
    this.gfx.strokeCircle(this.x, this.y, this.radius * 0.42);
    const width = 112 * Math.max(0.02, progress);
    this.barFill.setFillStyle(phase === 'contested' ? COLORS.orange : color, 1);
    this.barFill.setSize(width, 8);
    this.barFill.setAlpha(phase === 'decaying' ? 0.7 + Math.sin(this.pulse * 0.02) * 0.25 : 1);
    this.barLabel.setText(label).setColor(hex(phase === 'contested' ? COLORS.orange : color));
  }
}
