import Phaser from 'phaser';
import {
  canStartObjective,
  nextObjectiveKind,
  OBJECTIVE,
  pickObjectiveStartAt,
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
import { ObjectiveHud } from './ObjectiveHud';
import { pickObjectiveLocation } from './pickLocation';
import type { MatchObjective, ObjectiveCompleteEvent } from './types';

export type ObjectiveManagerDeps = {
  scene: Phaser.Scene;
  match: MatchManager;
  score: ScoreManager;
  query: MapQuery;
  orbs: XpOrbWorld;
  heroes: () => readonly HeroRuntime[];
  grantLevel: (hero: HeroRuntime) => void;
  rng?: () => number;
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
  private readonly rng: () => number;
  private readonly hud: ObjectiveHud;
  private active?: MatchObjective;
  private nextAt?: number;
  private cooldownUntil = 0;
  private lastKind?: ObjectiveKind;
  private lastBounty: { alpha?: string; bravo?: string } = {};
  private readonly kindQueue: ObjectiveKind[] = [];
  private closed = false;

  constructor(deps: ObjectiveManagerDeps) {
    this.scene = deps.scene;
    this.match = deps.match;
    this.score = deps.score;
    this.query = deps.query;
    this.orbs = deps.orbs;
    this.heroesOf = deps.heroes;
    this.grantLevel = deps.grantLevel;
    this.rng = deps.rng ?? Math.random;
    this.hud = new ObjectiveHud(deps.scene);
    this.nextAt = pickObjectiveStartAt(OBJECTIVE.earliestStartMs, OBJECTIVE.firstLatestStartMs, this.rng);
  }

  update(now: number, delta: number): void {
    if (this.closed || this.match.paused) {
      return;
    }
    if (this.match.finished || !this.match.playing) {
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
        playing: this.match.playing && !this.match.finished,
      });
      this.publish(heroes);
      this.hud.sync(now, this.active.ui(), this.scene.cameras.main);
      if (done) {
        this.finish(done, elapsed);
      }
      return;
    }

    this.publish(undefined);
    this.hud.sync(now, undefined, this.scene.cameras.main);
    if (this.nextAt === undefined) {
      this.nextAt = this.scheduleNext(Math.max(elapsed, this.cooldownUntil));
    }
    if (
      this.nextAt !== undefined &&
      elapsed >= this.nextAt &&
      canStartObjective(elapsed, this.cooldownUntil, false)
    ) {
      this.spawn(nextObjectiveKind(this.kindQueue, this.rng), now);
    }
  }

  notifyHeroDeath(now: number, victim: HeroRuntime, killer?: HeroRuntime['body']): void {
    if (!this.active || this.closed) {
      return;
    }
    this.active.onHeroDeath?.({ now, victim, killer }, this.heroesOf());
  }

  debugSpawn(kind?: ObjectiveKind, now = this.scene.time.now): boolean {
    if (this.closed || this.active || this.match.finished) {
      return false;
    }
    this.spawn(kind ?? nextObjectiveKind(this.kindQueue, this.rng), now);
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
    created.spawn(now);
    this.hud.announce(kind, created.x, created.y, now);
    this.nextAt = undefined;
    this.publish(this.heroesOf());
  }

  private create(kind: ObjectiveKind): MatchObjective {
    switch (kind) {
      case 'golden_piggy': {
        const loc = pickObjectiveLocation(this.query, OBJECTIVE.piggy.radius, this.rng);
        return new GoldenPiggyBankObjective({
          scene: this.scene,
          x: loc.x,
          y: loc.y,
          orbs: this.orbs,
          grantLevel: this.grantLevel,
        });
      }
      case 'capture_zone': {
        const loc = pickObjectiveLocation(this.query, OBJECTIVE.capture.radius * 0.18, this.rng);
        return new CaptureZoneObjective({
          scene: this.scene,
          x: loc.x,
          y: loc.y,
          orbs: this.orbs,
          grantLevel: this.grantLevel,
        });
      }
      case 'bounty_target': {
        return new BountyTargetObjective({
          scene: this.scene,
          orbs: this.orbs,
          grantLevel: this.grantLevel,
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
    }
  }

  private finish(event: ObjectiveCompleteEvent, elapsed: number): void {
    if (event.winner) {
      if (event.kind === 'golden_piggy') {
        this.score.addPoints(event.winner, OBJECTIVE.scoreReward);
      }
      this.hud.celebrate(event.winner, celebrateLine(event.kind, event.winner));
    }
    this.lastKind = event.kind;
    this.active?.cleanup();
    this.active = undefined;
    this.cooldownUntil = elapsed + OBJECTIVE.cooldownMs;
    this.nextAt = this.scheduleNext(this.cooldownUntil);
    setObjectiveWorld(undefined);
  }

  private scheduleNext(earliestMs: number): number | undefined {
    const lo = Math.max(earliestMs, OBJECTIVE.earliestStartMs);
    const firstWave = this.lastKind === undefined;
    const hi = firstWave
      ? OBJECTIVE.firstLatestStartMs
      : Math.min(lo + 8_000, OBJECTIVE.latestStartMs);
    return pickObjectiveStartAt(lo, hi, this.rng);
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
};

const celebrateLine = (kind: ObjectiveKind, team: TeamId): string => CELEBRATE[kind](teamName(team));
