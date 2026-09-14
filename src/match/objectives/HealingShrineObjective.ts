import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import type { HeroRuntime } from '../HeroRuntime';
import { occupancyNear } from './rewards';
import { shrineControlOf } from './shrineLogic';
import type { MatchObjective, ObjectiveCompleteEvent, ObjectiveContext, ObjectiveHint, ObjectiveUiState } from './types';

const TEAM_COLOR: Record<TeamId, number> = {
  alpha: COLORS.cyan,
  bravo: COLORS.redBright,
};

export type ShrineDeps = {
  scene: Phaser.Scene;
  x: number;
  y: number;
};

export class HealingShrineObjective implements MatchObjective {
  readonly kind = 'healing_shrine' as const;
  readonly x: number;
  readonly y: number;
  readonly radius = OBJECTIVE.shrine.radius;
  private readonly scene: Phaser.Scene;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Arc;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly pedestal: Phaser.GameObjects.Container;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barLabel: Phaser.GameObjects.Text;
  private owner: TeamId | null = null;
  private contested = false;
  private endsAt = 0;
  private pulse = 0;
  private started = false;
  private finished = false;
  private wasContested = false;

  constructor(deps: ShrineDeps) {
    this.scene = deps.scene;
    this.x = deps.x;
    this.y = deps.y;
    this.gfx = deps.scene.add.graphics().setDepth(6);
    this.fill = deps.scene.add.circle(this.x, this.y, this.radius, COLORS.green, 0.1).setDepth(5);
    this.ring = deps.scene.add.circle(this.x, this.y, this.radius, COLORS.green, 0).setDepth(6);
    this.ring.setStrokeStyle(3.2, COLORS.green, 0.9);
    const base = deps.scene.add.ellipse(0, 18, 46, 18, 0x3a4a32, 1).setStrokeStyle(3, COLORS.ink, 0.9);
    const stone = deps.scene.add.rectangle(0, 4, 28, 36, 0x8aa67a, 1).setStrokeStyle(3, 0x2a3a24, 1);
    const gem = deps.scene.add.circle(0, -10, 11, COLORS.green, 1).setStrokeStyle(2, COLORS.ink, 0.9);
    const glow = deps.scene.add.circle(0, -10, 18, COLORS.green, 0.28);
    this.pedestal = deps.scene.add.container(this.x, this.y, [glow, base, stone, gem]).setDepth(8);
    const track = deps.scene.add.rectangle(0, 0, 118, 12, COLORS.ink, 0.86).setStrokeStyle(1.6, COLORS.green, 0.9);
    this.barFill = deps.scene.add.rectangle(-56, 0, 2, 8, COLORS.green).setOrigin(0, 0.5);
    this.barLabel = deps.scene.add
      .text(0, -18, 'SHRINE', {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: hex(COLORS.green),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
        letterSpacing: 1,
      })
      .setOrigin(0.5, 1);
    this.barRoot = deps.scene.add.container(this.x, this.y - this.radius - 18, [track, this.barFill, this.barLabel]).setDepth(24);
  }

  spawn(now: number): void {
    this.started = true;
    this.finished = false;
    this.endsAt = now + OBJECTIVE.shrine.durationMs;
    audio.play('objective-spawn');
    this.redraw(now);
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.finished || !this.started || !ctx.playing) {
      return undefined;
    }
    const occ = occupancyNear(ctx.heroes, this.x, this.y, this.radius);
    const control = shrineControlOf(occ.alpha, occ.bravo);
    this.owner = control.owner;
    this.contested = control.contested;
    if (this.contested && !this.wasContested) {
      audio.play('objective-contested');
    }
    this.wasContested = this.contested;
    this.pulse += ctx.delta;
    if (this.owner && !this.contested) {
      const heal = (OBJECTIVE.shrine.healPerSecond * ctx.delta) / 1000;
      for (const hero of ctx.heroes) {
        if (hero.team !== this.owner || !hero.alive) {
          continue;
        }
        if (Math.hypot(hero.body.x - this.x, hero.body.y - this.y) > this.radius) {
          continue;
        }
        hero.body.heal(heal);
      }
    }
    this.redraw(ctx.now);
    if (ctx.now >= this.endsAt) {
      this.finished = true;
      return { kind: this.kind };
    }
    return undefined;
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    const occ = occupancyNear(heroes, this.x, this.y, this.radius);
    const near = occupancyNear(heroes, this.x, this.y, this.radius + 220);
    const left = this.started ? Math.max(0, this.endsAt - this.scene.time.now) / OBJECTIVE.shrine.durationMs : 1;
    let urgency = 0.28 + (1 - left) * 0.12;
    if (this.contested) {
      urgency += 0.16;
    }
    if (this.owner === team) {
      urgency += 0.1;
    }
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      contested: this.contested,
      decaying: false,
      owner: this.owner,
      selfProgress: this.owner === team ? 1 : 0,
      enemyProgress: this.owner && this.owner !== team ? 1 : 0,
      occupyingAllies: occ[team],
      occupyingEnemies: occ[team === 'alpha' ? 'bravo' : 'alpha'],
      nearbyAllies: near[team],
      nearbyEnemies: near[team === 'alpha' ? 'bravo' : 'alpha'],
      urgency: Math.max(0, Math.min(1, urgency)),
    };
  }

  ui(): ObjectiveUiState {
    const left = this.started ? Math.max(0, this.endsAt - this.scene.time.now) / OBJECTIVE.shrine.durationMs : 1;
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      label: OBJECTIVE_LABEL[this.kind],
      owner: this.owner,
      contested: this.contested,
      decaying: false,
      progress: 1 - left,
      alphaProgress: this.owner === 'alpha' ? 1 : 0,
      bravoProgress: this.owner === 'bravo' ? 1 : 0,
      barMode: 'single',
    };
  }

  cleanup(): void {
    this.finished = true;
    this.owner = null;
    this.contested = false;
    this.gfx.destroy();
    this.fill.destroy();
    this.ring.destroy();
    this.pedestal.destroy();
    this.barRoot.destroy();
  }

  private redraw(now: number): void {
    const left = Math.max(0, this.endsAt - now) / OBJECTIVE.shrine.durationMs;
    let color: number = COLORS.green;
    let fillAlpha = 0.1 + Math.sin(this.pulse * 0.008) * 0.04;
    let label = 'NEUTRAL';
    if (this.contested) {
      color = COLORS.orange;
      fillAlpha = 0.16 + Math.sin(this.pulse * 0.014) * 0.05;
      label = 'CONTESTED';
    } else if (this.owner) {
      color = TEAM_COLOR[this.owner];
      fillAlpha = 0.16;
      label = this.owner === 'alpha' ? 'ALPHA HEAL' : 'BRAVO HEAL';
    }
    this.fill.setFillStyle(color, fillAlpha);
    this.ring.setStrokeStyle(3.2, color, this.contested ? 0.95 : 0.88);
    this.gfx.clear();
    this.gfx.lineStyle(2, color, 0.32);
    this.gfx.strokeCircle(this.x, this.y, this.radius * 0.45);
    this.barFill.setFillStyle(color, 1);
    this.barFill.setSize(Math.max(2, 112 * left), 8);
    this.barLabel.setText(label).setColor(hex(this.contested ? COLORS.orange : color));
    this.pedestal.setScale(1 + Math.sin(this.pulse * 0.01) * 0.03);
  }
}
