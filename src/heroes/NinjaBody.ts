import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { COMBAT } from '../config/combat';
import { BODY_TEXTURE, ensureBodyTexture } from './bodyTexture';
import { drawNinja, facingFromAim, type CardinalFacing } from './drawNinja';

export class NinjaBody {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly view: Phaser.GameObjects.Container;
  health = NINJA.maxHealth;
  stamina = NINJA.maxStamina;
  readonly defense = NINJA.defense;
  readonly aim = new Phaser.Math.Vector2(1, 0);
  private facing: CardinalFacing = 'east';
  private readonly art: Phaser.GameObjects.Graphics;
  private staminaLockUntil = 0;
  private staminaDeniedAt = 0;
  private stunnedUntil = 0;
  private invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    ensureBodyTexture(scene);
    this.sprite = scene.physics.add.image(x, y, BODY_TEXTURE);
    this.sprite.setAlpha(0);
    this.sprite.setCircle(NINJA.bodyRadius);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setMaxVelocity(NINJA.moveSpeed, NINJA.moveSpeed);
    this.sprite.setDepth(10);

    this.view = scene.add.container(x, y).setDepth(10);
    this.art = scene.add.graphics();
    this.view.add(this.art);
    drawNinja(this.art, this.facing);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  syncView(): void {
    this.view.setPosition(this.sprite.x, this.sprite.y);
  }

  applyMove(move: Phaser.Math.Vector2): void {
    this.body.setVelocity(move.x * NINJA.moveSpeed, move.y * NINJA.moveSpeed);
  }

  stop(): void {
    this.body.setVelocity(0, 0);
  }

  get down(): boolean {
    return this.health <= 0;
  }

  isStunned(now: number): boolean {
    return now < this.stunnedUntil;
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
  }

  grantInvulnerable(until: number): void {
    this.invulnerableUntil = until;
  }

  takeHit(damage: number, dirX: number, dirY: number, knockback: number): void {
    if (this.down) {
      return;
    }
    this.health = Math.max(0, this.health - damage);
    const length = Math.hypot(dirX, dirY) || 1;
    this.body.setVelocity((dirX / length) * knockback, (dirY / length) * knockback);
    this.stunnedUntil = this.view.scene.time.now + COMBAT.hitStunMs;
    this.view.setScale(1.16);
    this.view.scene.tweens.add({
      targets: this.view,
      scale: 1,
      duration: 110,
      ease: 'Stepped',
      easeParams: [3],
    });
    if (this.down) {
      this.stop();
    }
  }

  setSpeedCap(speed: number): void {
    this.body.setMaxVelocity(speed, speed);
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
      this.staminaDeniedAt = now;
      return false;
    }
    this.stamina -= cost;
    this.staminaLockUntil = now + COMBAT.staminaRegenDelayMs;
    return true;
  }

  staminaDeniedRecently(now: number): boolean {
    return now - this.staminaDeniedAt < 140;
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
