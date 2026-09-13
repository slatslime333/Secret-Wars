import { ComboStep } from '../config/combat';
import type { DamageSourceKind } from './damageEvents';
import type { NinjaBody } from '../heroes/NinjaBody';

/** Shared result of a melee resolve so player and CPU use one code path. */
export type HitKind = 'hit' | 'blocked' | 'perfect-block' | 'whiff' | 'clash';

export type AttackIntent = {
  step: ComboStep;
  at: number;
};

export type DamageSource = {
  attacker?: NinjaBody | null;
  kind: DamageSourceKind;
  abilityId?: string;
};

export type TakeHitOptions = {
  damage: number;
  dirX: number;
  dirY: number;
  knockback: number;
  staminaDamage: number;
  step: ComboStep;
  clash?: boolean;
  /** Custom hit-reaction window. Does not count as stun unless `stun` is set. */
  hitReactionMs?: number;
  /** True crowd-control (bat smash, tornado). Triggers the STUNNED popup. */
  stun?: boolean;
  /** Override the default connect freeze. `0` skips a second freeze after a shared impact pause. */
  hitStopMs?: number;
  /** Optional per-hit launch speed cap. Defaults to COMBAT.launchSpeedCap. */
  launchCap?: number;
  /** Override MINION.hitKnockbackMul (1 = use the raw knockback value). */
  receivedKnockbackMul?: number;
  /** Combat attribution for stats, assists, and minion last-hit credit. */
  source?: DamageSource;
};

/** Anyone QuickAttack can injure. */
export type Hurtbox = {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
  readonly defense: number;
  takeHit(options: TakeHitOptions): void;
};
