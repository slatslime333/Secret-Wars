/**
 * Shared combat rules. Hero-specific power comes from 0–99 ratings converted
 * in `src/config/ratings.ts` (50 = baseline).
 *
 * Tunables live here so knockback, lunges, dash charges, hold-shield,
 * and perfect-shield timing stay out of fighter/attack files.
 *
 * Stamina is only for light attacks. The shield has its own health pool:
 * holding drains it, and blocked hits chip it. Empty shield = break.
 */
export const COMBAT = {
  attackArcDegrees: 78,
  /** Base light-attack stamina cost. Combo steps scale this with staminaCostMultiplier. */
  attackStaminaCost: 7,
  staminaRegenDelayMs: 650,
  /** Extra pixels so a body inside the visible wedge still counts. */
  hitForgiveness: 16,
  /** Kept for the unused Chaser practice enemy files. */
  chaserWindupMs: 280,

  /** Slightly slower than the converted cooldown so each swing can read. */
  attackCooldownMultiplier: 1.22,

  /** Holding the shield spends shield HP, not stamina. */
  blockDrainPerSecond: 16,
  /** Need at least this much shield HP to raise or keep the shield. */
  blockMinShield: 8,
  /** Block shield max is this fraction of max health. */
  blockShieldRatio: 0.38,
  blockShieldRegenDelayMs: 720,
  blockShieldRegenPerSecond: 18,
  /** Ability hits on a raised shield spend this much extra vs HP chip. */
  abilityShieldDamageMul: 1.4,
  abilityShieldDamageMin: 4,
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
  /** Step 3 uses combo[3].staminaCostMultiplier (14 stamina at the base cost). */
  comboFinisherStaminaMultiplier: 2,
  comboFinisherKnockbackMultiplier: 1.55,

  /**
   * Per-step attack identity. Hold-repeat always uses step 1.
   * Knockback/lunge values are velocities (px/s), applied at the impact frame.
   */
  combo: {
    1: {
      damageMultiplier: 1,
      knockbackMultiplier: 2.05,
      staminaCostMultiplier: 1,
      lungeDistance: 12,
      lungeImpulse: 210,
      lungeLockMs: 95,
      recoveryMs: 110,
      staminaDamage: 4,
      hitReactionMs: 190,
      impactDelayMs: 70,
      shieldDamage: 8,
    },
    2: {
      damageMultiplier: 1.28,
      knockbackMultiplier: 2.35,
      staminaCostMultiplier: 9 / 7,
      lungeDistance: 18,
      lungeImpulse: 270,
      lungeLockMs: 110,
      recoveryMs: 150,
      staminaDamage: 6,
      hitReactionMs: 250,
      impactDelayMs: 90,
      shieldDamage: 13,
    },
    3: {
      damageMultiplier: 2.15,
      knockbackMultiplier: 2.55,
      staminaCostMultiplier: 2,
      lungeDistance: 26,
      lungeImpulse: 340,
      lungeLockMs: 130,
      recoveryMs: 220,
      staminaDamage: 10,
      hitReactionMs: 320,
      impactDelayMs: 110,
      shieldDamage: 20,
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

  /** Ultimates recharge on this timer instead of once per match. */
  ultimateCooldownMs: 45_000,

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

/** Stamina spent to start a light attack. */
export const lightAttackStaminaCost = (step: ComboStep, staminaMul = 1): number =>
  Math.max(0, Math.round(COMBAT.attackStaminaCost * COMBAT.combo[step].staminaCostMultiplier * staminaMul));

/** Personal block-shield pool. Scales with the fighter's max health. */
export const blockShieldMaxFor = (maxHealth: number): number =>
  Math.max(24, Math.round(maxHealth * COMBAT.blockShieldRatio));
