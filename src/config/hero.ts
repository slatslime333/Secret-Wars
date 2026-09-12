import type { HeroRole } from '../heroes/HeroDefinition';

/** Shared combat identity. Every hero owns its own converted numbers. */
export type TeamId = 'alpha' | 'bravo';

export type HeroCombatConfig = {
  id: string;
  displayName: string;
  role: HeroRole;
  maxHealth: number;
  maxStamina: number;
  moveSpeed: number;
  attackDamage: number;
  defense: number;
  knockbackPower: number;
  attackCooldownMs: number;
  attackRange: number;
  attackArcDegrees: number;
  bodyRadius: number;
  staminaRegenPerSecond: number;
  ammoMax: number;
  reloadMs: number;
  dashMaxCharges: number;
};

export const teamOfRival = (rival: boolean): TeamId => (rival ? 'bravo' : 'alpha');
