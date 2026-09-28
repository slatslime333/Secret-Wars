import { SIX_ZONE_SCORE } from '../../config/score';
import type { TeamId } from '../../config/hero';
import { emptyCapture, tickCapture, type CaptureOccupancy, type CaptureSnap } from './captureLogic';

export type SixZonePhase = 'active' | 'cooldown';

export type SixZoneModel = {
  phase: SixZonePhase;
  leftMs: number;
  snap: CaptureSnap;
  secured: TeamId | null;
  holdMs: number;
  x: number;
  y: number;
};

export type SixZoneEvent =
  | { type: 'capture'; team: TeamId }
  | { type: 'hold'; team: TeamId }
  | { type: 'cooldown' }
  | { type: 'respawn' };

export const freshSixZone = (x: number, y: number): SixZoneModel => ({
  phase: 'active',
  leftMs: SIX_ZONE_SCORE.activeMs,
  snap: emptyCapture(),
  secured: null,
  holdMs: 0,
  x,
  y,
});

const cleared = (model: SixZoneModel, phase: SixZonePhase, leftMs: number): SixZoneModel => ({
  ...model,
  phase,
  leftMs,
  snap: emptyCapture(),
  secured: null,
  holdMs: 0,
});

/**
 * One zone for one slice of match time. Scoring uses elapsed milliseconds,
 * and a capture bonus fires only when progress first fills for a new owner.
 */
export const stepSixZone = (
  model: SixZoneModel,
  dt: number,
  occupancy: CaptureOccupancy,
  scoring: boolean,
): { model: SixZoneModel; events: SixZoneEvent[] } => {
  if (!scoring || dt <= 0) {
    return { model, events: [] };
  }
  if (model.phase === 'cooldown') {
    const left = model.leftMs - dt;
    if (left > 0) {
      return { model: { ...model, leftMs: left }, events: [] };
    }
    return { model: cleared(model, 'active', 0), events: [{ type: 'respawn' }] };
  }

  const usable = Math.min(dt, model.leftMs);
  const events: SixZoneEvent[] = [];
  const prev = model.snap;
  const result = tickCapture(prev, occupancy, usable);
  let secured = model.secured;
  let holdMs = model.holdMs;
  const crossing =
    Boolean(result.capturedBy) &&
    prev.progress < 1 &&
    result.snap.progress >= 1 &&
    secured !== result.capturedBy;
  if (crossing && result.capturedBy) {
    secured = result.capturedBy;
    events.push({ type: 'capture', team: result.capturedBy });
  }
  if (!result.snap.owner || result.snap.progress <= 0) {
    secured = null;
    holdMs = 0;
  }
  const contested = result.snap.phase === 'contested' || (occupancy.alpha > 0 && occupancy.bravo > 0);
  if (secured && !contested && result.snap.progress > 0) {
    let holdSlice = usable;
    if (crossing) {
      const from = Math.max(0, prev.progress);
      const gained = Math.max(0.0001, result.snap.progress - from);
      const timeToFill = ((1 - from) / gained) * usable;
      holdSlice = Math.max(0, usable - timeToFill);
    }
    holdMs += holdSlice;
    while (holdMs >= 1000) {
      holdMs -= 1000;
      events.push({ type: 'hold', team: secured });
    }
  }
  const left = model.leftMs - dt;
  if (left <= 0) {
    return { model: cleared(model, 'cooldown', SIX_ZONE_SCORE.cooldownMs), events: [...events, { type: 'cooldown' }] };
  }
  return {
    model: { ...model, leftMs: left, snap: result.snap, secured, holdMs },
    events,
  };
};

export type ZoneSite = { x: number; y: number };

export type ZoneSiteQuery = {
  playable: { x: number; y: number; w: number; h: number };
  spawns: readonly { x: number; y: number; radius: number }[];
  blocked: (x: number, y: number, clearRadius: number) => boolean;
};

const hypot = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/**
 * Random playable point away from spawns, walls, and the other zone.
 * Falls back to the furthest valid sample if the map is tight.
 */
export const pickSixZoneSite = (
  query: ZoneSiteQuery,
  rng: () => number,
  clearRadius: number,
  zoneRadius: number,
  avoid: readonly ZoneSite[],
): ZoneSite => {
  const pad = Math.max(72, zoneRadius * 0.35);
  const box = query.playable;
  const minSep = Math.max(zoneRadius * 2.6, 520);
  const spawnGap = 260;
  const fits = (x: number, y: number): boolean => {
    if (x < box.x + pad || y < box.y + pad || x > box.x + box.w - pad || y > box.y + box.h - pad) {
      return false;
    }
    for (const spawn of query.spawns) {
      if (hypot(x, y, spawn.x, spawn.y) < spawn.radius + spawnGap) {
        return false;
      }
    }
    for (const other of avoid) {
      if (hypot(x, y, other.x, other.y) < minSep) {
        return false;
      }
    }
    return !query.blocked(x, y, clearRadius);
  };
  let best: ZoneSite | undefined;
  let bestClear = -1;
  for (let i = 0; i < 48; i += 1) {
    const x = box.x + pad + rng() * Math.max(8, box.w - pad * 2);
    const y = box.y + pad + rng() * Math.max(8, box.h - pad * 2);
    if (!fits(x, y)) {
      continue;
    }
    let clear = 9999;
    for (const spawn of query.spawns) {
      clear = Math.min(clear, hypot(x, y, spawn.x, spawn.y));
    }
    for (const other of avoid) {
      clear = Math.min(clear, hypot(x, y, other.x, other.y));
    }
    if (clear > bestClear) {
      bestClear = clear;
      best = { x, y };
    }
    if (clear > minSep * 1.15 && rng() > 0.45) {
      return { x, y };
    }
  }
  if (best) {
    return best;
  }
  const step = 140;
  for (let y = box.y + pad; y <= box.y + box.h - pad; y += step) {
    for (let x = box.x + pad; x <= box.x + box.w - pad; x += step) {
      if (fits(x, y)) {
        return { x, y };
      }
    }
  }
  const relaxed = avoid.length > 0 ? avoid.slice(0, -1) : avoid;
  if (relaxed.length !== avoid.length) {
    return pickSixZoneSite(query, rng, clearRadius, zoneRadius, relaxed);
  }
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
};

export const zoneCountdownSec = (leftMs: number): number => Math.max(0, Math.ceil(leftMs / 1000));

/** World and HUD copy for one standing zone. */
export const zoneStatusLabel = (model: SixZoneModel, contested: boolean): string => {
  const sec = zoneCountdownSec(model.leftMs);
  if (model.phase === 'cooldown') {
    return `RESPAWNING ${sec}`;
  }
  if (contested && model.secured) {
    return `PAUSED ${sec}`;
  }
  if (contested) {
    return `CONTESTED ${sec}`;
  }
  return `ZONE ${sec}`;
};

export const zoneCaptureSource = (id: string, generation: number, serial: number): string =>
  `six:${id}:g${generation}:n${serial}`;
