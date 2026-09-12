import { ComboStep } from '../config/combat';

/** Shared result of a melee resolve so player and CPU use one code path. */
export type HitKind = 'hit' | 'blocked' | 'perfect-block' | 'whiff' | 'clash';

export type AttackIntent = {
  step: ComboStep;
  at: number;
};

export type TakeHitOptions = {
  damage: number;
  dirX: number;
  dirY: number;
  knockback: number;
  staminaDamage: number;
  step: ComboStep;
  clash?: boolean;
  /** Ability hits can request a custom stun window instead of combo reaction. */
  hitReactionMs?: number;
  /** Override the default connect freeze. `0` skips a second freeze after a shared impact pause. */
  hitStopMs?: number;
  /** Optional per-hit launch speed cap. Defaults to COMBAT.launchSpeedCap. */
  launchCap?: number;
};

/** Anyone QuickAttack can injure. */
export type Hurtbox = {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
  readonly defense: number;
  takeHit(options: TakeHitOptions): void;
};
