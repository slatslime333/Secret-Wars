import Phaser from 'phaser';
import { OBJECTIVE } from '../../config/objective';
import { SIX_ZONE_SCORE } from '../../config/score';
import type { TeamId } from '../../config/hero';
import { hashSeed, SeededRNG } from '../../map/seed';
import type { MapQuery } from '../../map/query';
import { audio } from '../../audio';
import { COLORS, FONTS, hex } from '../../ui/theme';
import type { NinjaBody } from '../../heroes/NinjaBody';
import type { CombatStatsTracker } from '../CombatStatsTracker';
import type { ScoreManager } from '../ScoreManager';
import type { CaptureOccupancy } from './captureLogic';
import { clearSixZoneFacts, setSixZoneFacts } from './sixZoneBoard';
import { clearSixIntents } from '../../ai/tactical/sixRoster';
import {
  freshSixZone,
  pickSixZoneSite,
  zoneCaptureSource,
  zoneStatusLabel,
  type SixZoneModel,
  type SixZonePhase,
  type ZoneSite,
  type ZoneSiteQuery,
  stepSixZone,
} from './sixZoneLogic';

const TEAM_COLOR: Record<TeamId, number> = {
  alpha: COLORS.cyan,
  bravo: COLORS.redBright,
};

type ZoneHero = {
  alive: boolean;
  team: TeamId;
  body: NinjaBody;
};

export type SixZoneDebug = {
  id: 'A' | 'B';
  phase: SixZonePhase;
  x: number;
  y: number;
  owner: TeamId | null;
  secured: TeamId | null;
  leftMs: number;
  contested: boolean;
  progress: number;
};

export type SixZoneMarker = {
  x: number;
  y: number;
  color: number;
};

type SixZoneDeps = {
  scene: Phaser.Scene;
  score: ScoreManager;
  stats: CombatStatsTracker;
  query: MapQuery;
  seed: number;
  heroes: () => readonly ZoneHero[];
  setZoneLine: (line: string) => void;
};

class ZoneView {
  private x: number;
  private y: number;
  private pulse = 0;
  private readonly radius: number;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Arc;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly inner: Phaser.GameObjects.Arc;
  private readonly barRoot: Phaser.GameObjects.Container;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barLabel: Phaser.GameObjects.Text;
  private readonly center: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, id: 'A' | 'B', x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.gfx = scene.add.graphics().setDepth(6);
    this.fill = scene.add.circle(x, y, radius, COLORS.paper, 0.08).setDepth(5);
    this.ring = scene.add.circle(x, y, radius, COLORS.paper, 0).setDepth(6);
    this.ring.setStrokeStyle(3, COLORS.paper, 0.85);
    this.inner = scene.add.circle(x, y, radius * 0.72, COLORS.paper, 0).setDepth(6);
    this.inner.setStrokeStyle(id === 'B' ? 2.2 : 0, COLORS.paper, id === 'B' ? 0.75 : 0);
    const track = scene.add.rectangle(0, 0, 118, 12, COLORS.ink, 0.86).setStrokeStyle(1.6, COLORS.paper, 0.85);
    this.barFill = scene.add.rectangle(-56, 0, 2, 8, COLORS.paper).setOrigin(0, 0.5);
    this.barLabel = scene.add
      .text(0, -18, `${id} NEUTRAL`, {
        fontFamily: FONTS.display,
        fontSize: '15px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
        letterSpacing: 1,
      })
      .setOrigin(0.5, 1);
    this.barRoot = scene.add.container(x, y - radius - 18, [track, this.barFill, this.barLabel]).setDepth(24);
    this.center = scene.add
      .text(x, y, '', {
        fontFamily: FONTS.display,
        fontSize: '18px',
        color: hex(COLORS.paper),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(25);
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.fill.setPosition(x, y);
    this.ring.setPosition(x, y);
    this.inner.setPosition(x, y);
    this.center.setPosition(x, y);
    this.barRoot.setPosition(x, y - this.radius - 18);
  }

  draw(id: 'A' | 'B', model: SixZoneModel, contested: boolean, dt: number): void {
    this.pulse += dt;
    const cooling = model.phase === 'cooldown';
    const { owner, progress, phase } = model.snap;
    let color: number = COLORS.paper;
    let fillAlpha = cooling ? 0.04 : 0.1;
    let bar = `${id} NEUTRAL`;
    if (cooling) {
      color = COLORS.paper;
      bar = `${id} RESPAWN`;
    } else if (contested || phase === 'contested') {
      color = COLORS.orange;
      fillAlpha = 0.16 + Math.sin(this.pulse * 0.012) * 0.05;
      bar = model.secured ? `${id} PAUSED` : `${id} CONTESTED`;
    } else if (owner) {
      color = TEAM_COLOR[owner];
      fillAlpha = 0.14 + progress * 0.1;
      if (phase === 'decaying') {
        bar = `${id} LOSING`;
      } else if (phase === 'grace') {
        bar = owner === 'alpha' ? `${id} ALPHA HOLD` : `${id} BRAVO HOLD`;
      } else {
        bar = owner === 'alpha' ? `${id} ALPHA` : `${id} BRAVO`;
      }
    }
    this.fill.setFillStyle(color, fillAlpha);
    this.ring.setStrokeStyle(cooling ? 2 : 3.2, color, cooling ? 0.35 : phase === 'contested' ? 0.95 : 0.88);
    this.inner.setStrokeStyle(id === 'B' ? 2.2 : 0, color, id === 'B' ? (cooling ? 0.28 : 0.7) : 0);
    this.gfx.clear();
    this.gfx.lineStyle(2, color, cooling ? 0.15 : 0.35);
    this.gfx.strokeCircle(this.x, this.y, this.radius * (id === 'A' ? 0.42 : 0.5));
    const width = cooling ? 2 : 112 * Math.max(0.02, progress);
    this.barFill.setFillStyle(contested ? COLORS.orange : color, cooling ? 0.35 : 1);
    this.barFill.setSize(width, 8);
    this.barLabel.setText(bar).setColor(hex(contested ? COLORS.orange : color));
    this.center.setText(zoneStatusLabel(model, contested)).setColor(hex(contested ? COLORS.orange : color));
    this.center.setAlpha(cooling ? 0.9 : 1);
  }

  destroy(): void {
    this.gfx.destroy();
    this.fill.destroy();
    this.ring.destroy();
    this.inner.destroy();
    this.barRoot.destroy();
    this.center.destroy();
  }
}

type LiveZone = {
  id: 'A' | 'B';
  model: SixZoneModel;
  view: ZoneView;
  generation: number;
  secureSerial: number;
  contested: boolean;
  wasContested: boolean;
};

/**
 * Standing pair of 6v6 capture zones. They are not ObjectiveManager events.
 */
export class SixZoneController {
  private readonly score: ScoreManager;
  private readonly stats: CombatStatsTracker;
  private readonly query: MapQuery;
  private readonly heroes: () => readonly ZoneHero[];
  private readonly setZoneLine: (line: string) => void;
  private readonly rng: SeededRNG;
  private readonly radius = OBJECTIVE.capture.radius;
  private readonly clearRadius = OBJECTIVE.capture.radius * 0.18;
  private readonly zones: LiveZone[];
  private closed = false;

  constructor(deps: SixZoneDeps) {
    this.score = deps.score;
    this.stats = deps.stats;
    this.query = deps.query;
    this.heroes = deps.heroes;
    this.setZoneLine = deps.setZoneLine;
    this.rng = new SeededRNG(hashSeed(deps.seed ^ 0x51e70a6e));
    const query = this.siteQuery();
    const first = pickSixZoneSite(query, () => this.rng.next(), this.clearRadius, this.radius, []);
    const second = pickSixZoneSite(query, () => this.rng.next(), this.clearRadius, this.radius, [first]);
    this.zones = [this.make(deps.scene, 'A', first), this.make(deps.scene, 'B', second)];
    audio.play('objective-spawn');
    this.publishHud();
  }

  update(now: number, delta: number, scoring: boolean): void {
    if (this.closed) {
      return;
    }
    const live = scoring && delta > 0;
    for (let i = 0; i < this.zones.length; i += 1) {
      const zone = this.zones[i];
      const other = this.zones[i === 0 ? 1 : 0];
      const occupancy = zone.model.phase === 'active' ? this.occupancyAt(zone.model.x, zone.model.y) : { alpha: 0, bravo: 0 };
      const stepped = stepSixZone(zone.model, delta, occupancy, live);
      zone.model = stepped.model;
      for (const event of stepped.events) {
        if (event.type === 'capture') {
          this.payCapture(zone, event.team, now);
        } else if (event.type === 'hold') {
          this.payHold(zone, event.team, now);
        } else if (event.type === 'respawn') {
          this.moveZone(zone, [
            { x: other.model.x, y: other.model.y },
            { x: zone.model.x, y: zone.model.y },
          ]);
        }
      }
      zone.contested =
        zone.model.phase === 'active' &&
        (zone.model.snap.phase === 'contested' || (occupancy.alpha > 0 && occupancy.bravo > 0));
      if (zone.contested && !zone.wasContested) {
        audio.play('objective-contested');
      }
      zone.wasContested = zone.contested;
      zone.view.draw(zone.id, zone.model, zone.contested, delta);
    }
    this.publishHud();
  }

  endMatch(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.setZoneLine('');
    clearSixZoneFacts();
    clearSixIntents();
  }

  destroy(): void {
    this.endMatch();
    for (const zone of this.zones) {
      zone.view.destroy();
    }
  }

  debug(): SixZoneDebug[] {
    return this.zones.map((zone) => ({
      id: zone.id,
      phase: zone.model.phase,
      x: zone.model.x,
      y: zone.model.y,
      owner: zone.model.snap.owner,
      secured: zone.model.secured,
      leftMs: zone.model.leftMs,
      contested: zone.contested,
      progress: zone.model.snap.progress,
    }));
  }

  markers(): SixZoneMarker[] {
    return this.zones.map((zone) => ({
      x: zone.model.x,
      y: zone.model.y,
      color: markerColor(zone),
    }));
  }

  private make(scene: Phaser.Scene, id: 'A' | 'B', site: ZoneSite): LiveZone {
    const model = freshSixZone(site.x, site.y);
    return {
      id,
      model,
      view: new ZoneView(scene, id, site.x, site.y, this.radius),
      generation: 1,
      secureSerial: 0,
      contested: false,
      wasContested: false,
    };
  }

  private moveZone(zone: LiveZone, avoid: readonly ZoneSite[]): void {
    const site = pickSixZoneSite(this.siteQuery(), () => this.rng.next(), this.clearRadius, this.radius, avoid);
    zone.generation += 1;
    zone.secureSerial = 0;
    zone.model = freshSixZone(site.x, site.y);
    zone.contested = false;
    zone.wasContested = false;
    zone.view.place(site.x, site.y);
    audio.play('objective-spawn');
  }

  private payCapture(zone: LiveZone, team: TeamId, now: number): void {
    zone.secureSerial += 1;
    const awarded = this.score.addTeamScore(
      team,
      SIX_ZONE_SCORE.capture,
      'zone_capture',
      now,
      zoneCaptureSource(zone.id, zone.generation, zone.secureSerial),
    );
    if (awarded <= 0) {
      return;
    }
    const bodies = this.bodiesIn(zone, team);
    this.stats.splitScore(bodies, awarded, 'zone_capture');
    for (const body of bodies) {
      this.stats.recordObjectiveWin(body, 'capture_zone');
    }
  }

  private payHold(zone: LiveZone, team: TeamId, now: number): void {
    const awarded = this.score.addOngoingScore(team, SIX_ZONE_SCORE.holdPerSecond, 'zone_hold', now);
    if (awarded > 0) {
      this.stats.splitScore(this.bodiesIn(zone, team), awarded, 'zone_hold');
    }
  }

  private occupancyAt(x: number, y: number): CaptureOccupancy {
    const occ: CaptureOccupancy = { alpha: 0, bravo: 0 };
    for (const hero of this.heroes()) {
      if (!hero.alive) {
        continue;
      }
      if (Math.hypot(hero.body.x - x, hero.body.y - y) <= this.radius) {
        occ[hero.team] += 1;
      }
    }
    return occ;
  }

  private bodiesIn(zone: LiveZone, team: TeamId): NinjaBody[] {
    const bodies: NinjaBody[] = [];
    for (const hero of this.heroes()) {
      if (!hero.alive || hero.team !== team) {
        continue;
      }
      if (Math.hypot(hero.body.x - zone.model.x, hero.body.y - zone.model.y) <= this.radius) {
        bodies.push(hero.body);
      }
    }
    return bodies;
  }

  private siteQuery(): ZoneSiteQuery {
    return {
      playable: this.query.layout.playable,
      spawns: this.query.spawnZones().map((zone) => ({ x: zone.x, y: zone.y, radius: zone.radius })),
      blocked: (x, y, clearRadius) => !this.query.clearForObjective(x, y, clearRadius),
    };
  }

  private publishHud(): void {
    if (this.closed) {
      this.setZoneLine('');
      return;
    }
    this.setZoneLine(this.zones.map((zone) => `${zone.id} ${zoneStatusLabel(zone.model, zone.contested)}`).join('    '));
    setSixZoneFacts(
      this.zones.map((zone) => ({
        id: zone.id,
        x: zone.model.x,
        y: zone.model.y,
        radius: this.radius,
        phase: zone.model.phase,
        owner: zone.model.snap.owner,
        secured: zone.model.secured,
        progress: zone.model.snap.progress,
        contested: zone.contested,
        leftMs: zone.model.leftMs,
      })),
    );
  }
}

const markerColor = (zone: LiveZone): number => {
  if (zone.model.phase === 'cooldown') {
    return COLORS.paper;
  }
  if (zone.contested) {
    return COLORS.orange;
  }
  if (zone.model.secured === 'alpha' || zone.model.snap.owner === 'alpha') {
    return COLORS.cyan;
  }
  if (zone.model.secured === 'bravo' || zone.model.snap.owner === 'bravo') {
    return COLORS.redBright;
  }
  return COLORS.yellow;
};
