import Phaser from 'phaser';
import { OBJECTIVE, OBJECTIVE_LABEL } from '../../config/objective';
import type { TeamId } from '../../config/hero';
import { COLORS, FONTS, hex } from '../../ui/theme';
import { audio } from '../../audio';
import type { NinjaBody } from '../../heroes/NinjaBody';
import type { HeroRuntime } from '../HeroRuntime';
import type { XpOrbWorld } from '../XpOrbWorld';
import { pickBountyTargets } from './bountyPick';
import { applyObjectiveHaste, grantTeamLevels } from './rewards';
import type {
  MatchObjective,
  ObjectiveCompleteEvent,
  ObjectiveContext,
  ObjectiveDeathEvent,
  ObjectiveHint,
  ObjectiveUiState,
} from './types';

export type BountyDeps = {
  scene: Phaser.Scene;
  orbs: XpOrbWorld;
  grantLevel: (hero: HeroRuntime) => void;
  rng: () => number;
  heroes: () => readonly HeroRuntime[];
  last?: { alpha?: string; bravo?: string };
  onPicked?: (ids: { alpha?: string; bravo?: string }) => void;
};

type Mark = {
  hero: HeroRuntime;
  ring: Phaser.GameObjects.Arc;
  badge: Phaser.GameObjects.Container;
  resolved: boolean;
};

export class BountyTargetObjective implements MatchObjective {
  readonly kind = 'bounty_target' as const;
  readonly radius = 40;
  private readonly scene: Phaser.Scene;
  private readonly orbs: XpOrbWorld;
  private readonly grantLevel: (hero: HeroRuntime) => void;
  private readonly rng: () => number;
  private readonly last?: { alpha?: string; bravo?: string };
  private readonly onPicked?: (ids: { alpha?: string; bravo?: string }) => void;
  private readonly heroesOf: () => readonly HeroRuntime[];
  private posX = 0;
  private posY = 0;
  private alpha?: Mark;
  private bravo?: Mark;
  private lastWinner?: TeamId;
  private pulse = 0;
  private failed = false;

  constructor(deps: BountyDeps) {
    this.scene = deps.scene;
    this.orbs = deps.orbs;
    this.grantLevel = deps.grantLevel;
    this.rng = deps.rng;
    this.last = deps.last;
    this.onPicked = deps.onPicked;
    this.heroesOf = deps.heroes;
  }

  get x(): number {
    return this.posX;
  }

  get y(): number {
    return this.posY;
  }

  spawn(now: number): void {
    void now;
    this.arm(this.heroesOf());
    audio.play('objective-spawn');
  }

  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined {
    if (this.failed) {
      return { kind: this.kind };
    }
    if (!this.alpha && !this.bravo) {
      this.arm(ctx.heroes);
    }
    if (!this.alpha || !this.bravo) {
      this.failed = true;
      return { kind: this.kind };
    }
    this.pulse += ctx.delta;
    this.syncMark(this.alpha);
    this.syncMark(this.bravo);
    this.tryResolve(this.alpha, 'bravo', ctx.now, ctx.heroes);
    this.tryResolve(this.bravo, 'alpha', ctx.now, ctx.heroes);
    this.refreshAnchor();
    if (this.alpha.resolved && this.bravo.resolved) {
      return { kind: this.kind, winner: this.lastWinner };
    }
    return undefined;
  }

  onHeroDeath(event: ObjectiveDeathEvent, heroes: readonly HeroRuntime[]): void {
    if (!this.alpha || !this.bravo) {
      return;
    }
    if (event.victim === this.alpha.hero) {
      this.tryResolve(this.alpha, 'bravo', event.now, heroes, event.killer);
    } else if (event.victim === this.bravo.hero) {
      this.tryResolve(this.bravo, 'alpha', event.now, heroes, event.killer);
    }
  }

  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint {
    void heroes;
    const ally = team === 'alpha' ? this.alpha : this.bravo;
    const enemy = team === 'alpha' ? this.bravo : this.alpha;
    const allyLive = ally && !ally.resolved;
    const enemyLive = enemy && !enemy.resolved;
    let urgency = 0.42;
    if (enemyLive) {
      urgency += 0.28;
    }
    if (allyLive) {
      urgency += 0.18;
    }
    return {
      kind: this.kind,
      x: this.posX,
      y: this.posY,
      radius: this.radius,
      contested: Boolean(allyLive && enemyLive),
      decaying: false,
      owner: null,
      selfProgress: allyLive ? 1 : 0,
      enemyProgress: enemyLive ? 1 : 0,
      occupyingAllies: allyLive ? 1 : 0,
      occupyingEnemies: enemyLive ? 1 : 0,
      nearbyAllies: allyLive ? 1 : 0,
      nearbyEnemies: enemyLive ? 1 : 0,
      urgency: Math.max(0, Math.min(1, urgency)),
      allyHeroId: allyLive ? ally.hero.heroId : undefined,
      enemyHeroId: enemyLive ? enemy.hero.heroId : undefined,
      allyX: allyLive ? ally.hero.body.x : undefined,
      allyY: allyLive ? ally.hero.body.y : undefined,
      enemyX: enemyLive ? enemy.hero.body.x : undefined,
      enemyY: enemyLive ? enemy.hero.body.y : undefined,
    };
  }

  ui(): ObjectiveUiState {
    return {
      kind: this.kind,
      x: this.posX,
      y: this.posY,
      radius: this.radius,
      label: OBJECTIVE_LABEL[this.kind],
      owner: this.lastWinner ?? null,
      contested: Boolean(this.alpha && this.bravo && !this.alpha.resolved && !this.bravo.resolved),
      decaying: false,
      progress: [this.alpha, this.bravo].filter((mark) => mark?.resolved).length / 2,
      alphaProgress: this.alpha?.resolved ? 1 : 0,
      bravoProgress: this.bravo?.resolved ? 1 : 0,
      barMode: 'dual',
    };
  }

  cleanup(): void {
    this.destroyMark(this.alpha);
    this.destroyMark(this.bravo);
    this.alpha = undefined;
    this.bravo = undefined;
  }

  private arm(heroes: readonly HeroRuntime[]): void {
    const picked = pickBountyTargets(heroes, this.rng, this.last);
    if (!picked.alpha || !picked.bravo) {
      return;
    }
    this.alpha = this.markOf(picked.alpha);
    this.bravo = this.markOf(picked.bravo);
    this.onPicked?.({ alpha: picked.alpha.instanceId, bravo: picked.bravo.instanceId });
    this.refreshAnchor();
  }

  private markOf(hero: HeroRuntime): Mark {
    const ring = this.scene.add.circle(hero.body.x, hero.body.y, 34, COLORS.yellow, 0).setDepth(7);
    ring.setStrokeStyle(3, COLORS.yellow, 0.95);
    const star = this.scene.add.star(0, 0, 5, 5, 11, COLORS.yellow, 1).setStrokeStyle(2, COLORS.ink, 1);
    const label = this.scene.add
      .text(0, -16, 'BOUNTY', {
        fontFamily: FONTS.display,
        fontSize: '12px',
        color: hex(COLORS.yellow),
        letterSpacing: 1,
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5, 1);
    const badge = this.scene.add.container(hero.body.x, hero.body.y - 70, [star, label]).setDepth(27);
    return { hero, ring, badge, resolved: false };
  }

  private syncMark(mark: Mark): void {
    if (mark.resolved) {
      mark.ring.setVisible(false);
      mark.badge.setVisible(false);
      return;
    }
    const glow = 0.72 + Math.sin(this.pulse * 0.01) * 0.22;
    mark.ring.setPosition(mark.hero.body.x, mark.hero.body.y).setVisible(mark.hero.alive).setStrokeStyle(3, COLORS.yellow, glow);
    mark.badge.setPosition(mark.hero.body.x, mark.hero.body.y - 70).setVisible(mark.hero.alive);
    mark.badge.setScale(1 + Math.sin(this.pulse * 0.012) * 0.04);
  }

  private tryResolve(
    mark: Mark,
    winningTeam: TeamId,
    now: number,
    heroes: readonly HeroRuntime[],
    killerBody?: NinjaBody,
  ): void {
    if (mark.resolved) {
      return;
    }
    const down = mark.hero.dead || mark.hero.body.down || !mark.hero.body.isPresent;
    if (!down) {
      return;
    }
    mark.resolved = true;
    mark.ring.setVisible(false);
    mark.badge.setVisible(false);
    const killer = killerBody ?? mark.hero.body.lastAttacker;
    if (!killer || killer.team !== winningTeam) {
      return;
    }
    this.lastWinner = winningTeam;
    grantTeamLevels(winningTeam, heroes, this.grantLevel, this.orbs, mark.hero.body.x, mark.hero.body.y, OBJECTIVE.bounty.levelReward);
    audio.play('objective-complete');
    const other = winningTeam === 'alpha' ? this.bravo : this.alpha;
    if (other && killer === other.hero.body && other.hero.alive) {
      killer.healFull();
      applyObjectiveHaste(killer, now, OBJECTIVE.bounty.buffMs, OBJECTIVE.bounty.moveMul, OBJECTIVE.bounty.attackMul);
    }
  }

  private refreshAnchor(): void {
    const live = [this.alpha, this.bravo].filter((mark): mark is Mark => !!mark && !mark.resolved && mark.hero.alive);
    if (live.length === 0) {
      return;
    }
    this.posX = live.reduce((sum, mark) => sum + mark.hero.body.x, 0) / live.length;
    this.posY = live.reduce((sum, mark) => sum + mark.hero.body.y, 0) / live.length;
  }

  private destroyMark(mark: Mark | undefined): void {
    mark?.ring.destroy();
    mark?.badge.destroy();
  }
}
