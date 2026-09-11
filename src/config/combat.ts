/**
 * Shared combat rules. Hero-specific power comes from `NINJA` (70/99).
 * Combo finisher, block, and dash timings are used in Phase 3.
 */
export const COMBAT = {
  attackArcDegrees: 78,
  attackStaminaCost: 6,
  staminaRegenDelayMs: 650,
  hitStunMs: 160,
  knockbackDurationMs: 150,
  /** Extra pixels so a body inside the visible wedge still counts. */
  hitForgiveness: 12,
  /** Telegraph before the chaser swing. Phase 4. */
  chaserWindupMs: 280,
  /** Timed tool, not a holdable shield. Phase 3. */
  blockDurationMs: 350,
  blockCooldownMs: 4000,
  dashCooldownMs: 4000,
  dashDistance: 96,
  dashDurationMs: 120,
  dashStaminaCost: 12,
  blockStaminaCost: 8,
  comboWindowMs: 720,
  comboFinisherDamageMultiplier: 2.15,
  comboFinisherStaminaMultiplier: 2.2,
  comboFinisherKnockbackMultiplier: 1.55,
} as const;

export const attackHalfArcRad = (COMBAT.attackArcDegrees * Math.PI) / 360;
