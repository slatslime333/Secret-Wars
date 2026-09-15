import { MATCH, type MatchPhase } from '../config/match';
import type { TeamId } from '../config/hero';

export type MatchEndReason = 'time' | 'overtime' | 'sudden-death';

export type MatchSnapshot = {
  phase: MatchPhase;
  remainingMs: number;
  elapsedMs: number;
  overtime: boolean;
  suddenDeath: boolean;
  finished: boolean;
  winner: TeamId | 'draw' | null;
  reason: MatchEndReason | null;
};

/**
 * Fixed 4-minute War Score clock. At 0:00 the match ends; highest score wins.
 * Overtime / sudden death are not a war-score win path.
 */
export class MatchManager {
  phase: MatchPhase = 'PLAYING';
  remainingMs: number = MATCH.durationMs;
  elapsedMs = 0;
  paused = false;
  winner: TeamId | 'draw' | null = null;
  reason: MatchEndReason | null = null;

  constructor(private readonly decideWinner: () => TeamId | 'draw') {}

  get finished(): boolean {
    return this.phase === 'FINISHED';
  }

  get playing(): boolean {
    return this.phase === 'PLAYING' && !this.finished;
  }

  snapshot(): MatchSnapshot {
    return {
      phase: this.phase,
      remainingMs: this.remainingMs,
      elapsedMs: this.elapsedMs,
      overtime: false,
      suddenDeath: false,
      finished: this.finished,
      winner: this.winner,
      reason: this.reason,
    };
  }

  togglePause(): void {
    this.setPaused(!this.paused);
  }

  setPaused(paused: boolean): void {
    if (this.finished) {
      return;
    }
    this.paused = paused;
  }

  update(delta: number): void {
    if (this.paused || this.finished) {
      return;
    }
    this.elapsedMs += delta;
    this.remainingMs = Math.max(0, this.remainingMs - delta);
    if (this.remainingMs > 0) {
      return;
    }
    this.finish(this.decideWinner(), 'time');
  }

  /** War Score does not use sudden death. Kept so call sites stay compiling. */
  notifyHeroKill(): void {}

  reset(): void {
    this.phase = 'PLAYING';
    this.remainingMs = MATCH.durationMs;
    this.elapsedMs = 0;
    this.paused = false;
    this.winner = null;
    this.reason = null;
  }

  private finish(winner: TeamId | 'draw', reason: MatchEndReason): void {
    this.phase = 'FINISHED';
    this.winner = winner;
    this.reason = reason;
    this.remainingMs = 0;
  }
}

export const formatMatchClock = (remainingMs: number, phase: MatchPhase): string => {
  if (phase === 'SUDDEN_DEATH') {
    return 'SUDDEN DEATH';
  }
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
