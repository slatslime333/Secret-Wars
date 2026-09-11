/** Anyone QuickAttack / ChaserAttack can injure. */
export type Hurtbox = {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
  takeHit(damage: number, dirX: number, dirY: number, knockback: number): void;
};
