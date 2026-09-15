import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import type { HeroRuntime } from '../HeroRuntime';
import { occupancyNear } from './rewards';
import type {
  MatchObjective,
  ObjectiveCompleteEvent,
  ObjectiveContext,
  ObjectiveDeathEvent,
  ObjectiveHint,
  ObjectiveUiState,
} from './types';

const TEAM_COLOR: Record<TeamId, number> = {
  alpha: COLORS.cyan,
  bravo: COLORS.redBright,
};

export type WarBannerDeps = {
  scene: Phaser.Scene;
  x: number;
  y: number;
};

export class WarBannerObjective implements MatchObjective {
  readonly kind = 'war_banner' as const;
  readonly radius = OBJECTIVE.banner.radius;
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly cloth: Phaser.GameObjects.Rectangle;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barLabel: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;
  private posX: number;
  private posY: number;
  private owner: TeamId | null = null;
  private carrier?: HeroRuntime;
  private claimTeam: TeamId | null = null;
  private claimProgress = 0;
  private endsAt = 0;
  private awarded = false;
  private pulse = 0;
  private lastCarrier?: HeroRuntime;

  constructor(deps: WarBannerDeps) {
    this.scene = deps.scene;
    this.posX = deps.x;
    this.posY = deps.y;
    const pole = deps.scene.add.rectangle(0, 8, 7, 86, 0x5a3a22, 1).setStrokeStyle(2, COLORS.ink, 0.9);
    this.cloth = deps.scene.add.rectangle(22, -18, 48, 36, COLORS.paper, 1).setStrokeStyle(3, COLORS.ink, 0.95);
    const tip = deps.scene.add.triangle(0, -38, 0, 8, -10, -6, 10, -6, 0xc0c4c8, 1).setStrokeStyle(2, COLORS.ink, 0.9);
    this.ring = deps.scene.add.circle(0, 28, this.radius, COLORS.paper, 0).setStrokeStyle(3, COLORS.paper, 0.85);
    this.root = deps.scene.add.container(this.posX, this.posY, [this.ring, pole, this.cloth, tip]).setDepth(9);
    const track = deps.scene.add.rectangle(0, 0, 118, 12, COLORS.ink, 0.86).setStrokeStyle(1.6, COLORS.paper, 0.85);
    this.barFill = deps.scene.add.rectangle(-56, 0, 2, 8, COLORS.paper).setOrigin(0, 0.5);
    this.barLabel = deps.scene.add
      .text(0, -18, 'UNCLAIMED', {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
        letterSpacing: 1,
      })
      .setOrigin(0.5, 1);
    this.timer = deps.scene.add
      .text(0, 16, '20s', {
        fontFamily: FONTS.display,
        fontSize: '16px',
        color: hex(COLORS.yellow),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);
    this.barRoot = deps.scene.add.container(this.posX, this.posY - 78, [track, this.barFill, this.barLabel, this.timer]).setDepth(24);
  }

  get x(): number {
    return this.posX;
  }

  get y(): number {
    return this.posY;
  }

  spawn(now: number): void {
    this.awarded = false;
    this.endsAt = now + OBJECTIVE.banner.durationMs;
    audio.play('objective-spawn');
    this.redraw(now);
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.awarded || !ctx.playing) {
      this.clearCarrierMods();
      return undefined;
    }
    this.pulse += ctx.delta;
    this.followCarrier();
    this.tickClaim(ctx);
    this.applyCarrierMods(ctx.now);
    this.redraw(ctx.now);
    if (ctx.now >= this.endsAt) {
      this.awarded = true;
      this.clearCarrierMods();
      if (this.owner) {
        audio.play('objective-complete');
      }
      return { kind: this.kind, winner: this.owner ?? undefined };
    }
    return undefined;
  }

  onHeroDeath(event: ObjectiveDeathEvent): void {
    if (this.carrier && event.victim.instanceId === this.carrier.instanceId) {
      this.dropBanner();
    }
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    const occ = occupancyNear(heroes, this.posX, this.posY, this.radius);
    const near = occupancyNear(heroes, this.posX, this.posY, this.radius + 220);
    const left = Math.max(0, this.endsAt - this.scene.time.now);
    const urgency = Math.min(1, 0.4 + (1 - left / OBJECTIVE.banner.durationMs) * 0.45 + (this.owner && this.owner !== team ? 0.12 : 0));
    const ally = this.owner === team ? this.carrier : undefined;
    const enemy = this.owner && this.owner !== team ? this.carrier : undefined;
    return {
      kind: this.kind,
      x: this.posX,
      y: this.posY,
      radius: this.radius,
      contested: occ.alpha > 0 && occ.bravo > 0,
      decaying: false,
      owner: this.owner,
      selfProgress: this.owner === team ? 1 : this.claimTeam === team ? this.claimProgress : 0,
      enemyProgress: this.owner && this.owner !== team ? 1 : this.claimTeam && this.claimTeam !== team ? this.claimProgress : 0,
      occupyingAllies: occ[team],
      occupyingEnemies: occ[team === 'alpha' ? 'bravo' : 'alpha'],
      nearbyAllies: near[team],
      nearbyEnemies: near[team === 'alpha' ? 'bravo' : 'alpha'],
      urgency,
      allyHeroId: ally?.instanceId,
      enemyHeroId: enemy?.instanceId,
      allyX: ally?.body.x,
      allyY: ally?.body.y,
      enemyX: enemy?.body.x,
      enemyY: enemy?.body.y,
      remainingMs: left,
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
      owner: this.owner,
      contested: this.claimTeam !== null && this.claimProgress > 0 && this.claimTeam !== this.owner,
      decaying: false,
      progress: 1 - left / OBJECTIVE.banner.durationMs,
      alphaProgress: this.owner === 'alpha' ? 1 : this.claimTeam === 'alpha' ? this.claimProgress : 0,
      bravoProgress: this.owner === 'bravo' ? 1 : this.claimTeam === 'bravo' ? this.claimProgress : 0,
      barMode: 'single',
      remainingMs: left,
      prompt: 'Claim and protect the banner!',
    };
  }

  cleanup(): void {
    this.awarded = true;
    this.clearCarrierMods();
    this.root.destroy();
    this.barRoot.destroy();
  }

  private tickClaim(ctx: ObjectiveContext): void {
    const occ = occupancyNear(ctx.heroes, this.posX, this.posY, this.radius);
    const alpha = this.owner && this.carrier ? Math.max(0, occ.alpha - (this.carrier.team === 'alpha' ? 1 : 0)) : occ.alpha;
    const bravo = this.owner && this.carrier ? Math.max(0, occ.bravo - (this.carrier.team === 'bravo' ? 1 : 0)) : occ.bravo;
    const onlyAlpha = alpha > 0 && bravo === 0;
    const onlyBravo = bravo > 0 && alpha === 0;
    const team: TeamId | null = onlyAlpha ? 'alpha' : onlyBravo ? 'bravo' : null;
    if (!team) {
      if (alpha > 0 && bravo > 0) {
        this.claimProgress = 0;
        this.claimTeam = null;
      } else {
        this.claimProgress = Math.max(0, this.claimProgress - ctx.delta / OBJECTIVE.banner.claimMs);
        if (this.claimProgress <= 0) {
          this.claimTeam = null;
        }
      }
      return;
    }
    if (this.owner === team && this.carrier?.alive) {
      this.claimProgress = 0;
      this.claimTeam = null;
      return;
    }
    if (this.claimTeam !== team) {
      this.claimTeam = team;
      this.claimProgress = 0;
    }
    this.claimProgress = Math.min(1, this.claimProgress + ctx.delta / OBJECTIVE.banner.claimMs);
    if (this.claimProgress >= 1) {
      this.claim(team, ctx.heroes);
    }
  }

  private claim(team: TeamId, heroes: readonly HeroRuntime[]): void {
    this.owner = team;
    this.claimProgress = 0;
    this.claimTeam = null;
    this.carrier = nearestLiving(heroes, team, this.posX, this.posY);
    audio.play('objective-contested');
  }

  private followCarrier(): void {
    if (!this.carrier) {
      return;
    }
    if (!this.carrier.alive || this.carrier.body.down || !this.carrier.body.isPresent) {
      this.dropBanner();
      return;
    }
    this.posX = this.carrier.body.x;
    this.posY = this.carrier.body.y - 18;
  }

  private dropBanner(): void {
    if (this.carrier) {
      this.posX = this.carrier.body.x;
      this.posY = this.carrier.body.y;
    }
    this.clearCarrierMods();
    this.carrier = undefined;
  }

  private applyCarrierMods(now: number): void {
    if (this.lastCarrier && this.lastCarrier !== this.carrier) {
      this.lastCarrier.body.status.clearCarryModifiers();
    }
    this.lastCarrier = this.carrier;
    if (!this.carrier?.alive) {
      return;
    }
    this.carrier.body.status.setCarryModifiers({
      moveMul: OBJECTIVE.banner.carrierMoveMul,
      damageMul: OBJECTIVE.banner.carrierDamageMul,
    });
    void now;
  }

  private clearCarrierMods(): void {
    this.carrier?.body.status.clearCarryModifiers();
    this.lastCarrier?.body.status.clearCarryModifiers();
    this.lastCarrier = undefined;
  }

  private redraw(now: number): void {
    const color = this.owner ? TEAM_COLOR[this.owner] : COLORS.paper;
    this.cloth.setFillStyle(color, 1);
    this.ring.setStrokeStyle(3.2, this.claimTeam ? COLORS.orange : color, 0.88);
    this.ring.setRadius(this.radius + Math.sin(this.pulse * 0.008) * 3);
    this.root.setPosition(this.posX, this.posY);
    this.barRoot.setPosition(this.posX, this.posY - 78);
    const secs = Math.ceil(Math.max(0, this.endsAt - now) / 1000);
    this.timer.setText(`${secs}s`);
    let label = 'UNCLAIMED';
    if (this.claimTeam && this.claimProgress > 0 && this.claimTeam !== this.owner) {
      label = 'STEALING';
    } else if (this.owner && this.carrier) {
      label = this.owner === 'alpha' ? 'ALPHA CARRY' : 'BRAVO CARRY';
    } else if (this.owner) {
      label = this.owner === 'alpha' ? 'ALPHA DROP' : 'BRAVO DROP';
    }
    this.barLabel.setText(label).setColor(hex(this.claimTeam && this.claimTeam !== this.owner ? COLORS.orange : color));
    const width = this.owner ? 112 : Math.max(2, 112 * this.claimProgress);
    this.barFill.setFillStyle(this.claimTeam && this.claimTeam !== this.owner ? COLORS.orange : color, 1);
    this.barFill.setSize(width, 8);
  }
}

const nearestLiving = (heroes: readonly HeroRuntime[], team: TeamId, x: number, y: number): HeroRuntime | undefined => {
  let best: HeroRuntime | undefined;
  let bestD = 9999;
  for (const hero of heroes) {
    if (hero.team !== team || !hero.alive) {
      continue;
    }
    const d = Math.hypot(hero.body.x - x, hero.body.y - y);
    if (d < bestD) {
      best = hero;
      bestD = d;
    }
  }
  return best;
};
