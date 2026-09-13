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
 * Explicit match clock and phase machine.
 * PLAYING → (tie) OVERTIME → (tie) SUDDEN_DEATH → FINISHED
 */
export class MatchManager {
  phase: MatchPhase = 'PLAYING';
  remainingMs: number = MATCH.durationMs;
  elapsedMs = 0;
  paused = false;
  winner: TeamId | 'draw' | null = null;
  reason: MatchEndReason | null = null;

  constructor(
    private readonly scores: () => { alpha: number; bravo: number },
  ) {}

  get finished(): boolean {
    return this.phase === 'FINISHED';
  }

  get playing(): boolean {
    return this.phase === 'PLAYING' || this.phase === 'OVERTIME' || this.phase === 'SUDDEN_DEATH';
  }

  snapshot(): MatchSnapshot {
    return {
      phase: this.phase,
      remainingMs: this.remainingMs,
      elapsedMs: this.elapsedMs,
      overtime: this.phase === 'OVERTIME',
      suddenDeath: this.phase === 'SUDDEN_DEATH',
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
    if (this.phase === 'SUDDEN_DEATH') {
      return;
    }
    this.remainingMs = Math.max(0, this.remainingMs - delta);
    if (this.remainingMs > 0) {
      return;
    }
    this.onClockExpired();
  }

  /** Call after every hero kill so sudden death can close the match. */
  notifyHeroKill(): void {
    if (this.phase !== 'SUDDEN_DEATH' || this.finished) {
      return;
    }
    const { alpha, bravo } = this.scores();
    if (alpha === bravo) {
      return;
    }
    this.finish(alpha > bravo ? 'alpha' : 'bravo', 'sudden-death');
  }

  reset(): void {
    this.phase = 'PLAYING';
    this.remainingMs = MATCH.durationMs;
    this.elapsedMs = 0;
    this.paused = false;
    this.winner = null;
    this.reason = null;
  }

  private onClockExpired(): void {
    const { alpha, bravo } = this.scores();
    if (alpha !== bravo) {
      this.finish(alpha > bravo ? 'alpha' : 'bravo', this.phase === 'OVERTIME' ? 'overtime' : 'time');
      return;
    }
    if (this.phase === 'PLAYING') {
      this.phase = 'OVERTIME';
      this.remainingMs = MATCH.overtimeMs;
      return;
    }
    if (this.phase === 'OVERTIME' && MATCH.suddenDeathEnabled) {
      this.phase = 'SUDDEN_DEATH';
      this.remainingMs = 0;
      return;
    }
    this.finish('draw', this.phase === 'OVERTIME' ? 'overtime' : 'time');
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
