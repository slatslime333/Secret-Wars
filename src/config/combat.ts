/**
 * Shared combat rules. Hero-specific power comes from 0–99 ratings converted
 * in `src/config/ratings.ts` (50 = baseline).
 *
 * Tunables live here so knockback, lunges, ammo, dash charges, hold-shield,
 * and perfect-shield timing stay out of fighter/attack files.
 */
export const COMBAT = {
  attackArcDegrees: 78,
  /** Attacks spend ammo, not stamina. Kept only as a fallback cost gate. */
  attackStaminaCost: 0,
  staminaRegenDelayMs: 650,
  /** Extra pixels so a body inside the visible wedge still counts. */
  hitForgiveness: 16,
  /** Kept for the unused Chaser practice enemy files. */
  chaserWindupMs: 280,

  /** Slightly slower than the converted cooldown so each swing can read. */
  attackCooldownMultiplier: 1.22,

  attackAmmoMax: 7,
  attackReloadMs: 1500,

  /** Hold-to-block. Stamina is the shield resource. */
  blockDrainPerSecond: 20,
  blockMinStamina: 1,
  /** Raise window for Perfect Shield. Small on purpose — holding is not enough. */
  perfectShieldWindowMs: 110,
  perfectShieldStunMs: 280,
  /** Hitting a normal shield still shoves the attacker a little, without stun. */
  shieldHitRecoilLight: 42,
  shieldHitRecoilHeavy: 68,
  blockPushLight: 14,
  blockPushHeavy: 28,

  /** Three charges, each recovering through the same recharge timer. */
  dashMaxCharges: 3,
  dashRechargeMs: 1500,
  dashDistance: 118,
  dashDurationMs: 120,

  comboWindowMs: 720,
  comboFinisherDamageMultiplier: 2.15,
  comboFinisherStaminaMultiplier: 2.2,
  comboFinisherKnockbackMultiplier: 1.55,

  /**
   * Per-step attack identity. Hold-repeat always uses step 1.
   * Knockback/lunge values are velocities (px/s), applied at the impact frame.
   */
  combo: {
    1: {
      damageMultiplier: 1,
      knockbackMultiplier: 2.05,
      staminaCostMultiplier: 0,
      lungeDistance: 12,
      lungeImpulse: 210,
      lungeLockMs: 95,
      recoveryMs: 110,
      staminaDamage: 4,
      hitReactionMs: 190,
      impactDelayMs: 70,
      shieldStaminaDamage: 8,
    },
    2: {
      damageMultiplier: 1.28,
      knockbackMultiplier: 2.35,
      staminaCostMultiplier: 0,
      lungeDistance: 18,
      lungeImpulse: 270,
      lungeLockMs: 110,
      recoveryMs: 150,
      staminaDamage: 6,
      hitReactionMs: 250,
      impactDelayMs: 90,
      shieldStaminaDamage: 13,
    },
    3: {
      damageMultiplier: 2.15,
      knockbackMultiplier: 2.55,
      staminaCostMultiplier: 0,
      lungeDistance: 26,
      lungeImpulse: 340,
      lungeLockMs: 130,
      recoveryMs: 220,
      staminaDamage: 10,
      hitReactionMs: 320,
      impactDelayMs: 110,
      shieldStaminaDamage: 20,
    },
  },

  /** Walk speed is separate; this cap lets knockback and lunges actually move. */
  physicsMaxSpeed: 520,
  /** Ability launches can exceed walk speed without flying the width of the map. */
  launchSpeedCap: 570,
  bodyDrag: 540,

  hitMoveMultiplier: 0.42,
  hitAttackSlowMultiplier: 1.28,
  hitSlowMaxMs: 380,
  hitFlashMs: 140,

  /** Tiny freeze on connect. Finishers / perfect shields / clashes use the long end. */
  hitStopLightMs: 55,
  hitStopHeavyMs: 85,
  hitStopBlockMs: 70,
  hitStopClashMs: 80,
  /** Shared ability-impact freeze. Short enough to read as weight, not lag. */
  hitStopImpactMs: 100,

  /** Simultaneous swings. */
  clashWindowMs: 90,
  clashDamageMultiplier: 0.55,
  clashRecoil: 90,
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
