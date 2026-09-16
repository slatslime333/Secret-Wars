import { COLE } from './cole';
import { MATCH } from './match';

/**
 * Battlefield supply crates. Modest rewards, a few hits to break.
 * Tuned from Cole's light damage so every hero can crack them without farming.
 */
export const CRATE = {
  /** ~2–3 Cole lights / ~4 Mender lights. Easy for every kit, never a one-shot. */
  maxHealth: Math.round(COLE.attackDamage * 2.4),
  /** Always drop a small pip. Less than a sword minion (18). */
  xp: 8,
  bonusXpChance: 0.3,
  bonusXp: 4,
  healthChance: 0.24,
  healthAmount: 14,
  shieldChance: 0.14,
  shieldAmount: 18,
  shieldMs: 6_000,
  hitFlashMs: 70,
  shardCount: 8,
  /** Stay gone long enough that crate looping cannot beat fighting. */
  respawnMs: 28_000,
} as const;

export const crateXpAmount = (): number => Math.min(CRATE.xp, MATCH.xp.sword);
