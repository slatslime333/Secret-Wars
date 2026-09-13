import type { Personality } from './types';

/**
 * Hold a movement heading for a short window so CPUs do not snap to a new
 * perfect vector every frame. Corrections stay small; re-aims happen when the
 * desired heading actually changes.
 */
export class MovementCommit {
  private hx = 0;
  private hy = 0;
  private until = 0;
  private armed = false;
  readonly rangeBias: number;

  constructor(personality: Personality) {
    const overshoot = (personality.aggression - personality.caution) * 0.1;
    this.rangeBias = 1 + overshoot + (personality.preferredDistance - 0.5) * 0.06;
  }

  heading(now: number, desiredX: number, desiredY: number, personality: Personality): { x: number; y: number } {
    const len = Math.hypot(desiredX, desiredY) || 1;
    const nx = desiredX / len;
    const ny = desiredY / len;
    const precision = personality.movementPrecision;
    const blend = 0.12 + precision * 0.26;
    const hold = 170 + (1 - precision) * 230 + personality.thinkJitterMs * 0.2;
    if (!this.armed) {
      this.hx = nx;
      this.hy = ny;
      this.until = now + hold;
      this.armed = true;
      return { x: this.hx, y: this.hy };
    }
    const aligned = this.hx * nx + this.hy * ny;
    if (now >= this.until || aligned < 0.52) {
      this.hx = this.hx * (1 - blend) + nx * blend;
      this.hy = this.hy * (1 - blend) + ny * blend;
      const nlen = Math.hypot(this.hx, this.hy) || 1;
      this.hx /= nlen;
      this.hy /= nlen;
      this.until = now + hold;
    } else {
      const ease = blend * 0.32;
      this.hx += (nx - this.hx) * ease;
      this.hy += (ny - this.hy) * ease;
      const nlen = Math.hypot(this.hx, this.hy) || 1;
      this.hx /= nlen;
      this.hy /= nlen;
    }
    return { x: this.hx, y: this.hy };
  }

  reset(): void {
    this.armed = false;
  }
}
