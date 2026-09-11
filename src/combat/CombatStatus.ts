import { COMBAT } from '../config/combat';

/**
 * Lightweight per-fighter combat timers.
 * Not a state machine — just the temporary modifiers the overhaul needs.
 */
export class CombatStatus {
  private hitReactionUntil = 0;
  private attackSlowUntil = 0;
  private attackRecoveryUntil = 0;
  private blockStunUntil = 0;
  private clashLockUntil = 0;
  private hitFlashUntil = 0;
  private hitStopUntil = 0;
  private lastSwingAt = -9999;
  private lastSwingStep: 1 | 2 | 3 = 1;

  markSwing(now: number, step: 1 | 2 | 3): void {
    this.lastSwingAt = now;
    this.lastSwingStep = step;
  }

  get lastAttackAt(): number {
    return this.lastSwingAt;
  }

  get lastAttackStep(): 1 | 2 | 3 {
    return this.lastSwingStep;
  }

  applyHitReaction(now: number): void {
    this.hitReactionUntil = now + COMBAT.hitReactionMs;
    this.attackSlowUntil = Math.min(
      now + COMBAT.hitSlowMaxMs,
      Math.max(this.attackSlowUntil, now) + COMBAT.hitReactionMs,
    );
    this.hitFlashUntil = now + COMBAT.hitFlashMs;
  }

  applyAttackRecovery(now: number, recoveryMs: number): void {
    this.attackRecoveryUntil = Math.max(this.attackRecoveryUntil, now + recoveryMs);
  }

  applyBlockStun(now: number, durationMs: number): void {
    this.blockStunUntil = now + durationMs;
  }

  applyClashLock(now: number): void {
    this.clashLockUntil = now + COMBAT.hitStopClashMs + 40;
  }

  applyHitStop(now: number, durationMs: number): void {
    this.hitStopUntil = Math.max(this.hitStopUntil, now + durationMs);
  }

  isHitReacting(now: number): boolean {
    return now < this.hitReactionUntil;
  }

  isFlashingHit(now: number): boolean {
    return now < this.hitFlashUntil;
  }

  isBlockStunned(now: number): boolean {
    return now < this.blockStunUntil;
  }

  isClashLocked(now: number): boolean {
    return now < this.clashLockUntil;
  }

  isHitStopping(now: number): boolean {
    return now < this.hitStopUntil;
  }

  /** True when the fighter should not start a new swing. */
  cannotAttack(now: number): boolean {
    return (
      this.isBlockStunned(now) ||
      this.isClashLocked(now) ||
      now < this.attackRecoveryUntil
    );
  }

  moveMultiplier(now: number): number {
    if (this.isBlockStunned(now)) {
      return 0.35;
    }
    if (this.isHitReacting(now)) {
      return COMBAT.hitMoveMultiplier;
    }
    return 1;
  }

  /** Extra milliseconds added to the next swing delay. */
  extraSwingDelay(now: number): number {
    let extra = 0;
    if (now < this.attackSlowUntil) {
      extra += Math.round(
        (COMBAT.hitAttackSlowMultiplier - 1) * 200,
      );
    }
    if (now < this.attackRecoveryUntil) {
      extra += this.attackRecoveryUntil - now;
    }
    return extra;
  }

  attackSlowMultiplier(now: number): number {
    return now < this.attackSlowUntil ? COMBAT.hitAttackSlowMultiplier : 1;
  }
}
