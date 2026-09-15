import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import { applyDefense } from '../../combat/damage';
import type { HeroRuntime } from '../HeroRuntime';
import type { MapQuery } from '../../map/query';
import { pickFightCluster } from './pickLocation';
import type {
  MatchObjective,
  ObjectiveCompleteEvent,
  ObjectiveContext,
  ObjectiveHazard,
  ObjectiveHint,
  ObjectiveUiState,
} from './types';

type Strike = {
  x: number;
  y: number;
  impactAt: number;
  ring: Phaser.GameObjects.Arc;
  fill: Phaser.GameObjects.Arc;
};

export type MeteorStormDeps = {
  scene: Phaser.Scene;
  query: MapQuery;
  rng: () => number;
  heroes: () => readonly HeroRuntime[];
};

export class MeteorStormObjective implements MatchObjective {
  readonly kind = 'meteor_storm' as const;
  readonly radius = OBJECTIVE.meteor.impactRadius;
  private readonly scene: Phaser.Scene;
  private readonly query: MapQuery;
  private readonly rng: () => number;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barLabel: Phaser.GameObjects.Text;
  private posX: number;
  private posY: number;
  private endsAt = 0;
  private nextAt = 0;
  private awarded = false;
  private readonly strikes: Strike[] = [];

  constructor(deps: MeteorStormDeps) {
    this.scene = deps.scene;
    this.query = deps.query;
    this.rng = deps.rng;
    const start = pickFightCluster(deps.heroes(), deps.rng);
    this.posX = start.x;
    this.posY = start.y;
    this.gfx = deps.scene.add.graphics().setDepth(7);
    const track = deps.scene.add.rectangle(0, 0, 118, 12, COLORS.ink, 0.86).setStrokeStyle(1.6, COLORS.orange, 0.9);
    this.barFill = deps.scene.add.rectangle(-56, 0, 2, 8, COLORS.orange).setOrigin(0, 0.5);
    this.barLabel = deps.scene.add
      .text(0, -18, 'METEOR STORM', {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: hex(COLORS.orange),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
        letterSpacing: 1,
      })
      .setOrigin(0.5, 1);
    this.barRoot = deps.scene.add.container(this.posX, this.posY - 48, [track, this.barFill, this.barLabel]).setDepth(24);
  }

  get x(): number {
    return this.posX;
  }

  get y(): number {
    return this.posY;
  }

  spawn(now: number): void {
    this.awarded = false;
    this.endsAt = now + OBJECTIVE.meteor.durationMs;
    this.nextAt = now + OBJECTIVE.meteor.firstDelayMs;
    audio.play('objective-spawn');
    this.redrawHud(now);
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.awarded || !ctx.playing) {
      return undefined;
    }
    if (ctx.now >= this.nextAt && ctx.now < this.endsAt - OBJECTIVE.meteor.warningMs) {
      this.retarget(ctx);
      for (let n = 0; n < OBJECTIVE.meteor.strikesPerWave; n += 1) {
        this.queueStrike(ctx);
      }
      this.nextAt = ctx.now + OBJECTIVE.meteor.intervalMs;
    }
    this.resolveStrikes(ctx);
    this.redrawHud(ctx.now);
    if (ctx.now >= this.endsAt && this.strikes.length === 0) {
      this.awarded = true;
      return { kind: this.kind };
    }
    return undefined;
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    void team;
    void heroes;
    const left = Math.max(0, this.endsAt - this.scene.time.now);
    return {
      kind: this.kind,
      x: this.posX,
      y: this.posY,
      radius: this.radius,
      contested: false,
      decaying: false,
      owner: null,
      selfProgress: 0,
      enemyProgress: 0,
      occupyingAllies: 0,
      occupyingEnemies: 0,
      nearbyAllies: 0,
      nearbyEnemies: 0,
      urgency: 0.18,
      remainingMs: left,
      hazards: this.hazards(),
    };
  }

  ui(): ObjectiveUiState {
    const left = Math.max(0, this.endsAt - this.scene.time.now);
    return {
      kind: this.kind,
      x: this.posX,
      y: this.posY,
      radius: this.radius,
      label: OBJECTIVE_LABEL[this.kind],
      owner: null,
      contested: false,
      decaying: false,
      progress: 1 - left / OBJECTIVE.meteor.durationMs,
      alphaProgress: 0,
      bravoProgress: 0,
      barMode: 'single',
      remainingMs: left,
      prompt: 'Dodge incoming meteors!',
    };
  }

  cleanup(): void {
    this.awarded = true;
    for (const strike of this.strikes) {
      strike.ring.destroy();
      strike.fill.destroy();
    }
    this.strikes.length = 0;
    this.gfx.destroy();
    this.barRoot.destroy();
  }

  private hazards(): ObjectiveHazard[] {
    return this.strikes.map((strike) => ({
      x: strike.x,
      y: strike.y,
      radius: OBJECTIVE.meteor.impactRadius,
      impactAt: strike.impactAt,
    }));
  }

  private retarget(ctx: ObjectiveContext): void {
    const cluster = pickFightCluster(ctx.heroes, this.rng);
    this.posX = cluster.x;
    this.posY = cluster.y;
    this.barRoot.setPosition(this.posX, this.posY - 48);
  }

  private queueStrike(ctx: ObjectiveContext): void {
    let point = pickFightCluster(ctx.heroes, this.rng);
    if (!this.query.clearForObjective(point.x, point.y, 18)) {
      point = { x: this.posX + (this.rng() - 0.5) * 80, y: this.posY + (this.rng() - 0.5) * 80 };
    }
    const ring = this.scene.add.circle(point.x, point.y, OBJECTIVE.meteor.impactRadius, COLORS.orange, 0).setDepth(8);
    ring.setStrokeStyle(5, COLORS.yellow, 0.95);
    const fill = this.scene.add.circle(point.x, point.y, OBJECTIVE.meteor.impactRadius, COLORS.redBright, 0.18).setDepth(7);
    this.strikes.push({ x: point.x, y: point.y, impactAt: ctx.now + OBJECTIVE.meteor.warningMs, ring, fill });
  }

  private resolveStrikes(ctx: ObjectiveContext): void {
    for (let i = this.strikes.length - 1; i >= 0; i -= 1) {
      const strike = this.strikes[i];
      if (!strike) {
        continue;
      }
      const left = Math.max(0, strike.impactAt - ctx.now);
      const warn = 1 - left / OBJECTIVE.meteor.warningMs;
      strike.fill.setAlpha(0.14 + warn * 0.22);
      strike.ring.setStrokeStyle(5 + warn * 4, warn > 0.65 ? COLORS.redBright : COLORS.yellow, 0.85 + warn * 0.15);
      if (ctx.now < strike.impactAt) {
        continue;
      }
      this.impact(strike, ctx.heroes);
      strike.ring.destroy();
      strike.fill.destroy();
      this.strikes.splice(i, 1);
    }
  }

  private impact(strike: Strike, heroes: readonly HeroRuntime[]): void {
    audio.play('objective-contested');
    const burst = this.scene.add.circle(strike.x, strike.y, 18, COLORS.orange, 0.7).setDepth(21);
    this.scene.tweens.add({
      targets: burst,
      scale: 3.2,
      alpha: 0,
      duration: 280,
      onComplete: () => burst.destroy(),
    });
    for (const hero of heroes) {
      if (!hero.alive) {
        continue;
      }
      const dx = hero.body.x - strike.x;
      const dy = hero.body.y - strike.y;
      const dist = Math.hypot(dx, dy);
      if (dist > OBJECTIVE.meteor.impactRadius + hero.body.stats.bodyRadius) {
        continue;
      }
      const dirX = dist < 4 ? (this.rng() - 0.5) : dx;
      const dirY = dist < 4 ? (this.rng() - 0.5) : dy;
      hero.body.takeHit({
        damage: applyDefense(OBJECTIVE.meteor.damage, hero.body.defense),
        dirX,
        dirY,
        knockback: OBJECTIVE.meteor.knockback,
        staminaDamage: 4,
        step: 1,
        source: { attacker: null, kind: 'other' },
      });
    }
  }

  private redrawHud(now: number): void {
    const left = Math.max(0, this.endsAt - now) / OBJECTIVE.meteor.durationMs;
    this.barFill.setSize(Math.max(2, 112 * left), 8);
    const secs = Math.ceil(Math.max(0, this.endsAt - now) / 1000);
    this.barLabel.setText(`METEOR STORM  ${secs}s`);
    this.gfx.clear();
  }
}
