/**
 * Shared combat rules. Hero-specific power comes from `NINJA` (70/99).
 * Combo finisher, block, and dash timings are used in Phase 3.
 *
 * New tunables live here so hit reaction, lunges, stamina-on-hit, and
 * block punish stay out of fighter/attack files.
 */
export const COMBAT = {
  attackArcDegrees: 78,
  attackStaminaCost: 6,
  staminaRegenDelayMs: 650,
  /** Extra pixels so a body inside the visible wedge still counts. */
  hitForgiveness: 12,
  /** Kept for the unused Chaser practice enemy files. */
  chaserWindupMs: 280,
  /** Timed tool, not a holdable shield. Phase 3. */
  blockDurationMs: 350,
  blockCooldownMs: 4000,
  /** Short leap. 2s cooldown so dash is part of the fight triangle. */
  dashCooldownMs: 2000,
  dashDistance: 96,
  dashDurationMs: 120,
  dashStaminaCost: 12,
  blockStaminaCost: 8,
  comboWindowMs: 720,
  comboFinisherDamageMultiplier: 2.15,
  comboFinisherStaminaMultiplier: 2.2,
  comboFinisherKnockbackMultiplier: 1.55,

  /** Per-step attack identity. Hold-repeat always uses step 1. */
  combo: {
    1: {
      damageMultiplier: 1,
      knockbackMultiplier: 0.72,
      staminaCostMultiplier: 1,
      lungeDistance: 12,
      lungeImpulse: 70,
      recoveryMs: 90,
      staminaDamage: 4,
    },
    2: {
      damageMultiplier: 1.28,
      knockbackMultiplier: 0.95,
      staminaCostMultiplier: 1.25,
      lungeDistance: 18,
      lungeImpulse: 95,
      recoveryMs: 130,
      staminaDamage: 6,
    },
    3: {
      damageMultiplier: 2.15,
      knockbackMultiplier: 1.55,
      staminaCostMultiplier: 2.2,
      lungeDistance: 26,
      lungeImpulse: 125,
      recoveryMs: 190,
      staminaDamage: 10,
    },
  },

  /** Controllable disadvantage after a clean hit. Not a hard freeze. */
  hitReactionMs: 240,
  hitMoveMultiplier: 0.58,
  hitAttackSlowMultiplier: 1.32,
  hitSlowMaxMs: 420,
  hitFlashMs: 140,

  /** Tiny freeze on connect. Finishers / blocks / clashes use the long end. */
  hitStopLightMs: 50,
  hitStopHeavyMs: 75,
  hitStopBlockMs: 60,
  hitStopClashMs: 80,

  /** Light vs heavy block punish. Defender takes no HP through a clean block. */
  blockStunLightMs: 200,
  blockStunHeavyMs: 340,
  blockPushLight: 18,
  blockPushHeavy: 46,
  perfectBlockWindowMs: 180,
  perfectBlockStunBonusMs: 90,

  /** Simultaneous swings. */
  clashWindowMs: 90,
  clashDamageMultiplier: 0.55,
  clashRecoil: 70,
} as const;

export type ComboStep = 1 | 2 | 3;

export const attackHalfArcRad = (COMBAT.attackArcDegrees * Math.PI) / 360;

export const comboStepOf = (step: number): ComboStep => {
  if (step >= 3) {
    return 3;
  }
  if (step <= 1) {
    return 1;
  }
  return 2;
};
