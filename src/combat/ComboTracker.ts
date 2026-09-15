/**
 * Two-tap chain. Count only rises on distinct presses, not hold-repeats.
 * Window is from the previous tap, not the start of the string.
 * Holding attack pauses expiry so a long key-down does not kill the chain.
 */
export class ComboTracker {
  private count = 0;
  private lastTapAt = 0;
  private shown = 0;
  private shownUntil = 0;

  preview(now: number, windowMs: number): number {
    if (now - this.lastTapAt > windowMs) {
      return 1;
    }
    if (this.count >= 2) {
      return 1;
    }
    return this.count + 1;
  }

  tap(now: number, windowMs: number): number {
    this.count = this.preview(now, windowMs);
    this.lastTapAt = now;
    this.shown = this.count;
    this.shownUntil = now + Math.max(windowMs, 1400);
    return this.count;
  }

  expire(now: number, windowMs: number, keepAlive = false): void {
    if (keepAlive) {
      if (this.shown > 0) {
        this.shownUntil = Math.max(this.shownUntil, now + 160);
      }
      return;
    }
    if (this.count > 0 && now - this.lastTapAt > windowMs) {
      this.count = 0;
      this.lastTapAt = 0;
    }
    if (this.shown > 0 && now >= this.shownUntil) {
      this.shown = 0;
    }
  }

  /** After a hold ends, the next tap still has a full combo window. */
  holdReleased(now: number, windowMs: number): void {
    if (this.count === 0) {
      return;
    }
    this.lastTapAt = now;
    this.shownUntil = now + Math.max(windowMs, 1400);
  }

  /** Clear the chain so the next tap is HIT 1. HUD still shows the last step. */
  reset(): void {
    this.count = 0;
    this.lastTapAt = 0;
  }

  interrupt(now: number): void {
    this.reset();
    this.shownUntil = now + 400;
  }

  get step(): number {
    return this.shown;
  }
}
