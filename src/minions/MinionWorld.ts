import Phaser from 'phaser';
import { ARENA, nearestLane, type LaneId } from '../config/arena';
import { MATCH } from '../config/match';
import { MINION, MinionKind, minionStatsOf } from '../config/minion';
import type { TeamId } from '../config/hero';
import { isHeroFighter } from '../combat/damageEvents';
import { NinjaBody } from '../heroes/NinjaBody';
import { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import { drawRangerMinion, drawSwordMinion } from './drawMinion';
import { MinionBrain, MinionDebugInfo } from './MinionBrain';
import { MinionHpBar } from '../ui/world/MinionHpBar';
import { battlefieldOf } from '../map';
import type { TacticalField } from '../ai/tactical/field';
import type { HeroCombatConfig } from '../config/hero';
import type { HeroDrawFn } from '../heroes/heroDraw';
import { unregisterWitchSkeleton } from '../heroes/abilities/witch/skeletonPack';

export type MinionRecord = {
  body: NinjaBody;
  brain: MinionBrain;
  kind: MinionKind;
  lane: LaneId;
  waveId: number;
  hpBar: MinionHpBar;
};

export type MinionSpawnOptions = {
  x?: number;
  y?: number;
  lane?: LaneId;
  waveId?: number;
  stats?: HeroCombatConfig;
  draw?: HeroDrawFn;
  guard?: NinjaBody;
  windupMs?: number;
  recoveryMs?: number;
};

export type MinionKillEvent = {
  body: NinjaBody;
  kind: MinionKind;
  team: TeamId;
  lane: LaneId;
  waveId: number;
  killer: NinjaBody | null;
  x: number;
  y: number;
};

/**
 * Living minion set + spawn helpers. Wave timing lives on WaveDirector.
 */
export class MinionWorld {
  private readonly units: MinionRecord[] = [];
  private readonly debug: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  onKilled?: (event: MinionKillEvent) => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.debug = scene.add.graphics().setDepth(24);
  }

  get size(): number {
    return this.units.filter((unit) => !unit.body.down).length;
  }

  records(): MinionRecord[] {
    return this.units;
  }

  allBodies(): NinjaBody[] {
    return this.units.map((unit) => unit.body);
  }

  livingBodies(): NinjaBody[] {
    return this.units.filter((unit) => !unit.body.down).map((unit) => unit.body);
  }

  livingOnTeam(team: TeamId): number {
    return this.units.filter((unit) => unit.body.team === team && !unit.body.down).length;
  }

  livingInLane(team: TeamId, lane: LaneId): number {
    return this.units.filter((unit) => unit.body.team === team && unit.lane === lane && !unit.body.down).length;
  }

  spawn(kind: MinionKind, team: TeamId, options: MinionSpawnOptions = {}): MinionRecord | undefined {
    if (this.size >= MINION.wave.maxLiving) {
      return undefined;
    }
    const lane = options.lane ?? nearestLane(options.y ?? ARENA.minionSpawns[team].y);
    const pad = ARENA.minionSpawns[team];
    const px = options.x ?? pad.x + (Math.random() - 0.5) * MINION.groupJitter;
    const py = options.y ?? pad.y + (Math.random() - 0.5) * MINION.groupJitter * 1.6;
    const body = new NinjaBody(this.scene, px, py, {
      team,
      rival: team === 'bravo',
      stats: options.stats ?? minionStatsOf(kind),
      draw: options.draw ?? (kind === 'ranger' ? drawRangerMinion : drawSwordMinion),
      handSparks: false,
    });
    body.setAim(pad.facingX, 0);
    const brain = new MinionBrain(body, kind, {
      guard: options.guard,
      windupMs: options.windupMs,
      recoveryMs: options.recoveryMs,
    });
    const hpBar = new MinionHpBar(this.scene, body);
    const record: MinionRecord = {
      body,
      brain,
      kind,
      lane,
      waveId: options.waveId ?? 0,
      hpBar,
    };
    this.units.push(record);
    battlefieldOf(this.scene)?.attachMover(body.sprite);
    return record;
  }

  spawnMany(kind: MinionKind, team: TeamId, count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.spawn(kind, team);
    }
  }

  spawnMixed(
    team: TeamId,
    swords = MINION.wave.defaultComposition.sword,
    rangers = MINION.wave.defaultComposition.ranger,
  ): void {
    this.spawnMany('sword', team, swords);
    this.spawnMany('ranger', team, rangers);
  }

  /** Play Test helper: one draft wave per team, tagged by lane. */
  spawnDraftWave(waveId = 0): void {
    for (const team of ['alpha', 'bravo'] as TeamId[]) {
      for (const lane of ['top', 'mid', 'bottom'] as LaneId[]) {
        const share = MATCH.waves.lanes[lane];
        const padX = ARENA.minionSpawnX[team];
        const padY = ARENA.laneY[lane];
        const facing = team === 'alpha' ? 1 : -1;
        const burst = (kind: MinionKind, count: number) => {
          for (let i = 0; i < count; i += 1) {
            if (this.livingOnTeam(team) >= MATCH.waves.maxActivePerTeam) {
              return;
            }
            this.spawn(kind, team, {
              x: padX + (Math.random() - 0.5) * MATCH.waves.jitter,
              y: padY + (Math.random() - 0.5) * MATCH.waves.jitter,
              lane,
              waveId,
            });
          }
        };
        burst('sword', share.sword);
        burst('ranger', share.ranger);
        void facing;
      }
    }
  }

  clear(): void {
    for (const unit of this.units) {
      unit.hpBar.destroy();
      unregisterWitchSkeleton(unit.body);
      unit.body.destroy();
    }
    this.units.length = 0;
    this.debug.clear();
    this.clearLabels();
  }

  update(now: number, delta: number, world: AbilityWorld, field: TacticalField): void {
    for (let i = this.units.length - 1; i >= 0; i -= 1) {
      const unit = this.units[i];
      if (unit.body.down) {
        const killer =
          unit.body.lastAttacker && isHeroFighter(unit.body.lastAttacker) && unit.body.lastAttacker.isPresent
            ? unit.body.lastAttacker
            : null;
        this.onKilled?.({
          body: unit.body,
          kind: unit.kind,
          team: unit.body.team,
          lane: unit.lane,
          waveId: unit.waveId,
          killer,
          x: unit.body.x,
          y: unit.body.y,
        });
        unit.hpBar.destroy();
        unregisterWitchSkeleton(unit.body);
        this.fadeOut(unit);
        this.units.splice(i, 1);
        continue;
      }
      unit.body.syncView();
      unit.hpBar.sync();
      unit.brain.update(now, delta, field, world, this.scene);
    }
    this.separate();
  }

  debugSnapshot(now: number): MinionDebugInfo[] {
    return this.units.map((unit) => unit.brain.debugInfo(now));
  }

  drawDebug(showRanges: boolean, showAi: boolean, showHitboxes: boolean, now: number): void {
    this.debug.clear();
    this.clearLabels();
    if (!showRanges && !showAi && !showHitboxes) {
      return;
    }
    for (const unit of this.units) {
      const { body, brain, kind } = unit;
      if (showHitboxes) {
        this.debug.lineStyle(1, body.team === 'alpha' ? 0x49dce1 : 0xff4d4d, 0.7);
        this.debug.strokeCircle(body.x, body.y, body.stats.bodyRadius);
      }
      if (showRanges) {
        this.debug.lineStyle(1, kind === 'ranger' ? 0xc8a060 : 0x8ecb5a, 0.35);
        this.debug.strokeCircle(body.x, body.y, body.stats.attackRange);
      }
      if (showAi) {
        const info = brain.debugInfo(now);
        const text = this.scene.add
          .text(
            body.x,
            body.y - 28,
            `${info.state}  ${info.targetLabel}\n${info.threat} a${info.allyCount} e${info.enemyCount} ${info.hp}\n${info.reason}`,
            {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#f6f1de',
            align: 'center',
          },
          )
          .setOrigin(0.5, 1)
          .setDepth(25);
        this.labels.push(text);
        if (brain.target && !brain.target.down) {
          this.debug.lineStyle(1, 0xffc928, 0.55);
          this.debug.lineBetween(body.x, body.y, brain.target.x, brain.target.y);
        }
      }
    }
  }

  destroy(): void {
    this.clear();
    this.debug.destroy();
  }

  private separate(): void {
    const living = this.livingBodies();
    for (let i = 0; i < living.length; i += 1) {
      for (let j = i + 1; j < living.length; j += 1) {
        const a = living[i];
        const b = living[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1 || dist >= MINION.separateRadius) {
          continue;
        }
        const push = ((MINION.separateRadius - dist) / MINION.separateRadius) * MINION.separatePush;
        const nx = dx / dist;
        const ny = dy / dist;
        a.body?.setVelocity(a.body.velocity.x - nx * push, a.body.velocity.y - ny * push);
        b.body?.setVelocity(b.body.velocity.x + nx * push, b.body.velocity.y + ny * push);
      }
    }
  }

  private fadeOut(unit: MinionRecord): void {
    const view = unit.body.view;
    this.scene.tweens.add({
      targets: view,
      alpha: 0,
      scale: 0.4,
      duration: MINION.deathFadeMs,
      onComplete: () => unit.body.destroy(),
    });
  }

  private clearLabels(): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;
  }
}
