import Phaser from 'phaser';
import {
  canStartObjective,
  nextObjectiveKind,
  OBJECTIVE,
  pickEventGapMs,
  type ObjectiveKind,
} from '../../config/objective';
import type { TeamId } from '../../config/hero';
import type { MapQuery } from '../../map/query';
import type { HeroRuntime } from '../HeroRuntime';
import type { MatchManager } from '../MatchManager';
import type { ScoreManager } from '../ScoreManager';
import type { XpOrbWorld } from '../XpOrbWorld';
import { setObjectiveWorld, type ObjectiveWorld } from './board';
import { CaptureZoneObjective } from './CaptureZoneObjective';
import { GoldenPiggyBankObjective } from './GoldenPiggyBankObjective';
import { BountyTargetObjective } from './BountyTargetObjective';
import { HealingShrineObjective } from './HealingShrineObjective';
import { ExecutionerObjective } from './ExecutionerObjective';
import { WarBannerObjective } from './WarBannerObjective';
import { RageZoneObjective } from './RageZoneObjective';
import { MeteorStormObjective } from './MeteorStormObjective';
import { ObjectiveHud } from './ObjectiveHud';
import { pickCenterObjectiveLocation, pickFightCluster, pickObjectiveLocation } from './pickLocation';
import { applyObjectiveHasteToTeam, grantTeamLevels, grantTeamXpShare } from './rewards';
import type { MatchObjective, ObjectiveCompleteEvent } from './types';

export type ObjectiveManagerDeps = {
  scene: Phaser.Scene;
  match: MatchManager;
  score: ScoreManager;
  query: MapQuery;
  orbs: XpOrbWorld;
  heroes: () => readonly HeroRuntime[];
  grantLevel: (hero: HeroRuntime) => void;
  grantXp: (hero: HeroRuntime, amount: number) => void;
  rng?: () => number;
  onComplete?: (event: ObjectiveCompleteEvent) => void;
};

/**
 * Match-scoped director. Timing and cleanup live here; each event type is a
 * separate MatchObjective so new modes only register a factory.
 */
export class ObjectiveManager {
  private readonly scene: Phaser.Scene;
  private readonly match: MatchManager;
  private readonly score: ScoreManager;
  private readonly query: MapQuery;
  private readonly orbs: XpOrbWorld;
  private readonly heroesOf: () => readonly HeroRuntime[];
  private readonly grantLevel: (hero: HeroRuntime) => void;
  private readonly grantXp: (hero: HeroRuntime, amount: number) => void;
  private readonly rng: () => number;
  private readonly onComplete?: (event: ObjectiveCompleteEvent) => void;
  private readonly hud: ObjectiveHud;
  private active?: MatchObjective;
  private nextAt?: number;
  private cooldownUntil = 0;
  private readonly recent: ObjectiveKind[] = [];
  private lastBounty: { alpha?: string; bravo?: string } = {};
  private closed = false;
  private rewarded = false;

  constructor(deps: ObjectiveManagerDeps) {
    this.scene = deps.scene;
    this.match = deps.match;
    this.score = deps.score;
    this.query = deps.query;
    this.orbs = deps.orbs;
    this.heroesOf = deps.heroes;
    this.grantLevel = deps.grantLevel;
    this.grantXp = deps.grantXp;
    this.rng = deps.rng ?? Math.random;
    this.onComplete = deps.onComplete;
    this.hud = new ObjectiveHud(deps.scene);
    this.nextAt = OBJECTIVE.openingAtMs;
  }

  update(now: number, delta: number): void {
    if (this.closed || this.match.paused) {
      return;
    }
    if (this.match.finished || this.match.phase !== 'PLAYING') {
      this.endMatch();
      return;
    }
    const heroes = this.heroesOf();
    const elapsed = this.match.elapsedMs;
    if (this.active) {
      const done = this.active.update({
        now,
        delta,
        elapsedMs: elapsed,
        heroes,
        playing: this.match.phase === 'PLAYING' && !this.match.finished,
      });
      this.publish(heroes);
      this.hud.sync(now, this.active.ui(), this.scene.cameras.main);
      if (done) {
        this.finish(done, elapsed, now);
      }
      return;
    }

    this.publish(undefined);
    this.hud.sync(now, undefined, this.scene.cameras.main);
    if (this.nextAt === undefined) {
      this.nextAt = elapsed + pickEventGapMs(this.rng);
      this.cooldownUntil = this.nextAt;
    }
    if (this.nextAt !== undefined && elapsed >= this.nextAt && canStartObjective(elapsed, this.cooldownUntil, false)) {
      this.spawn(nextObjectiveKind(this.recent, this.rng), now);
    }
  }

  notifyHeroDeath(now: number, victim: HeroRuntime, killer?: HeroRuntime['body']): void {
    if (!this.active || this.closed) {
      return;
    }
    this.active.onHeroDeath?.({ now, victim, killer }, this.heroesOf());
  }

  debugSpawn(kind?: ObjectiveKind, now = this.scene.time.now): boolean {
    if (this.closed || this.active || this.match.finished || this.match.phase !== 'PLAYING') {
      return false;
    }
    this.spawn(kind ?? nextObjectiveKind(this.recent, this.rng), now);
    return true;
  }

  layout(width: number, height: number): void {
    this.hud.layout(width, height);
  }

  worldPip(): { x: number; y: number; kind: ObjectiveKind } | undefined {
    if (!this.active) {
      return undefined;
    }
    return { x: this.active.x, y: this.active.y, kind: this.active.kind };
  }

  endMatch(): void {
    this.closed = true;
    this.active?.cleanup();
    this.active = undefined;
    this.nextAt = undefined;
    setObjectiveWorld(undefined);
  }

  destroy(): void {
    this.endMatch();
    this.hud.destroy();
  }

  private spawn(kind: ObjectiveKind, now: number): void {
    if (this.active) {
      return;
    }
    const created = this.create(kind);
    this.active = created;
    this.rewarded = false;
    created.spawn(now);
    this.hud.announce(kind, created.x, created.y, now);
    this.nextAt = undefined;
    this.recent.push(kind);
    if (this.recent.length > 6) {
      this.recent.shift();
    }
    this.publish(this.heroesOf());
  }

  private create(kind: ObjectiveKind): MatchObjective {
    switch (kind) {
      case 'golden_piggy': {
        const loc = pickObjectiveLocation(this.query, OBJECTIVE.piggy.radius, this.rng);
        return new GoldenPiggyBankObjective({ scene: this.scene, x: loc.x, y: loc.y });
      }
      case 'capture_zone': {
        const loc =
          this.recent.length === 0
            ? pickCenterObjectiveLocation(this.query, OBJECTIVE.capture.radius * 0.18)
            : pickObjectiveLocation(this.query, OBJECTIVE.capture.radius * 0.18, this.rng);
        return new CaptureZoneObjective({ scene: this.scene, x: loc.x, y: loc.y });
      }
      case 'bounty_target': {
        return new BountyTargetObjective({
          scene: this.scene,
          rng: this.rng,
          heroes: this.heroesOf,
          last: this.lastBounty,
          onPicked: (ids) => {
            this.lastBounty = ids;
          },
        });
      }
      case 'healing_shrine': {
        const loc = pickObjectiveLocation(this.query, OBJECTIVE.shrine.radius * 0.2, this.rng);
        return new HealingShrineObjective({ scene: this.scene, x: loc.x, y: loc.y });
      }
      case 'executioner': {
        const loc = pickObjectiveLocation(this.query, OBJECTIVE.executioner.radius, this.rng);
        return new ExecutionerObjective({
          scene: this.scene,
          x: loc.x,
          y: loc.y,
          query: this.query,
        });
      }
      case 'war_banner': {
        const loc = pickCenterObjectiveLocation(this.query, OBJECTIVE.banner.radius * 0.2);
        return new WarBannerObjective({ scene: this.scene, x: loc.x, y: loc.y });
      }
      case 'rage_zone': {
        const cluster = pickFightCluster(this.heroesOf(), this.rng);
        const loc = this.query.clearForObjective(cluster.x, cluster.y, 24)
          ? cluster
          : pickObjectiveLocation(this.query, OBJECTIVE.rage.radius * 0.2, this.rng);
        return new RageZoneObjective({ scene: this.scene, x: loc.x, y: loc.y });
      }
      case 'meteor_storm': {
        return new MeteorStormObjective({
          scene: this.scene,
          query: this.query,
          rng: this.rng,
          heroes: this.heroesOf,
        });
      }
    }
  }

  private finish(event: ObjectiveCompleteEvent, elapsed: number, now: number): void {
    if (this.match.phase !== 'PLAYING' || this.match.finished) {
      this.active?.cleanup();
      this.active = undefined;
      setObjectiveWorld(undefined);
      return;
    }
    const complete = this.withContributors(event);
    if (!this.rewarded) {
      this.rewarded = true;
      this.grantRewards(complete, now);
    }
    if (complete.winner && complete.kind !== 'healing_shrine') {
      this.hud.celebrate(complete.winner, celebrateLine(complete.kind, complete.winner));
    }
    this.onComplete?.(complete);
    this.active?.cleanup();
    this.active = undefined;
    const gap = pickEventGapMs(this.rng);
    this.cooldownUntil = elapsed + gap;
    this.nextAt = this.cooldownUntil;
    setObjectiveWorld(undefined);
  }

  private withContributors(event: ObjectiveCompleteEvent): ObjectiveCompleteEvent {
    if (event.contributors && event.contributors.length > 0) {
      return event;
    }
    if (event.assassin) {
      return { ...event, contributors: [event.assassin] };
    }
    if (!this.active) {
      return event;
    }
    const obj = this.active;
    const pad = event.kind === 'bounty_target' ? 0 : obj.radius + 36;
    const nearby = this.heroesOf().filter((hero) => {
      if (!hero.alive) {
        return false;
      }
      return Math.hypot(hero.body.x - obj.x, hero.body.y - obj.y) <= pad;
    });
    if (!event.winner) {
      if (event.kind === 'rage_zone' || event.kind === 'meteor_storm') {
        return { ...event, contributors: nearby.map((hero) => hero.body) };
      }
      return event;
    }
    return {
      ...event,
      contributors: nearby.filter((hero) => hero.team === event.winner).map((hero) => hero.body),
    };
  }

  private grantRewards(event: ObjectiveCompleteEvent, now: number): void {
    const winner = event.winner;
    if (!winner) {
      return;
    }
    const heroes = this.heroesOf();
    const x = this.active?.x ?? 0;
    const y = this.active?.y ?? 0;
    switch (event.kind) {
      case 'capture_zone':
        this.score.awardObjective(winner, event.kind, now, `${event.kind}:${now}`);
        grantTeamXpShare(winner, heroes, this.grantXp, this.orbs, x, y, OBJECTIVE.capture.xpShare);
        applyObjectiveHasteToTeam(winner, heroes, now, OBJECTIVE.capture.buffMs, OBJECTIVE.capture.moveMul, 1);
        break;
      case 'golden_piggy':
        this.score.awardObjective(winner, event.kind, now, `${event.kind}:${now}`);
        grantTeamXpShare(winner, heroes, this.grantXp, this.orbs, x, y, OBJECTIVE.piggy.xpShare);
        break;
      case 'bounty_target':
        this.score.awardObjective(winner, event.kind, now, `${event.kind}:${now}`);
        grantTeamLevels(winner, heroes, this.grantLevel, this.orbs, x, y, OBJECTIVE.bounty.levelReward);
        break;
      case 'executioner':
        this.score.awardObjective(winner, event.kind, now, `${event.kind}:${now}`);
        grantTeamXpShare(winner, heroes, this.grantXp, this.orbs, x, y, OBJECTIVE.executioner.xpShare);
        applyObjectiveHasteToTeam(
          winner,
          heroes,
          now,
          OBJECTIVE.executioner.buffMs,
          OBJECTIVE.executioner.moveMul,
          OBJECTIVE.executioner.attackMul,
          OBJECTIVE.executioner.staminaMul,
        );
        break;
      case 'war_banner':
        this.score.awardObjective(winner, event.kind, now, `${event.kind}:${now}`);
        grantTeamXpShare(winner, heroes, this.grantXp, this.orbs, x, y, OBJECTIVE.banner.xpShare);
        break;
      case 'healing_shrine':
      case 'rage_zone':
      case 'meteor_storm':
        break;
    }
  }

  private publish(heroes: readonly HeroRuntime[] | undefined): void {
    if (!this.active || !heroes) {
      setObjectiveWorld(undefined);
      return;
    }
    const alpha = this.active.hint('alpha', heroes);
    const bravo = this.active.hint('bravo', heroes);
    const world: ObjectiveWorld = {
      kind: this.active.kind,
      x: this.active.x,
      y: this.active.y,
      radius: this.active.radius,
      contested: alpha.contested,
      decaying: alpha.decaying,
      owner: alpha.owner,
      alphaProgress: alpha.selfProgress,
      bravoProgress: bravo.selfProgress,
      occupyingAlpha: alpha.occupyingAllies,
      occupyingBravo: bravo.occupyingAllies,
      nearbyAlpha: alpha.nearbyAllies,
      nearbyBravo: bravo.nearbyAllies,
      urgency: Math.max(alpha.urgency, bravo.urgency),
      alphaHeroId: alpha.allyHeroId,
      bravoHeroId: bravo.allyHeroId,
      alphaX: alpha.allyX,
      alphaY: alpha.allyY,
      bravoX: bravo.allyX,
      bravoY: bravo.allyY,
      remainingMs: alpha.remainingMs,
      hazards: alpha.hazards,
    };
    setObjectiveWorld(world);
  }
}

const teamName = (team: TeamId): string => (team === 'alpha' ? 'ALPHA' : 'BRAVO');

const CELEBRATE: Record<ObjectiveKind, (team: string) => string> = {
  capture_zone: (team) => `${team} SECURES THE ZONE`,
  golden_piggy: (team) => `${team} BREAKS THE BANK`,
  bounty_target: (team) => `${team} CLAIMS THE BOUNTY`,
  healing_shrine: (team) => `${team} HOLDS THE SHRINE`,
  executioner: (team) => `${team} SLAYS THE EXECUTIONER`,
  war_banner: (team) => `${team} HOLDS THE BANNER`,
  rage_zone: () => 'RAGE ZONE FADES',
  meteor_storm: () => 'METEOR STORM ENDS',
};

const celebrateLine = (kind: ObjectiveKind, team: TeamId): string => CELEBRATE[kind](teamName(team));
