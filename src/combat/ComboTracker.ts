/**
 * Three-tap chain. Count only rises on distinct presses, not hold-repeats.
 * Window is from the previous tap, not the start of the string.
 */
export class ComboTracker {
  private count = 0;
  private lastTapAt = 0;

  preview(now: number, windowMs: number): number {
    return now - this.lastTapAt <= windowMs ? Math.min(3, this.count + 1) : 1;
  }

  tap(now: number, windowMs: number): number {
    this.count = this.preview(now, windowMs);
    this.lastTapAt = now;
    return this.count;
  }

  expire(now: number, windowMs: number): void {
    if (this.count > 0 && now - this.lastTapAt > windowMs) {
      this.reset();
    }
  }

  reset(): void {
    this.count = 0;
    this.lastTapAt = 0;
  }

  get step(): number {
    return this.count;
  }
}
