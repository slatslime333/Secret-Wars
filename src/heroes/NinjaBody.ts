import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { COMBAT } from '../config/combat';
import { drawNinja, facingFromAim, type CardinalFacing } from './drawNinja';

export class NinjaBody {
  readonly view: Phaser.GameObjects.Container;
  readonly body: Phaser.Physics.Arcade.Body;
  health = NINJA.maxHealth;
  stamina = NINJA.maxStamina;
  readonly aim = new Phaser.Math.Vector2(1, 0);
  private facing: CardinalFacing = 'east';
  private readonly art: Phaser.GameObjects.Graphics;
  private staminaLockUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.view = scene.add.container(x, y);
    this.view.setSize(NINJA.bodyRadius * 2, NINJA.bodyRadius * 2);
    this.view.setDepth(10);
    this.art = scene.add.graphics();
    this.view.add(this.art);
    drawNinja(this.art, this.facing);

    scene.physics.add.existing(this.view);
    this.body = this.view.body as Phaser.Physics.Arcade.Body;
    this.body.setCircle(NINJA.bodyRadius, 0, 0);
    this.body.setOffset(-NINJA.bodyRadius, -NINJA.bodyRadius);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(NINJA.moveSpeed, NINJA.moveSpeed);
  }

  get x(): number {
    return this.view.x;
  }

  get y(): number {
    return this.view.y;
  }

  applyMove(move: Phaser.Math.Vector2): void {
    this.body.setVelocity(move.x * NINJA.moveSpeed, move.y * NINJA.moveSpeed);
  }

  setAim(aim: Phaser.Math.Vector2): void {
    if (aim.lengthSq() < 0.01) {
      return;
    }
    this.aim.copy(aim).normalize();
    const next = facingFromAim(this.aim.x, this.aim.y);
    if (next !== this.facing) {
      this.facing = next;
      drawNinja(this.art, this.facing);
    }
  }

  trySpendStamina(cost: number, now: number): boolean {
    if (this.stamina < cost) {
      return false;
    }
    this.stamina -= cost;
    this.staminaLockUntil = now + COMBAT.staminaRegenDelayMs;
    return true;
  }

  regenStamina(deltaMs: number, now: number): void {
    if (now < this.staminaLockUntil) {
      return;
    }
    this.stamina = Math.min(
      NINJA.maxStamina,
      this.stamina + NINJA.staminaRegenPerSecond * (deltaMs / 1000),
    );
  }
}
