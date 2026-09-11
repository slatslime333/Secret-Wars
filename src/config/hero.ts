/**
 * Single Demo 1 fighter. Not a roster — one tanky body used by the player
 * and, in Phase 4, the dummy/enemy.
 */
export const DEMO_HERO = {
  id: 'warden',
  displayName: 'Warden',
  maxHealth: 140,
  maxStamina: 100,
  moveSpeed: 180,
  staminaRegenPerSecond: 18,
  staminaRegenDelayMs: 700,
} as const;
