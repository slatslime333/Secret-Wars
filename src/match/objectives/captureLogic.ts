import type { TeamId } from '../../config/hero';
import { OBJECTIVE } from '../../config/objective';

export type CapturePhase = 'idle' | 'capturing' | 'contested' | 'grace' | 'decaying';

export type CaptureOccupancy = {
  alpha: number;
  bravo: number;
};

export type CaptureSnap = {
  owner: TeamId | null;
  progress: number;
  phase: CapturePhase;
  graceLeftMs: number;
};

export const emptyCapture = (): CaptureSnap => ({
  owner: null,
  progress: 0,
  phase: 'idle',
  graceLeftMs: 0,
});

const soleOf = (occ: CaptureOccupancy): TeamId | null => {
  const a = occ.alpha > 0;
  const b = occ.bravo > 0;
  if (a && !b) {
    return 'alpha';
  }
  if (b && !a) {
    return 'bravo';
  }
  return null;
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * One capture-zone tick. Occupancy is living players in the center.
 * More teammates do not speed the clock — presence is boolean per team.
 */
export const tickCapture = (
  snap: CaptureSnap,
  occupancy: CaptureOccupancy,
  dt: number,
  captureMs = OBJECTIVE.capture.captureMs,
  graceMs = OBJECTIVE.capture.graceMs,
  decayMul = OBJECTIVE.capture.decayMul,
): { snap: CaptureSnap; capturedBy: TeamId | null } => {
  if (dt <= 0) {
    return { snap, capturedBy: null };
  }
  const both = occupancy.alpha > 0 && occupancy.bravo > 0;
  const none = occupancy.alpha <= 0 && occupancy.bravo <= 0;
  const sole = soleOf(occupancy);
  const rate = dt / Math.max(1, captureMs);

  if (both) {
    return {
      snap: {
        owner: snap.owner,
        progress: snap.progress,
        phase: snap.progress > 0 || snap.owner ? 'contested' : 'contested',
        graceLeftMs: graceMs,
      },
      capturedBy: null,
    };
  }

  if (sole && (snap.owner === sole || snap.owner === null || snap.progress <= 0)) {
    const progress = clamp01((snap.progress <= 0 ? 0 : snap.progress) + rate);
    const next: CaptureSnap = {
      owner: sole,
      progress,
      phase: 'capturing',
      graceLeftMs: graceMs,
    };
    return { snap: next, capturedBy: progress >= 1 ? sole : null };
  }

  if (none) {
    if (!snap.owner || snap.progress <= 0) {
      return { snap: emptyCapture(), capturedBy: null };
    }
    if (snap.phase === 'capturing' || snap.phase === 'contested') {
      return {
        snap: { ...snap, phase: 'grace', graceLeftMs: graceMs },
        capturedBy: null,
      };
    }
    if (snap.phase === 'grace') {
      const left = snap.graceLeftMs - dt;
      if (left > 0) {
        return { snap: { ...snap, phase: 'grace', graceLeftMs: left }, capturedBy: null };
      }
      return { snap: { ...snap, phase: 'decaying', graceLeftMs: 0 }, capturedBy: null };
    }
    const progress = clamp01(snap.progress - rate * decayMul);
    if (progress <= 0) {
      return { snap: emptyCapture(), capturedBy: null };
    }
    return { snap: { ...snap, progress, phase: 'decaying', graceLeftMs: 0 }, capturedBy: null };
  }

  // Enemy is the sole occupant while leftover progress belongs to the other team.
  if (snap.phase === 'capturing' || snap.phase === 'contested') {
    return {
      snap: { ...snap, phase: 'grace', graceLeftMs: graceMs },
      capturedBy: null,
    };
  }
  if (snap.phase === 'grace') {
    const left = snap.graceLeftMs - dt;
    if (left > 0) {
      return { snap: { ...snap, phase: 'grace', graceLeftMs: left }, capturedBy: null };
    }
    return { snap: { ...snap, phase: 'decaying', graceLeftMs: 0 }, capturedBy: null };
  }
  const progress = clamp01(snap.progress - rate * decayMul);
  if (progress <= 0 && sole) {
    const started = clamp01(rate);
    return {
      snap: { owner: sole, progress: started, phase: 'capturing', graceLeftMs: graceMs },
      capturedBy: started >= 1 ? sole : null,
    };
  }
  if (progress <= 0) {
    return { snap: emptyCapture(), capturedBy: null };
  }
  return { snap: { ...snap, progress, phase: 'decaying', graceLeftMs: 0 }, capturedBy: null };
};
