import type { HeroRole } from '../heroes/HeroDefinition';
import type { CoreRatings } from './ratings';

/** Shared combat identity. Every playable hero owns converted numbers plus 0–99 ratings. */
export type TeamId = 'alpha' | 'bravo';

export type HeroCombatConfig = {
  id: string;
  displayName: string;
  role: HeroRole;
  /** Present on playable heroes. Minions stay on raw tunables. */
  ratings?: CoreRatings;
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
