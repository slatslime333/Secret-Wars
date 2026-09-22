import { escapeAround, steerAround } from '../../map/query';
import type { KitProfile, Personality } from './types';

export type WalkQuery = {
  blocksMovement: (x: number, y: number, radius?: number) => boolean;
  steer: (x: number, y: number, dx: number, dy: number, look?: number) => { x: number; y: number };
  /** When a walk would cross a house, the next point in a door opening. */
  doorStep?: (x: number, y: number, goalX: number, goalY: number) => { x: number; y: number } | undefined;
};

export type WalkMate = { x: number; y: number };

type StuckPhase = 'clear' | 'strafe' | 'swap' | 'back' | 'fan';

const hypot = (x: number, y: number): number => Math.hypot(x, y);

/**
 * Progress-based stuck recovery. Collision alone is not enough — lack of
 * travel while we still have a destination is.
 */
export class StuckTracker {
  private lastX = 0;
  private lastY = 0;
  private lastAt = 0;
  private stillMs = 0;
  private lastHx = 0;
  private lastHy = 0;
  private flips = 0;
  private phase: StuckPhase = 'clear';
  private phaseUntil = 0;
  private side = 1;
  private rx = 0;
  private ry = 0;
  private dashUntil = 0;
  label = '';
  private cleared = false;

  consumeCleared(): boolean {
    const yes = this.cleared;
    this.cleared = false;
    return yes;
  }

  get recovering(): boolean {
    return this.phase !== 'clear';
  }

  reset(): void {
    this.stillMs = 0;
    this.flips = 0;
    this.phase = 'clear';
    this.phaseUntil = 0;
    this.dashUntil = 0;
    this.label = '';
    this.lastAt = 0;
    this.cleared = false;
  }

  /** Open recovery heading for a dash, if a dash is actually useful. */
  dashEscape(now: number): { x: number; y: number } | undefined {
    if (this.phase === 'clear' || now < this.dashUntil) {
      return undefined;
    }
    if (this.phase === 'strafe' && this.stillMs < 520) {
      return undefined;
    }
    const len = hypot(this.rx, this.ry);
    if (len < 0.2) {
      return undefined;
    }
    return { x: this.rx / len, y: this.ry / len };
  }

  markDashed(now: number): void {
    this.dashUntil = now + 980;
  }

  /**
   * Blend the local steer with a committed recovery heading when travel has failed.
   */
  filter(
    now: number,
    x: number,
    y: number,
    desired: { x: number; y: number },
    steered: { x: number; y: number },
    speed: number,
    query: WalkQuery | undefined,
    personality: Personality,
    kit: KitProfile | undefined,
    mates?: WalkMate[],
    role?: string,
  ): { x: number; y: number } {
    const dt = this.lastAt === 0 ? 0 : Math.max(0, Math.min(80, now - this.lastAt));
    const dist = this.lastAt === 0 ? 0 : hypot(x - this.lastX, y - this.lastY);
    const hx = steered.x || desired.x;
    const hy = steered.y || desired.y;
    if (this.lastAt > 0 && hypot(hx, hy) > 0.2) {
      const nlen = hypot(hx, hy) || 1;
      const nx = hx / nlen;
      const ny = hy / nlen;
      const flip = this.lastHx * nx + this.lastHy * ny;
      if (dist < 7 && flip < -0.35) {
        this.flips += 1;
      } else if (dist > 10) {
        this.flips = 0;
      }
      this.lastHx = nx;
      this.lastHy = ny;
    }
    this.lastX = x;
    this.lastY = y;
    this.lastAt = now;

    const expected = speed * (dt / 1000);
    const blockedAhead = query
      ? query.blocksMovement(x + desired.x * 30, y + desired.y * 30, 12)
      : steered.x === 0 && steered.y === 0;
    const inside = Boolean(query?.blocksMovement(x, y, 7));
    const packed = mateDeadlock(x, y, desired, mates);
    const grinding =
      expected > 3.5 &&
      dist < expected * 0.2 &&
      (blockedAhead || inside || packed || (steered.x === 0 && steered.y === 0) || this.flips >= 3);

    if (grinding) {
      this.stillMs += dt;
    } else {
      this.stillMs = Math.max(0, this.stillMs - dt * 1.35);
    }

    const trigger = triggerMs(speed, personality, kit, role);
    if (this.phase === 'clear' && (inside || this.stillMs >= trigger)) {
      this.begin(now, x, y, desired, query, personality, kit, openSide(x, y, desired, query), 'strafe');
    }

    const slide = (): { x: number; y: number } => {
      if (steered.x !== 0 || steered.y !== 0) {
        return steered;
      }
      if (!query) {
        return desired;
      }
      const side = openSide(x, y, desired, query);
      const nlen = hypot(desired.x, desired.y) || 1;
      return { x: (-desired.y / nlen) * side, y: (desired.x / nlen) * side };
    };

    if (this.phase === 'clear') {
      return slide();
    }

    if (!inside && dist > Math.max(11, speed * 0.045) && this.stillMs < trigger * 0.45) {
      this.clear();
      return slide();
    }

    if (now >= this.phaseUntil) {
      this.advance(now, x, y, desired, query, personality, kit);
    }

    const recover = { x: this.rx, y: this.ry };
    if (query && query.blocksMovement(x + recover.x * 22, y + recover.y * 22, 11)) {
      const next = query.steer(x, y, recover.x, recover.y, 40);
      if (next.x !== 0 || next.y !== 0) {
        this.rx = next.x;
        this.ry = next.y;
        return next;
      }
    }
    return recover;
  }

  private begin(
    now: number,
    x: number,
    y: number,
    desired: { x: number; y: number },
    query: WalkQuery | undefined,
    personality: Personality,
    kit: KitProfile | undefined,
    side: number,
    phase: StuckPhase,
  ): void {
    this.phase = phase;
    this.side = side;
    const hold = commitMs(personality, kit, phase);
    this.phaseUntil = now + hold;
    const dir = pickRecover(phase, side, x, y, desired, query);
    this.rx = dir.x;
    this.ry = dir.y;
    this.label = `stuck-${phase}`;
    if (this.stillMs > 640) {
      this.dashUntil = Math.min(this.dashUntil, now);
    }
  }

  private advance(
    now: number,
    x: number,
    y: number,
    desired: { x: number; y: number },
    query: WalkQuery | undefined,
    personality: Personality,
    kit: KitProfile | undefined,
  ): void {
    const order: StuckPhase[] = ['strafe', 'swap', 'back', 'fan'];
    const index = order.indexOf(this.phase);
    const next = order[Math.min(order.length - 1, index + 1)] ?? 'fan';
    const side = next === 'swap' ? -this.side : this.side;
    this.begin(now, x, y, desired, query, personality, kit, side, next);
  }

  private clear(): void {
    this.phase = 'clear';
    this.phaseUntil = 0;
    this.stillMs = 0;
    this.flips = 0;
    this.label = '';
    this.cleared = true;
  }
}

const triggerMs = (
  speed: number,
  personality: Personality,
  kit: KitProfile | undefined,
  role?: string,
): number => {
  const slow = Math.max(0, 210 - speed);
  let ms = 270 + slow * 0.9 + personality.caution * 70 + personality.patience * 30;
  if (kit?.stance === 'melee' || kit?.stance === 'skirmish') {
    ms -= 36;
  }
  if (kit?.stance === 'ranged' || kit?.stance === 'support') {
    ms -= 18;
  }
  if (role === 'tank' || role === 'frontliner') {
    ms += 50;
  }
  if (role === 'minion') {
    ms += 90;
  }
  return Math.max(220, Math.min(520, ms));
};

const commitMs = (personality: Personality, kit: KitProfile | undefined, phase: StuckPhase): number => {
  let hold = 260 + (1 - personality.movementPrecision) * 90 + personality.thinkJitterMs * 0.25;
  if (kit?.stance === 'melee') {
    hold += 40;
  }
  if (kit?.stance === 'ranged' || kit?.stance === 'support') {
    hold -= 20;
  }
  if (phase === 'fan' || phase === 'back') {
    hold += 40;
  }
  return Math.max(220, Math.min(460, hold));
};

const mateDeadlock = (
  x: number,
  y: number,
  desired: { x: number; y: number },
  mates?: WalkMate[],
): boolean => {
  if (!mates || mates.length === 0) {
    return false;
  }
  const nlen = hypot(desired.x, desired.y) || 1;
  const nx = desired.x / nlen;
  const ny = desired.y / nlen;
  let inFront = 0;
  for (const mate of mates) {
    const mx = mate.x - x;
    const my = mate.y - y;
    const d = hypot(mx, my);
    if (d > 34 || d < 1) {
      continue;
    }
    if ((mx * nx + my * ny) / d > 0.35) {
      inFront += 1;
    }
  }
  return inFront >= 1;
};

const pickRecover = (
  phase: StuckPhase,
  side: number,
  x: number,
  y: number,
  desired: { x: number; y: number },
  query: WalkQuery | undefined,
): { x: number; y: number } => {
  const nlen = hypot(desired.x, desired.y) || 1;
  const nx = desired.x / nlen;
  const ny = desired.y / nlen;
  const left = { x: -ny * side, y: nx * side };
  const blocked = (px: number, py: number, radius: number) =>
    Boolean(query?.blocksMovement(px, py, radius));

  if (phase === 'back') {
    const away = escapeAround(blocked, x, y, -nx, -ny, 34);
    return away;
  }
  if (phase === 'fan') {
    return escapeAround(blocked, x, y, nx, ny, 40);
  }

  const lat = phase === 'swap' ? { x: -left.x, y: -left.y } : left;
  const mixed = { x: nx * 0.28 + lat.x, y: ny * 0.28 + lat.y };
  if (!query) {
    const len = hypot(mixed.x, mixed.y) || 1;
    return { x: mixed.x / len, y: mixed.y / len };
  }
  const steered = steerAround(blocked, x, y, mixed.x, mixed.y, 38);
  if (steered.x !== 0 || steered.y !== 0) {
    return steered;
  }
  const other = steerAround(blocked, x, y, -mixed.x, -mixed.y, 34);
  if (other.x !== 0 || other.y !== 0) {
    return other;
  }
  return escapeAround(blocked, x, y, nx, ny, 36);
};

/** Prefer the lateral side with more free space so recovery does not guess blindly. */
const openSide = (
  x: number,
  y: number,
  desired: { x: number; y: number },
  query: WalkQuery | undefined,
): number => {
  const nlen = hypot(desired.x, desired.y) || 1;
  const nx = desired.x / nlen;
  const ny = desired.y / nlen;
  const score = (side: number): number => {
    const lx = -ny * side;
    const ly = nx * side;
    const near = Boolean(query?.blocksMovement(x + lx * 28, y + ly * 28, 12));
    const mid = Boolean(query?.blocksMovement(x + lx * 44, y + ly * 44, 12));
    const far = Boolean(query?.blocksMovement(x + lx * 62, y + ly * 62, 12));
    const toward = Boolean(query?.blocksMovement(x + nx * 16 + lx * 36, y + ny * 16 + ly * 36, 12));
    return (near ? 0 : 1.2) + (mid ? 0 : 0.8) + (far ? 0 : 0.4) + (toward ? 0 : 0.35);
  };
  return score(-1) > score(1) ? -1 : 1;
};

/** Blocker used by scenario tests: a vertical wall spanning y. */
export class WallProbe implements WalkQuery {
  constructor(
    private readonly wallX: number,
    private readonly wallW: number,
  ) {}

  blocksMovement(x: number, _y: number, radius = 12): boolean {
    return x + radius > this.wallX && x - radius < this.wallX + this.wallW;
  }

  steer(x: number, y: number, dx: number, dy: number, look = 34): { x: number; y: number } {
    if (this.blocksMovement(x, y, 8)) {
      return escapeAround((px, py, radius) => this.blocksMovement(px, py, radius), x, y, dx, dy, 22);
    }
    return steerAround((px, py, radius) => this.blocksMovement(px, py, radius), x, y, dx, dy, look);
  }
}

/** L-shaped corner: solid east of `wallX` or south of `wallY`. */
export class CornerProbe implements WalkQuery {
  constructor(
    private readonly wallX: number,
    private readonly wallY: number,
  ) {}

  blocksMovement(x: number, y: number, radius = 12): boolean {
    return x + radius > this.wallX || y + radius > this.wallY;
  }

  steer(x: number, y: number, dx: number, dy: number, look = 34): { x: number; y: number } {
    if (this.blocksMovement(x, y, 8)) {
      return escapeAround((px, py, radius) => this.blocksMovement(px, py, radius), x, y, dx, dy, 22);
    }
    return steerAround((px, py, radius) => this.blocksMovement(px, py, radius), x, y, dx, dy, look);
  }
}
