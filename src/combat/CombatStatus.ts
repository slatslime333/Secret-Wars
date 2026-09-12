import { COMBAT, ComboStep } from '../config/combat';
import type { AreaModifier } from '../heroes/abilities/AbilityWorld';

const OPEN_ZONE: AreaModifier = { moveMul: 1, attackSpeedMul: 1, staminaDrainMul: 1 };

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
  private controlLockUntil = 0;
  private zone: AreaModifier = OPEN_ZONE;
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

  applyHitReaction(now: number, step: ComboStep = 1, reactionMs?: number): void {
    const duration = reactionMs ?? COMBAT.combo[step].hitReactionMs;
    this.hitReactionUntil = now + duration;
    this.attackSlowUntil = Math.min(now + COMBAT.hitSlowMaxMs, now + duration + 80);
    this.hitFlashUntil = now + COMBAT.hitFlashMs;
  }

  applyStun(now: number, durationMs: number): void {
    this.applyHitReaction(now, 1, durationMs);
  }

  applyControlLock(now: number, durationMs: number): void {
    this.controlLockUntil = Math.max(this.controlLockUntil, now + durationMs);
  }

  setZoneModifiers(modifiers: AreaModifier): void {
    this.zone = modifiers;
  }

  clearZoneModifiers(): void {
    this.zone = OPEN_ZONE;
  }

  staminaDrainMultiplier(): number {
    return this.zone.staminaDrainMul;
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
  isControlLocked(now: number): boolean {
    return now < this.controlLockUntil;
  }

  shouldLockMovement(now: number): boolean {
    return (
      this.isHitReacting(now) ||
      this.isLunging(now) ||
      this.isBlockStunned(now) ||
      this.isHitStopping(now) ||
      this.isClashLocked(now) ||
      this.isControlLocked(now)
    );
  }

  /** True when the fighter should not start a new swing. */
  cannotAttack(now: number): boolean {
    return (
      this.isBlockStunned(now) ||
      this.isClashLocked(now) ||
      this.isControlLocked(now) ||
      now < this.attackRecoveryUntil
    );
  }

  moveMultiplier(now: number): number {
    if (this.isBlockStunned(now) || this.isHitStopping(now)) {
      return 0.2 * this.zone.moveMul;
    }
    if (this.isHitReacting(now)) {
      return COMBAT.hitMoveMultiplier * this.zone.moveMul;
    }
    return this.zone.moveMul;
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
    const hitSlow = now < this.attackSlowUntil ? COMBAT.hitAttackSlowMultiplier : 1;
    return hitSlow / this.zone.attackSpeedMul;
  }
}
