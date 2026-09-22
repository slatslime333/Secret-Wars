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

  /**
   * Attack-speed ratings stay 0–99. This compresses the raw cooldown into a
   * readable decision window: fast kits stay fast, heavy kits stay heavy.
   * Hold repeats use holdCycleMul. Tap steps 2 and 3 stretch the cycle.
   */
  cycleBaseMs: 228,
  cycleScale: 0.48,
  cycleMinMs: 240,
  cycleMaxMs: 560,
  holdCycleMul: 0.94,
  tapStepCycleMul: { 1: 1, 2: 1.16, 3: 1.48 },
  /** Forgiveness so a press just before recovery ends still comes out. */
  inputBufferPcMs: 90,
  inputBufferMobileMs: 140,
  /** Contact window after startup. Movement drops here, then eases in recovery. */
  attackActiveMs: 96,

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
  /** Slightly longer recharge so a dash is a spend, not a second attack button. */
  dashRechargeMs: 1700,
  dashDistance: 118,
  dashDurationMs: 120,

  /** Long enough to land a deliberate third tap after a heavier second hit. */
  comboWindowMs: 860,
  comboFinisherDamageMultiplier: 2.15,
  /** Step 3 uses combo[3].staminaCostMultiplier (14 stamina at the base cost). */
  comboFinisherStaminaMultiplier: 2,
  comboFinisherKnockbackMultiplier: 1.55,

  /**
   * Per-step attack identity.
   * Hold-repeat stays on step 1 (quicker, lighter).
   * Distinct taps advance 1 → 2 → 3 and pay the higher cost.
   * Knockback/lunge values are velocities (px/s), applied at the impact frame.
   * Ordinary travel is lower than before; weight comes from hit-stop and reaction.
   */
  combo: {
    1: {
      damageMultiplier: 1,
      knockbackMultiplier: 1.64,
      staminaCostMultiplier: 1,
      lungeDistance: 12,
      lungeImpulse: 210,
      lungeLockMs: 95,
      recoveryMs: 150,
      staminaDamage: 4,
      hitReactionMs: 120,
      impactDelayMs: 82,
      shieldDamage: 8,
      attackerRecoil: 46,
    },
    2: {
      damageMultiplier: 1.28,
      knockbackMultiplier: 2.02,
      staminaCostMultiplier: 9 / 7,
      lungeDistance: 18,
      lungeImpulse: 270,
      lungeLockMs: 110,
      recoveryMs: 190,
      staminaDamage: 6,
      hitReactionMs: 165,
      impactDelayMs: 102,
      shieldDamage: 13,
      attackerRecoil: 68,
    },
    3: {
      damageMultiplier: 2.15,
      knockbackMultiplier: 2.3,
      staminaCostMultiplier: 2,
      lungeDistance: 26,
      lungeImpulse: 340,
      lungeLockMs: 140,
      recoveryMs: 250,
      staminaDamage: 10,
      hitReactionMs: 220,
      impactDelayMs: 118,
      shieldDamage: 20,
      attackerRecoil: 92,
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

  /** Freeze on connect, before knockback is released. Finishers sit at the long end. */
  hitStopLightMs: 52,
  hitStopHeavyMs: 72,
  hitStopFinisherMs: 100,
  hitStopBlockMs: 64,
  hitStopPerfectMs: 100,
  hitStopClashMs: 84,
  /** Shared ability-impact freeze. Short enough to read as weight, not lag. */
  hitStopImpactMs: 96,

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

export type AttackCadence = {
  heroId: string;
  bigDemon?: boolean;
  step: ComboStep;
  holdRepeat: boolean;
};

export type AttackMoveFeel = {
  /** Startup still lets the hero steer. */
  startup: number;
  /** Contact window. Melee commits; ranged kits stay mobile. */
  active: number;
  /** After the swing, before full movement returns. */
  recovery: number;
};

type HeroFeel = {
  /** Scales the shared attack cycle. 1 keeps the rating curve. */
  cycle: number;
  hitStop: number;
  reaction: number;
  startup: number;
  move: AttackMoveFeel;
};

/**
 * Character rhythm on top of the 0–99 ratings.
 * Ratings still set the order. These only keep each kit's job readable.
 */
export const HERO_COMBAT_FEEL: Record<string, HeroFeel> = {
  ninja: { cycle: 1, hitStop: 0.92, reaction: 0.84, startup: 0.9, move: { startup: 0.92, active: 0.28, recovery: 0.68 } },
  cole: { cycle: 1, hitStop: 1.2, reaction: 1.12, startup: 1.14, move: { startup: 0.86, active: 0.16, recovery: 0.52 } },
  death: { cycle: 0.94, hitStop: 1.42, reaction: 1.22, startup: 1.02, move: { startup: 0.88, active: 0.18, recovery: 0.58 } },
  rope: { cycle: 0.9, hitStop: 0.82, reaction: 0.7, startup: 0.85, move: { startup: 0.94, active: 0.58, recovery: 0.78 } },
  witch: { cycle: 1.06, hitStop: 1.05, reaction: 1.02, startup: 1.08, move: { startup: 0.88, active: 0.42, recovery: 0.64 } },
  shadow: { cycle: 1.04, hitStop: 1.18, reaction: 1.16, startup: 1.12, move: { startup: 0.86, active: 0.18, recovery: 0.54 } },
  mender: { cycle: 0.78, hitStop: 0.62, reaction: 0.55, startup: 0.7, move: { startup: 0.96, active: 0.72, recovery: 0.86 } },
  demon: { cycle: 0.9, hitStop: 0.86, reaction: 0.78, startup: 0.92, move: { startup: 0.94, active: 0.52, recovery: 0.76 } },
  'demon-big': { cycle: 1.26, hitStop: 1.32, reaction: 1.18, startup: 1.12, move: { startup: 0.84, active: 0.16, recovery: 0.5 } },
};

export const feelKey = (heroId: string, bigDemon = false): string =>
  heroId === 'demon' && bigDemon ? 'demon-big' : heroId;

const heroFeel = (heroId: string, bigDemon = false): HeroFeel =>
  HERO_COMBAT_FEEL[feelKey(heroId, bigDemon)] ?? HERO_COMBAT_FEEL.ninja;

const clampMs = (value: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, value)));

/** Time from one legal swing to the next. Ratings drive it; steps and hold shape it. */
export const attackCycleMs = (cooldownMs: number, cadence: AttackCadence): number => {
  const feel = heroFeel(cadence.heroId, cadence.bigDemon);
  const compressed = COMBAT.cycleBaseMs + cooldownMs * COMBAT.cycleScale;
  const stepMul =
    cadence.holdRepeat && cadence.step === 1 ? COMBAT.holdCycleMul : COMBAT.tapStepCycleMul[cadence.step];
  return clampMs(compressed * feel.cycle * stepMul, COMBAT.cycleMinMs, COMBAT.cycleMaxMs);
};

export const inputBufferMs = (touch: boolean): number =>
  touch ? COMBAT.inputBufferMobileMs : COMBAT.inputBufferPcMs;

/** Visible windup before the hit frame. */
export const attackStartupMs = (step: ComboStep, heroId: string, bigDemon = false): number =>
  clampMs(COMBAT.combo[step].impactDelayMs * heroFeel(heroId, bigDemon).startup, 55, 130);

export const hitStopFor = (step: ComboStep, heroId: string, bigDemon = false): number => {
  const base = step === 3 ? COMBAT.hitStopFinisherMs : step === 2 ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs;
  return clampMs(base * heroFeel(heroId, bigDemon).hitStop, 28, 115);
};

export const hitReactionFor = (step: ComboStep, heroId: string, bigDemon = false): number =>
  clampMs(COMBAT.combo[step].hitReactionMs * heroFeel(heroId, bigDemon).reaction, 50, 280);

/** Startup / contact / recovery movement. Does not change walk speed outside a swing. */
export const attackMoveFeel = (heroId: string, bigDemon = false): AttackMoveFeel =>
  heroFeel(heroId, bigDemon).move;
