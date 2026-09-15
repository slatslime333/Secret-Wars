import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import { applyDefense } from '../../combat/damage';
import { isInAttackArc } from '../../combat/hitDetection';
import { listProjectilePoses } from '../../combat/projectileRegistry';
import type { MapQuery } from '../../map/query';
import type { NinjaBody } from '../../heroes/NinjaBody';
import type { HeroRuntime } from '../HeroRuntime';
import { onWorldStrike, type WorldStrikeEvent } from './worldStrike';
import { occupancyNear } from './rewards';
import type { MatchObjective, ObjectiveCompleteEvent, ObjectiveContext, ObjectiveHint, ObjectiveUiState } from './types';

const STEEL = 0x2a2428;
const IRON = 0x6a6460;
const BLOOD = 0xa71d31;

export type ExecutionerDeps = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  query: MapQuery;
};

export class ExecutionerObjective implements MatchObjective {
  readonly kind = 'executioner' as const;
  readonly radius = OBJECTIVE.executioner.radius;
  private readonly scene: Phaser.Scene;
  private readonly query: MapQuery;
  private readonly root: Phaser.GameObjects.Container;
  private readonly axe: Phaser.GameObjects.Container;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly alphaFill: Phaser.GameObjects.Rectangle;
  private readonly bravoFill: Phaser.GameObjects.Rectangle;
  private posX: number;
  private posY: number;
  private alpha = 0;
  private bravo = 0;
  private awarded = false;
  private facing = 1;
  private nextAttackAt = 0;
  private wanderAt = 0;
  private wanderX: number;
  private wanderY: number;
  private pulse = 0;
  private readonly swingHits = new WeakMap<NinjaBody, number>();
  private readonly shotHits = new Set<number>();
  private offStrike?: () => void;

  constructor(deps: ExecutionerDeps) {
    this.scene = deps.scene;
    this.query = deps.query;
    this.posX = deps.x;
    this.posY = deps.y;
    this.wanderX = deps.x;
    this.wanderY = deps.y;

    const shadow = deps.scene.add.ellipse(0, 38, 70, 22, COLORS.ink, 0.45);
    const bootL = deps.scene.add.rectangle(-14, 32, 16, 12, STEEL, 1);
    const bootR = deps.scene.add.rectangle(16, 32, 16, 12, STEEL, 1);
    const legL = deps.scene.add.rectangle(-12, 18, 14, 28, 0x1a1418, 1);
    const legR = deps.scene.add.rectangle(14, 18, 14, 28, 0x1a1418, 1);
    const torso = deps.scene.add.rectangle(0, -6, 44, 48, 0x24181c, 1).setStrokeStyle(3, STEEL, 1);
    const belt = deps.scene.add.rectangle(0, 12, 46, 8, BLOOD, 1);
    const shoulderL = deps.scene.add.ellipse(-26, -18, 22, 16, IRON, 1).setStrokeStyle(2, STEEL, 1);
    const shoulderR = deps.scene.add.ellipse(26, -18, 22, 16, IRON, 1).setStrokeStyle(2, STEEL, 1);
    const hood = deps.scene.add.triangle(0, -44, 0, -18, -28, 6, 28, 6, 0x140c10).setStrokeStyle(3, STEEL, 0.9);
    const face = deps.scene.add.ellipse(0, -28, 22, 20, 0x3a3034, 1);
    const eyeL = deps.scene.add.circle(-6, -30, 3.2, COLORS.redBright, 1);
    const eyeR = deps.scene.add.circle(6, -30, 3.2, COLORS.redBright, 1);
    const handle = deps.scene.add.rectangle(0, 8, 8, 64, 0x5a3a22, 1).setStrokeStyle(2, COLORS.ink, 0.9);
    const blade = deps.scene.add.triangle(0, -28, -6, 8, 36, -8, -4, -36, IRON, 1).setStrokeStyle(3, STEEL, 1);
    const edge = deps.scene.add.triangle(8, -30, 0, 0, 28, -6, 2, -28, COLORS.paper, 0.35);
    this.axe = deps.scene.add.container(34, -8, [handle, blade, edge]);
    this.root = deps.scene.add
      .container(this.posX, this.posY, [
        shadow,
        bootL,
        bootR,
        legL,
        legR,
        torso,
        belt,
        shoulderL,
        shoulderR,
        hood,
        face,
        eyeL,
        eyeR,
        this.axe,
      ])
      .setDepth(9)
      .setScale(1.55);

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
      .container(this.posX, this.posY - 86, [alphaTrack, bravoTrack, this.alphaFill, this.bravoFill, aLabel, bLabel])
      .setDepth(24);
  }

  get x(): number {
    return this.posX;
  }

  get y(): number {
    return this.posY;
  }

  spawn(now: number): void {
    this.awarded = false;
    this.alpha = 0;
    this.bravo = 0;
    this.nextAttackAt = now + 600;
    this.offStrike = onWorldStrike((event) => this.onStrike(event));
    audio.play('objective-spawn');
    this.syncBars();
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.awarded || !ctx.playing) {
      return undefined;
    }
    this.pulse += ctx.delta;
    this.collectProjectiles();
    this.walk(ctx);
    this.attack(ctx);
    this.root.setPosition(this.posX, this.posY);
    this.barRoot.setPosition(this.posX, this.posY - 86);
    this.root.setScale(1.55 * this.facing, 1.55);
    this.syncBars();
    const winner = this.winner();
    if (winner) {
      return this.complete(winner, ctx.now, ctx.heroes);
    }
    return undefined;
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    const near = occupancyNear(heroes, this.posX, this.posY, this.radius + 240);
    const occ = occupancyNear(heroes, this.posX, this.posY, this.radius + 110);
    const selfProgress = team === 'alpha' ? this.alpha : this.bravo;
    const enemyProgress = team === 'alpha' ? this.bravo : this.alpha;
    let urgency = 0.26 + selfProgress * 0.38 + enemyProgress * 0.48;
    if (enemyProgress >= 0.75) {
      urgency = Math.max(urgency, 0.8);
    }
    if (selfProgress >= 0.8) {
      urgency = Math.max(urgency, 0.76);
    }
    return {
      kind: this.kind,
      x: this.posX,
      y: this.posY,
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
      x: this.posX,
      y: this.posY,
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
    this.awarded = true;
    this.offStrike?.();
    this.offStrike = undefined;
    this.root.destroy();
    this.barRoot.destroy();
    this.shotHits.clear();
  }

  private walk(ctx: ObjectiveContext): void {
    const prey = this.nearest(ctx.heroes, OBJECTIVE.executioner.pursueRange);
    let destX = this.wanderX;
    let destY = this.wanderY;
    if (prey) {
      destX = prey.body.x;
      destY = prey.body.y;
    } else if (ctx.now >= this.wanderAt) {
      this.wanderAt = ctx.now + 2200;
      this.wanderX = this.posX + (this.scene.tweens ? (Math.random() * 2 - 1) * 180 : 0);
      this.wanderY = this.posY + (Math.random() * 2 - 1) * 140;
    }
    const dx = destX - this.posX;
    const dy = destY - this.posY;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 36) {
      return;
    }
    this.facing = dx >= 0 ? 1 : -1;
    const step = (OBJECTIVE.executioner.moveSpeed * ctx.delta) / 1000;
    const nx = this.posX + (dx / dist) * step;
    const ny = this.posY + (dy / dist) * step;
    const clear = this.radius * 0.55;
    if (!this.query.blocksMovement(nx, ny, clear)) {
      this.posX = nx;
      this.posY = ny;
      return;
    }
    if (!this.query.blocksMovement(nx, this.posY, clear)) {
      this.posX = nx;
      return;
    }
    if (!this.query.blocksMovement(this.posX, ny, clear)) {
      this.posY = ny;
    }
  }

  private attack(ctx: ObjectiveContext): void {
    if (ctx.now < this.nextAttackAt) {
      return;
    }
    const prey = this.nearest(ctx.heroes, OBJECTIVE.executioner.attackRange);
    if (!prey) {
      return;
    }
    this.nextAttackAt = ctx.now + OBJECTIVE.executioner.attackMs;
    const dx = prey.body.x - this.posX;
    const dy = prey.body.y - this.posY;
    this.facing = dx >= 0 ? 1 : -1;
    this.scene.tweens.add({
      targets: this.axe,
      rotation: this.facing * 1.35,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeIn',
    });
    const damage = applyDefense(OBJECTIVE.executioner.damage, prey.body.stats.defense);
    prey.body.takeHit({
      damage,
      dirX: dx,
      dirY: dy,
      knockback: OBJECTIVE.executioner.knockback,
      staminaDamage: 0,
      step: 3,
      source: { kind: 'other' },
    });
    audio.play('piggy-hit', { x: this.posX, y: this.posY });
  }

  private nearest(heroes: readonly HeroRuntime[], range: number): HeroRuntime | undefined {
    let best: HeroRuntime | undefined;
    let bestD = range;
    for (const hero of heroes) {
      if (!hero.alive) {
        continue;
      }
      const d = Math.hypot(hero.body.x - this.posX, hero.body.y - this.posY);
      if (d < bestD) {
        bestD = d;
        best = hero;
      }
    }
    return best;
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
      this.posX,
      this.posY,
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
      if (Math.hypot(pose.x - this.posX, pose.y - this.posY) > this.radius + pose.radius) {
        continue;
      }
      this.shotHits.add(pose.id);
      this.applyDamage(pose.team, OBJECTIVE.executioner.projectileDamage);
    }
  }

  private applyDamage(team: TeamId, amount: number): void {
    if (this.awarded || amount <= 0) {
      return;
    }
    const add = amount / OBJECTIVE.executioner.breakDamage;
    if (team === 'alpha') {
      this.alpha = Math.min(1, this.alpha + add);
    } else {
      this.bravo = Math.min(1, this.bravo + add);
    }
    this.root.setScale(1.62 * this.facing, 1.62);
    this.scene.tweens.add({ targets: this.root, scaleX: 1.55 * this.facing, scaleY: 1.55, duration: 90 });
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

  private complete(winner: TeamId, _now: number, _heroes: readonly HeroRuntime[]): ObjectiveCompleteEvent {
    this.awarded = true;
    this.offStrike?.();
    this.offStrike = undefined;
    audio.play('objective-complete');
    const burst = this.scene.add.circle(this.posX, this.posY, this.radius, BLOOD, 0.4).setDepth(21);
    this.scene.tweens.add({
      targets: [burst, this.root],
      scale: 1.8,
      alpha: 0,
      duration: 360,
      onComplete: () => burst.destroy(),
    });
    return { kind: this.kind, winner };
  }

  private syncBars(): void {
    this.alphaFill.setSize(Math.max(2, 124 * this.alpha), 8);
    this.bravoFill.setSize(Math.max(2, 124 * this.bravo), 8);
  }
}
