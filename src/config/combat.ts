/**
 * Shared combat rules. Hero-specific power comes from `NINJA` (70/99).
 * Combo finisher, block, and dash timings are listed for Phase 3 — unused in Phase 2.
 */
export const COMBAT = {
  attackArcDegrees: 78,
  attackStaminaCost: 6,
  staminaRegenDelayMs: 650,
  hitStunMs: 160,
  knockbackDurationMs: 150,
  dummyRadius: 18,
  /** Extra pixels so a dummy inside the visible wedge still counts. */
  hitForgiveness: 12,
  dummyResetMs: 1800,
  /** Timed tool, not a holdable shield. Phase 3. */
  blockDurationMs: 350,
  blockCooldownMs: 4000,
  dashCooldownMs: 4000,
  dashDistance: 96,
  dashDurationMs: 120,
  dashStaminaCost: 12,
  blockStaminaCost: 8,
  comboWindowMs: 420,
  comboFinisherDamageMultiplier: 2.15,
  comboFinisherStaminaMultiplier: 2.2,
  comboFinisherKnockbackMultiplier: 1.55,
} as const;

export const attackHalfArcRad = (COMBAT.attackArcDegrees * Math.PI) / 360;
