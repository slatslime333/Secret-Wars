import { LANES, minionLanePad, type LaneId } from '../config/arena';
import { MATCH } from '../config/match';
import type { TeamId } from '../config/hero';
import type { MinionKind } from '../config/minion';
import type { MinionWorld } from '../minions/MinionWorld';

export type WaveInfo = {
  nextWaveAt: number;
  lastWaveId: number;
  started: boolean;
};

/**
 * Timed, lane-tagged wave spawner. Same 6 sword + 4 ranger composition
 * each pulse, split across top / mid / bottom. Caps living minions per team.
 */
export class WaveDirector {
  nextWaveAt = 0;
  lastWaveId = 0;
  private started = false;

  constructor(private readonly minions: MinionWorld) {}

  start(now: number): void {
    this.started = true;
    this.lastWaveId = 0;
    this.nextWaveAt = now + MATCH.waves.firstDelayMs;
  }

  info(): WaveInfo {
    return { nextWaveAt: this.nextWaveAt, lastWaveId: this.lastWaveId, started: this.started };
  }

  update(now: number): void {
    if (!this.started || now < this.nextWaveAt) {
      return;
    }
    this.spawnWave();
    this.nextWaveAt = now + MATCH.waves.intervalMs;
  }

  spawnWave(): number {
    this.lastWaveId += 1;
    const waveId = this.lastWaveId;
    for (const team of ['alpha', 'bravo'] as TeamId[]) {
      this.spawnTeamWave(team, waveId);
    }
    return waveId;
  }

  livingInLane(team: TeamId, lane: LaneId): number {
    return this.minions.livingInLane(team, lane);
  }

  private spawnTeamWave(team: TeamId, waveId: number): void {
    for (const lane of LANES) {
      const share = MATCH.waves.lanes[lane];
      this.spawnKind(team, lane, 'sword', share.sword, waveId);
      this.spawnKind(team, lane, 'ranger', share.ranger, waveId);
    }
  }

  private spawnKind(team: TeamId, lane: LaneId, kind: MinionKind, count: number, waveId: number): void {
    const pad = minionLanePad(team, lane);
    for (let i = 0; i < count; i += 1) {
      if (this.minions.livingOnTeam(team) >= MATCH.waves.maxActivePerTeam) {
        return;
      }
      const jitter = MATCH.waves.jitter;
      this.minions.spawn(kind, team, {
        x: pad.x + (Math.random() - 0.5) * jitter,
        y: pad.y + (Math.random() - 0.5) * jitter * 1.15,
        lane,
        waveId,
      });
    }
  }
}
