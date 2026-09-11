import { COMBAT, ComboStep } from '../config/combat';

/**
 * Lightweight per-fighter combat timers.
 * Not a state machine — just the temporary modifiers combat needs.
 */
export class CombatStatus {
  private hitReactionUntil = 0;
  private attackSlowUntil = 0;
  private attackRecoveryUntil = 0;
  private blockStunUntil = 0;
  private clashLockUntil = 0;
  private hitFlashUntil = 0;
  private hitStopUntil = 0;
  private lungeUntil = 0;
  private lastSwingAt = -9999;
  private lastSwingStep: ComboStep = 1;

  markSwing(now: number, step: ComboStep): void {
    this.lastSwingAt = now;
    this.lastSwingStep = step;
  }

  get lastAttackAt(): number {
    return this.lastSwingAt;
  }

  get lastAttackStep(): ComboStep {
    return this.lastSwingStep;
  }

  applyHitReaction(now: number, step: ComboStep = 1): void {
    const reactionMs = COMBAT.combo[step].hitReactionMs;
    this.hitReactionUntil = now + reactionMs;
    this.attackSlowUntil = Math.min(now + COMBAT.hitSlowMaxMs, now + reactionMs + 80);
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

  applyLunge(now: number, durationMs: number): void {
    this.lungeUntil = now + durationMs;
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

  isLunging(now: number): boolean {
    return now < this.lungeUntil;
  }

  /** True when physics (knockback / lunge / stun) should own velocity. */
  shouldLockMovement(now: number): boolean {
    return (
      this.isHitReacting(now) ||
      this.isLunging(now) ||
      this.isBlockStunned(now) ||
      this.isHitStopping(now) ||
      this.isClashLocked(now)
    );
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
    if (this.isBlockStunned(now) || this.isHitStopping(now)) {
      return 0.2;
    }
    if (this.isHitReacting(now)) {
      return COMBAT.hitMoveMultiplier;
    }
    return 1;
  }

  extraSwingDelay(now: number): number {
    let extra = 0;
    if (now < this.attackSlowUntil) {
      extra += Math.round((COMBAT.hitAttackSlowMultiplier - 1) * 200);
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
