import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import { listProjectilePoses } from '../../combat/projectileRegistry';
import { isInAttackArc } from '../../combat/hitDetection';
import type { HeroRuntime } from '../HeroRuntime';
import type { NinjaBody } from '../../heroes/NinjaBody';
import { onWorldStrike, type WorldStrikeEvent } from './worldStrike';
import type { MatchObjective, ObjectiveCompleteEvent, ObjectiveContext, ObjectiveHint, ObjectiveUiState } from './types';

const GOLD = 0xffc928;
const GOLD_DEEP = 0xc47a14;

export type PiggyDeps = {
  scene: Phaser.Scene;
  x: number;
  y: number;
};

export class GoldenPiggyBankObjective implements MatchObjective {
  readonly kind = 'golden_piggy' as const;
  readonly x: number;
  readonly y: number;
  readonly radius = OBJECTIVE.piggy.radius;
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Arc;
  private readonly snout: Phaser.GameObjects.Shape;
  private readonly coin: Phaser.GameObjects.Arc;
  private readonly spark: Phaser.GameObjects.Arc;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly alphaFill: Phaser.GameObjects.Rectangle;
  private readonly bravoFill: Phaser.GameObjects.Rectangle;
  private alpha = 0;
  private bravo = 0;
  private awarded = false;
  private wobble = 0;
  private lastHitAt = -9999;
  private readonly swingHits = new WeakMap<NinjaBody, number>();
  private readonly shotHits = new Set<number>();
  private offStrike?: () => void;

  constructor(deps: PiggyDeps) {
    this.scene = deps.scene;
    this.x = deps.x;
    this.y = deps.y;
    this.body = deps.scene.add.circle(0, 8, this.radius * 0.82, GOLD, 1);
    this.body.setStrokeStyle(5, GOLD_DEEP, 1);
    const belly = deps.scene.add.ellipse(0, 18, this.radius * 1.15, this.radius * 0.7, 0xffe08a, 0.55);
    this.snout = deps.scene.add.ellipse(this.radius * 0.58, 14, 34, 26, 0xffe08a, 1);
    this.snout.setStrokeStyle(3, GOLD_DEEP, 1);
    const nostrilL = deps.scene.add.circle(this.radius * 0.5, 14, 3.2, COLORS.ink, 0.75);
    const nostrilR = deps.scene.add.circle(this.radius * 0.68, 16, 3.2, COLORS.ink, 0.75);
    const earL = deps.scene.add.ellipse(-this.radius * 0.42, -this.radius * 0.42, 22, 28, GOLD, 1);
    const earR = deps.scene.add.ellipse(this.radius * 0.22, -this.radius * 0.48, 20, 26, GOLD, 1);
    earL.setStrokeStyle(3, GOLD_DEEP, 0.95);
    earR.setStrokeStyle(3, GOLD_DEEP, 0.95);
    const innerL = deps.scene.add.ellipse(-this.radius * 0.42, -this.radius * 0.4, 10, 14, 0xf03b45, 0.35);
    const innerR = deps.scene.add.ellipse(this.radius * 0.22, -this.radius * 0.46, 9, 12, 0xf03b45, 0.32);
    const slot = deps.scene.add.rectangle(0, -6, this.radius * 0.85, 7, COLORS.ink, 0.9);
    slot.setStrokeStyle(1, GOLD_DEEP, 0.8);
    this.coin = deps.scene.add.circle(-4, -this.radius * 0.55, 10, 0xffe37a, 1);
    this.coin.setStrokeStyle(2, GOLD_DEEP, 1);
    this.spark = deps.scene.add.circle(this.radius * 0.38, -this.radius * 0.18, 5, 0xfff4c4, 0.95);
    const eyeL = deps.scene.add.circle(-this.radius * 0.18, 2, 5, COLORS.ink, 1);
    const eyeR = deps.scene.add.circle(this.radius * 0.16, 0, 5, COLORS.ink, 1);
    const shineL = deps.scene.add.circle(-this.radius * 0.2, 0, 1.8, 0xfff4c4, 1);
    const shineR = deps.scene.add.circle(this.radius * 0.14, -2, 1.8, 0xfff4c4, 1);
    const legL = deps.scene.add.rectangle(-18, this.radius * 0.72, 12, 16, GOLD_DEEP, 1);
    const legR = deps.scene.add.rectangle(16, this.radius * 0.72, 12, 16, GOLD_DEEP, 1);
    const blushL = deps.scene.add.circle(-this.radius * 0.32, 18, 8, 0xf03b45, 0.32);
    const blushR = deps.scene.add.circle(this.radius * 0.12, 20, 7, 0xf03b45, 0.24);
    this.root = deps.scene.add
      .container(this.x, this.y, [
        earL,
        earR,
        innerL,
        innerR,
        legL,
        legR,
        this.body,
        belly,
        blushL,
        blushR,
        eyeL,
        eyeR,
        shineL,
        shineR,
        this.snout,
        nostrilL,
        nostrilR,
        slot,
        this.coin,
        this.spark,
      ])
      .setDepth(8);

    const alphaTrack = deps.scene.add.rectangle(18, -16, 128, 12, COLORS.ink, 0.88).setStrokeStyle(1.6, COLORS.cyan, 0.95);
    const bravoTrack = deps.scene.add.rectangle(18, 4, 128, 12, COLORS.ink, 0.88).setStrokeStyle(1.6, COLORS.redBright, 0.95);
    this.alphaFill = deps.scene.add.rectangle(-44, -16, 2, 8, COLORS.cyan).setOrigin(0, 0.5);
    this.bravoFill = deps.scene.add.rectangle(-44, 4, 2, 8, COLORS.redBright).setOrigin(0, 0.5);
    const aLabel = deps.scene.add
      .text(-50, -16, 'ALPHA', {
        fontFamily: FONTS.display,
        fontSize: '13px',
        color: hex(COLORS.cyan),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(1, 0.5);
    const bLabel = deps.scene.add
      .text(-50, 4, 'BRAVO', {
        fontFamily: FONTS.display,
        fontSize: '13px',
        color: hex(COLORS.redBright),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(1, 0.5);
    this.barRoot = deps.scene.add
      .container(this.x, this.y - this.radius - 28, [alphaTrack, bravoTrack, this.alphaFill, this.bravoFill, aLabel, bLabel])
      .setDepth(24);
  }

  spawn(now: number): void {
    void now;
    this.awarded = false;
    this.alpha = 0;
    this.bravo = 0;
    this.offStrike = onWorldStrike((event) => this.onStrike(event));
    audio.play('objective-spawn');
    this.syncBars();
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.awarded || !ctx.playing) {
      return undefined;
    }
    this.wobble += ctx.delta * 0.006;
    this.root.y = this.y + Math.sin(this.wobble) * 3;
    this.coin.y = -this.radius * 0.55 + Math.sin(this.wobble * 1.6) * 4;
    this.spark.setAlpha(0.45 + Math.sin(this.wobble * 2.2) * 0.4);
    this.collectProjectiles();
    this.syncBars();
    const winner = this.winner();
    if (winner) {
      return this.complete(winner);
    }
    return undefined;
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    const near = this.occupancyNear(heroes, this.radius + 240);
    const occ = this.occupancyNear(heroes, this.radius + 90);
    const selfProgress = team === 'alpha' ? this.alpha : this.bravo;
    const enemyProgress = team === 'alpha' ? this.bravo : this.alpha;
    let urgency = 0.3 + selfProgress * 0.4 + enemyProgress * 0.5;
    if (enemyProgress >= 0.75) {
      urgency = Math.max(urgency, 0.82);
    }
    if (selfProgress >= 0.75) {
      urgency = Math.max(urgency, 0.78);
    }
    return {
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      contested: occ.alpha > 0 && occ.bravo > 0,
      decaying: false,
      owner: selfProgress === enemyProgress ? null : selfProgress > enemyProgress ? team : team === 'alpha' ? 'bravo' : 'alpha',
      selfProgress,
      enemyProgress,
      occupyingAllies: occ[team],
      occupyingEnemies: occ[team === 'alpha' ? 'bravo' : 'alpha'],
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
      owner: this.alpha === this.bravo ? null : this.alpha > this.bravo ? 'alpha' : 'bravo',
      contested: this.alpha > 0 && this.bravo > 0,
      decaying: false,
      progress: Math.max(this.alpha, this.bravo),
      alphaProgress: this.alpha,
      bravoProgress: this.bravo,
      barMode: 'dual',
    };
  }

  cleanup(): void {
    this.offStrike?.();
    this.offStrike = undefined;
    this.root.destroy();
    this.barRoot.destroy();
    this.shotHits.clear();
  }

  private onStrike(event: WorldStrikeEvent): void {
    if (this.awarded) {
      return;
    }
    const last = this.swingHits.get(event.attacker) ?? -1;
    if (last === event.now) {
      return;
    }
    if (!this.inReach(event.attacker, event.reach)) {
      return;
    }
    this.swingHits.set(event.attacker, event.now);
    this.applyDamage(event.attacker.team, event.damage);
  }

  private inReach(attacker: NinjaBody, reach: number): boolean {
    const halfArc = (attacker.stats.attackArcDegrees * Math.PI) / 360;
    return isInAttackArc(
      attacker.x,
      attacker.y,
      attacker.aim.x,
      attacker.aim.y,
      this.x,
      this.y,
      reach,
      halfArc,
      this.radius,
    );
  }

  private collectProjectiles(): void {
    for (const pose of listProjectilePoses()) {
      if (!pose.team || this.shotHits.has(pose.id)) {
        continue;
      }
      if (Math.hypot(pose.x - this.x, pose.y - this.y) > this.radius + pose.radius) {
        continue;
      }
      this.shotHits.add(pose.id);
      this.applyDamage(pose.team, OBJECTIVE.piggy.projectileDamage);
    }
  }

  private applyDamage(team: TeamId, amount: number): void {
    if (this.awarded || amount <= 0) {
      return;
    }
    const add = amount / OBJECTIVE.piggy.breakDamage;
    if (team === 'alpha') {
      this.alpha = Math.min(1, this.alpha + add);
    } else {
      this.bravo = Math.min(1, this.bravo + add);
    }
    const now = this.scene.time.now;
    if (now - this.lastHitAt > 70) {
      this.lastHitAt = now;
      audio.play('piggy-hit', { x: this.x, y: this.y });
      this.root.setScale(1.08);
      this.scene.tweens.add({ targets: this.root, scale: 1, duration: 90 });
    }
  }

  private winner(): TeamId | undefined {
    if (this.alpha >= 1) {
      return 'alpha';
    }
    if (this.bravo >= 1) {
      return 'bravo';
    }
    return undefined;
  }

  private complete(winner: TeamId): ObjectiveCompleteEvent {
    this.awarded = true;
    this.offStrike?.();
    this.offStrike = undefined;
    audio.play('piggy-break');
    audio.play('objective-complete');
    const burst = this.scene.add.circle(this.x, this.y, this.radius, GOLD, 0.5).setDepth(21);
    this.scene.tweens.add({
      targets: [burst, this.root],
      scale: 1.6,
      alpha: 0,
      duration: 360,
      onComplete: () => burst.destroy(),
    });
    return { kind: this.kind, winner };
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

  private syncBars(): void {
    this.alphaFill.setSize(Math.max(2, 124 * this.alpha), 8);
    this.bravoFill.setSize(Math.max(2, 124 * this.bravo), 8);
  }
}
