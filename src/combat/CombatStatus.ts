import { COMBAT, ComboStep } from '../config/combat';
import type { AreaModifier } from '../heroes/abilities/AbilityWorld';
import {
  formatCooldownStat,
  formatMulStat,
  formatSignedStat,
  type StatusChipInfo,
} from '../ui/combatFeedback/format';

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
  private damageUntil = 0;
  private damageMul = 1;
  private knockbackUntil = 0;
  private knockbackMul = 1;
  private eventMoveMul = 1;
  private eventAttackMul = 1;
  private eventKnockbackMul = 1;
  private carryMoveMul = 1;
  private carryDamageMul = 1;
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

  /**
   * Player-facing temporary mods currently on this fighter.
   * Reads live status — not HUD bars or guessed stats.
   */
  playerFacingMods(now: number): StatusChipInfo[] {
    const chips: StatusChipInfo[] = [];
    const add = (key: string, text: string | undefined, buff: boolean): void => {
      if (!text) {
        return;
      }
      chips.push({ key, text, buff });
    };

    if (now < this.slowUntil) {
      add('slow', formatMulStat(this.slowMul, 'SPD'), this.slowMul > 1);
    }
    if (now < this.hasteUntil) {
      add('haste-spd', formatMulStat(this.hasteMoveMul, 'SPD'), this.hasteMoveMul > 1);
      const rate = 1 / Math.max(0.2, this.hasteAttackMul);
      add('haste-atk', formatMulStat(rate, 'ATK SPD'), rate > 1);
    }
    if (now < this.asDebuffUntil) {
      add('as-slow', formatCooldownStat(this.asDebuffMul, 'ATK SPD'), this.asDebuffMul < 1);
    }
    if (now < this.defenseUntil) {
      add('def', formatMulStat(this.defenseMul, 'DEF'), this.defenseMul > 1);
    }
    if (now < this.staminaRegenUntil) {
      add('stam', formatMulStat(this.staminaRegenMul, 'STAM'), this.staminaRegenMul > 1);
    }
    if (now < this.damageUntil) {
      add('dmg', formatMulStat(this.damageMul, 'ATK'), this.damageMul > 1);
    }
    if (now < this.knockbackUntil) {
      add('kb', formatMulStat(this.knockbackMul, 'KB'), this.knockbackMul > 1);
    }
    if (now < this.crippleUntil && this.crippleAmount >= 0.04) {
      const pct = -Math.round(this.crippleAmount * 100);
      add('cripple-spd', formatSignedStat(pct, 'SPD'), false);
      add('cripple-atk', formatSignedStat(pct, 'ATK SPD'), false);
    }
    if (this.zone.moveMul !== 1) {
      add('zone-spd', formatMulStat(this.zone.moveMul, 'SPD'), this.zone.moveMul > 1);
    }
    if (this.zone.attackSpeedMul !== 1) {
      add('zone-atk', formatMulStat(this.zone.attackSpeedMul, 'ATK SPD'), this.zone.attackSpeedMul > 1);
    }
    if (this.eventMoveMul !== 1) {
      add('event-spd', formatMulStat(this.eventMoveMul, 'SPD'), this.eventMoveMul > 1);
    }
    if (this.eventAttackMul !== 1) {
      add('event-atk', formatMulStat(this.eventAttackMul, 'ATK SPD'), this.eventAttackMul > 1);
    }
    if (this.eventKnockbackMul !== 1) {
      add('event-kb', formatMulStat(this.eventKnockbackMul, 'KB'), this.eventKnockbackMul > 1);
    }
    if (this.carryMoveMul !== 1) {
      add('carry-spd', formatMulStat(this.carryMoveMul, 'SPD'), this.carryMoveMul > 1);
    }
    if (this.carryDamageMul !== 1) {
      add('carry-atk', formatMulStat(this.carryDamageMul, 'ATK'), this.carryDamageMul > 1);
    }
    return chips;
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
    const until = now + durationMs;
    if (now >= this.defenseUntil) {
      this.defenseMul = mul;
      this.defenseUntil = until;
      return;
    }
    this.defenseMul = Math.max(this.defenseMul, mul);
    this.defenseUntil = Math.max(this.defenseUntil, until);
  }

  applyStaminaRegenBuff(now: number, durationMs: number, mul: number): void {
    const until = now + durationMs;
    if (now >= this.staminaRegenUntil) {
      this.staminaRegenMul = mul;
      this.staminaRegenUntil = until;
      return;
    }
    this.staminaRegenMul = Math.max(this.staminaRegenMul, mul);
    this.staminaRegenUntil = Math.max(this.staminaRegenUntil, until);
  }

  applyDamageBuff(now: number, durationMs: number, mul: number): void {
    this.damageUntil = now + durationMs;
    this.damageMul = mul;
  }

  applyKnockbackBuff(now: number, durationMs: number, mul: number): void {
    this.knockbackUntil = now + durationMs;
    this.knockbackMul = mul;
  }

  setEventModifiers(modifiers: { moveMul?: number; attackSpeedMul?: number; knockbackMul?: number }): void {
    this.eventMoveMul = modifiers.moveMul ?? 1;
    this.eventAttackMul = modifiers.attackSpeedMul ?? 1;
    this.eventKnockbackMul = modifiers.knockbackMul ?? 1;
  }

  clearEventModifiers(): void {
    this.eventMoveMul = 1;
    this.eventAttackMul = 1;
    this.eventKnockbackMul = 1;
  }

  setCarryModifiers(modifiers: { moveMul?: number; damageMul?: number }): void {
    this.carryMoveMul = modifiers.moveMul ?? 1;
    this.carryDamageMul = modifiers.damageMul ?? 1;
  }

  clearCarryModifiers(): void {
    this.carryMoveMul = 1;
    this.carryDamageMul = 1;
  }

  damageMultiplier(now: number): number {
    const timed = now < this.damageUntil ? this.damageMul : 1;
    return timed * this.carryDamageMul;
  }

  knockbackMultiplier(now: number): number {
    const timed = now < this.knockbackUntil ? this.knockbackMul : 1;
    return timed * this.eventKnockbackMul;
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
    this.damageUntil = 0;
    this.damageMul = 1;
    this.knockbackUntil = 0;
    this.knockbackMul = 1;
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
    const eventMove = this.eventMoveMul * this.carryMoveMul;
    if (this.isBlockStunned(now) || this.isHitStopping(now)) {
      return 0.2 * this.zone.moveMul * eventMove * slow * commit * haste * cripple;
    }
    if (this.isHitReacting(now)) {
      return COMBAT.hitMoveMultiplier * this.zone.moveMul * eventMove * slow * commit * haste * cripple;
    }
    return this.zone.moveMul * eventMove * slow * commit * haste * cripple;
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
    return (hitSlow * haste * debuff * cripple) / (this.zone.attackSpeedMul * this.eventAttackMul);
  }
}
