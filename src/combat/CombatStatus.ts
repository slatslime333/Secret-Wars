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
  private slowUntil = 0;
  private slowMul = 1;
  private commitSlowUntil = 0;
  private commitSlowMul = 1;
  private hasteUntil = 0;
  private hasteMoveMul = 1;
  private hasteAttackMul = 1;
  private asDebuffUntil = 0;
  private asDebuffMul = 1;
  private crippleUntil = 0;
  private crippleAmount = 0;
  private paralyzeUntil = 0;
  private stunUntil = 0;
  private defenseUntil = 0;
  private defenseMul = 1;
  private staminaRegenUntil = 0;
  private staminaRegenMul = 1;
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
    this.stunUntil = Math.max(this.stunUntil, now + durationMs);
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

  /** Reusable move slow. `moveMul` 0.8 = 20% slower. */
  applySlow(now: number, durationMs: number, moveMul: number): void {
    if (now + durationMs >= this.slowUntil) {
      this.slowUntil = now + durationMs;
      this.slowMul = moveMul;
    } else if (moveMul < this.slowMul) {
      this.slowMul = moveMul;
    }
  }

  /** Attack-animation commitment slow. Does not overwrite combat slows. */
  applyCommitSlow(now: number, durationMs: number, moveMul: number): void {
    this.commitSlowUntil = now + durationMs;
    this.commitSlowMul = moveMul;
  }

  /** Temporary +move / +attack-speed buff. Refresh duration; do not stack. */
  applyHasteBuff(now: number, durationMs: number, moveMul: number, attackSpeedMul: number): void {
    this.hasteUntil = now + durationMs;
    this.hasteMoveMul = moveMul;
    this.hasteAttackMul = 1 / Math.max(0.2, attackSpeedMul);
  }

  /** Attack-speed reduction as a cooldown multiplier (1.3 = 30% slower). Does not stack. */
  applyAttackSpeedSlow(now: number, durationMs: number, cooldownMul: number): void {
    this.asDebuffUntil = now + durationMs;
    this.asDebuffMul = cooldownMul;
  }

  /** Stacking move + attack-speed cut. Each hit adds `perHit` (0.06 = 6%) up to `cap`. */
  applyStackedCripple(now: number, durationMs: number, perHit: number, cap: number): void {
    if (now >= this.crippleUntil) {
      this.crippleAmount = 0;
    }
    this.crippleAmount = Math.min(cap, this.crippleAmount + perHit);
    this.crippleUntil = now + durationMs;
  }

  applyDefenseBuff(now: number, durationMs: number, mul: number): void {
    this.defenseUntil = now + durationMs;
    this.defenseMul = mul;
  }

  applyStaminaRegenBuff(now: number, durationMs: number, mul: number): void {
    this.staminaRegenUntil = now + durationMs;
    this.staminaRegenMul = mul;
  }

  defenseMultiplier(now: number): number {
    return now < this.defenseUntil ? this.defenseMul : 1;
  }

  staminaRegenMultiplier(now: number): number {
    return now < this.staminaRegenUntil ? this.staminaRegenMul : 1;
  }

  clearTimedBuffs(): void {
    this.hasteUntil = 0;
    this.hasteMoveMul = 1;
    this.hasteAttackMul = 1;
    this.defenseUntil = 0;
    this.defenseMul = 1;
    this.staminaRegenUntil = 0;
    this.staminaRegenMul = 1;
  }

  applyParalyze(now: number, durationMs: number): void {
    this.paralyzeUntil = Math.max(this.paralyzeUntil, now + durationMs);
    this.applyStun(now, durationMs);
  }

  isSlowed(now: number): boolean {
    return now < this.slowUntil;
  }

  isParalyzed(now: number): boolean {
    return now < this.paralyzeUntil;
  }

  isStunned(now: number): boolean {
    return now < this.stunUntil;
  }

  /**
   * Only hard crowd-control blocks abilities. Slows, cripple, hit-flinch,
   * clash, and block-stun still let the fighter fire kit once their own
   * animation / control lock is done.
   */
  isEnemyActionLocked(now: number): boolean {
    return this.isParalyzed(now) || this.isStunned(now);
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
      this.isStunned(now) ||
      this.isLunging(now) ||
      this.isBlockStunned(now) ||
      this.isHitStopping(now) ||
      this.isClashLocked(now) ||
      this.isControlLocked(now) ||
      this.isParalyzed(now)
    );
  }

  /** True when the fighter should not start a new swing. */
  cannotAttack(now: number): boolean {
    return (
      this.isBlockStunned(now) ||
      this.isClashLocked(now) ||
      this.isControlLocked(now) ||
      this.isHitStopping(now) ||
      this.isStunned(now) ||
      this.isParalyzed(now) ||
      now < this.attackRecoveryUntil
    );
  }

  moveMultiplier(now: number): number {
    if (this.isParalyzed(now)) {
      return 0;
    }
    const slow = now < this.slowUntil ? this.slowMul : 1;
    const commit = now < this.commitSlowUntil ? this.commitSlowMul : 1;
    const haste = now < this.hasteUntil ? this.hasteMoveMul : 1;
    const cripple = now < this.crippleUntil ? 1 - this.crippleAmount : 1;
    if (this.isBlockStunned(now) || this.isHitStopping(now)) {
      return 0.2 * this.zone.moveMul * slow * commit * haste * cripple;
    }
    if (this.isHitReacting(now)) {
      return COMBAT.hitMoveMultiplier * this.zone.moveMul * slow * commit * haste * cripple;
    }
    return this.zone.moveMul * slow * commit * haste * cripple;
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
    const haste = now < this.hasteUntil ? this.hasteAttackMul : 1;
    const debuff = now < this.asDebuffUntil ? this.asDebuffMul : 1;
    const cripple = now < this.crippleUntil ? 1 + this.crippleAmount : 1;
    return (hitSlow * haste * debuff * cripple) / this.zone.attackSpeedMul;
  }
}
