/**
 * Demo 1 combat tunables.
 *
 * Phase 1 does not apply these yet. Phase 3+ should import from here instead of
 * scattering magic numbers through scenes. Hero kills will later grant score,
 * not XP — that rule is not implemented in Demo 1.
 */
export const COMBAT = {
  attackDamage: 8,
  attackStaminaCost: 6,
  attackCooldownMs: 220,
  comboWindowMs: 420,
  comboFinisherDamage: 18,
  comboFinisherStaminaCost: 14,
  comboFinisherKnockback: 280,
  lightKnockback: 160,
  knockbackDurationMs: 140,
  hitStunMs: 70,
  /** Timed tool, not a holdable shield. */
  blockDurationMs: 350,
  blockCooldownMs: 4000,
  dashCooldownMs: 4000,
  dashDistance: 96,
  dashDurationMs: 120,
  dashStaminaCost: 12,
  blockStaminaCost: 8,
} as const;
