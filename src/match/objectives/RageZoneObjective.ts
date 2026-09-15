import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import type { HeroRuntime } from '../HeroRuntime';
import { occupancyNear } from './rewards';
import type { MatchObjective, ObjectiveCompleteEvent, ObjectiveContext, ObjectiveHint, ObjectiveUiState } from './types';

export type RageZoneDeps = {
  scene: Phaser.Scene;
  x: number;
  y: number;
};

export class RageZoneObjective implements MatchObjective {
  readonly kind = 'rage_zone' as const;
  readonly x: number;
  readonly y: number;
  readonly radius = OBJECTIVE.rage.radius;
  private readonly scene: Phaser.Scene;
  private readonly fill: Phaser.GameObjects.Arc;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barLabel: Phaser.GameObjects.Text;
  private endsAt = 0;
  private awarded = false;
  private pulse = 0;
  private readonly inside = new Set<HeroRuntime>();

  constructor(deps: RageZoneDeps) {
    this.scene = deps.scene;
    this.x = deps.x;
    this.y = deps.y;
    this.fill = deps.scene.add.circle(this.x, this.y, this.radius, COLORS.orange, 0.12).setDepth(5);
    this.ring = deps.scene.add.circle(this.x, this.y, this.radius, COLORS.orange, 0).setDepth(6);
    this.ring.setStrokeStyle(4, COLORS.orange, 0.92);
    this.gfx = deps.scene.add.graphics().setDepth(6);
    const track = deps.scene.add.rectangle(0, 0, 118, 12, COLORS.ink, 0.86).setStrokeStyle(1.6, COLORS.orange, 0.9);
    this.barFill = deps.scene.add.rectangle(-56, 0, 2, 8, COLORS.orange).setOrigin(0, 0.5);
    this.barLabel = deps.scene.add
      .text(0, -18, 'RAGE ZONE', {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: hex(COLORS.orange),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
        letterSpacing: 1,
      })
      .setOrigin(0.5, 1);
    this.barRoot = deps.scene.add.container(this.x, this.y - this.radius - 18, [track, this.barFill, this.barLabel]).setDepth(24);
  }

  spawn(now: number): void {
    this.awarded = false;
    this.endsAt = now + OBJECTIVE.rage.durationMs;
    audio.play('objective-spawn');
    this.redraw(now);
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.awarded || !ctx.playing) {
      this.clearAll();
      return undefined;
    }
    this.pulse += ctx.delta;
    this.syncBuffs(ctx.heroes);
    this.redraw(ctx.now);
    if (ctx.now >= this.endsAt) {
      this.awarded = true;
      this.clearAll();
      return { kind: this.kind };
    }
    return undefined;
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    const occ = occupancyNear(heroes, this.x, this.y, this.radius);
    const near = occupancyNear(heroes, this.x, this.y, this.radius + 220);
    const left = Math.max(0, this.endsAt - this.scene.time.now);
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      contested: occ.alpha > 0 && occ.bravo > 0,
      decaying: false,
      owner: null,
      selfProgress: 0,
      enemyProgress: 0,
      occupyingAllies: occ[team],
      occupyingEnemies: occ[team === 'alpha' ? 'bravo' : 'alpha'],
      nearbyAllies: near[team],
      nearbyEnemies: near[team === 'alpha' ? 'bravo' : 'alpha'],
      urgency: 0.22 + (1 - left / OBJECTIVE.rage.durationMs) * 0.1,
      remainingMs: left,
    };
  }

  ui(): ObjectiveUiState {
    const left = Math.max(0, this.endsAt - this.scene.time.now);
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      label: OBJECTIVE_LABEL[this.kind],
      owner: null,
      contested: false,
      decaying: false,
      progress: 1 - left / OBJECTIVE.rage.durationMs,
      alphaProgress: 0,
      bravoProgress: 0,
      barMode: 'single',
      remainingMs: left,
      prompt: 'Fight inside the Rage Zone!',
    };
  }

  cleanup(): void {
    this.awarded = true;
    this.clearAll();
    this.fill.destroy();
    this.ring.destroy();
    this.gfx.destroy();
    this.barRoot.destroy();
  }

  private syncBuffs(heroes: readonly HeroRuntime[]): void {
    const seen = new Set<HeroRuntime>();
    for (const hero of heroes) {
      const inside = hero.alive && Math.hypot(hero.body.x - this.x, hero.body.y - this.y) <= this.radius;
      if (inside) {
        seen.add(hero);
        hero.body.status.setEventModifiers({
          moveMul: OBJECTIVE.rage.moveMul,
          attackSpeedMul: OBJECTIVE.rage.attackMul,
          knockbackMul: OBJECTIVE.rage.knockbackMul,
        });
      } else if (this.inside.has(hero)) {
        hero.body.status.clearEventModifiers();
      }
    }
    this.inside.clear();
    for (const hero of seen) {
      this.inside.add(hero);
    }
  }

  private clearAll(): void {
    for (const hero of this.inside) {
      hero.body.status.clearEventModifiers();
    }
    this.inside.clear();
  }

  private redraw(now: number): void {
    const left = Math.max(0, this.endsAt - now) / OBJECTIVE.rage.durationMs;
    const glow = 0.12 + Math.sin(this.pulse * 0.01) * 0.04;
    this.fill.setFillStyle(COLORS.orange, glow);
    this.ring.setStrokeStyle(4, COLORS.redBright, 0.55 + Math.sin(this.pulse * 0.012) * 0.2);
    this.gfx.clear();
    this.gfx.lineStyle(2, COLORS.yellow, 0.28);
    this.gfx.strokeCircle(this.x, this.y, this.radius * 0.55);
    this.barFill.setSize(Math.max(2, 112 * left), 8);
    const secs = Math.ceil(Math.max(0, this.endsAt - now) / 1000);
    this.barLabel.setText(`RAGE ZONE  ${secs}s`);
  }
}
