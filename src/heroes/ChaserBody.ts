import Phaser from 'phaser';
import { CHASER } from '../config/chaser';
import { COMBAT } from '../config/combat';
import { BODY_TEXTURE, ensureBodyTexture } from './bodyTexture';
import { drawChaser } from './drawChaser';
import { facingFromAim, type CardinalFacing } from './drawNinja';

/** Red practice opponent. Chases and swings — no block, no dash. */
export class ChaserBody {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly view: Phaser.GameObjects.Container;
  health = CHASER.maxHealth;
  readonly aim = new Phaser.Math.Vector2(-1, 0);
  private facing: CardinalFacing = 'west';
  private readonly art: Phaser.GameObjects.Graphics;
  private stunnedUntil = 0;
  private attackingUntil = 0;
  private currentAttackTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    ensureBodyTexture(scene);
    this.sprite = scene.physics.add.image(x, y, BODY_TEXTURE);
    this.sprite.setAlpha(0);
    this.sprite.setCircle(CHASER.bodyRadius);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(280, 280);
    this.sprite.setMaxVelocity(CHASER.moveSpeed, CHASER.moveSpeed);
    this.sprite.setDepth(9);

    this.view = scene.add.container(x, y).setDepth(9);
    this.art = scene.add.graphics();
    this.view.add(this.art);
    drawChaser(this.art, this.facing, false, false, 0);
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

  get down(): boolean {
    return this.health <= 0;
  }

  isStunned(now: number): boolean {
    return now < this.stunnedUntil;
  }

  syncView(): void {
    this.view.setPosition(this.sprite.x, this.sprite.y);
  }

  setAim(aimX: number, aimY: number): void {
    if (aimX * aimX + aimY * aimY < 0.01) {
      return;
    }
    this.aim.set(aimX, aimY).normalize();
    const next = facingFromAim(this.aim.x, this.aim.y);
    if (next !== this.facing) {
      this.facing = next;
      if (this.view.scene.time.now >= this.attackingUntil && !this.down) {
        drawChaser(this.art, this.facing, false, false, 0);
      }
    }
  }

  chaseToward(targetX: number, targetY: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const length = Math.hypot(dx, dy) || 1;
    this.body.setVelocity((dx / length) * CHASER.moveSpeed, (dy / length) * CHASER.moveSpeed);
  }

  stop(): void {
    this.body.setVelocity(0, 0);
  }

  /**
   * Slight physical attack strike animation for opponent model.
   */
  playAttackAnimation(now: number): void {
    const duration = 140;
    this.attackingUntil = now + duration;

    const lungeDist = 12;
    const lungeX = this.aim.x * lungeDist;
    const lungeY = this.aim.y * lungeDist;

    this.currentAttackTween?.stop();
    const animState = { punch: 0, lungeFrac: 0 };

    this.currentAttackTween = this.view.scene.tweens.add({
      targets: animState,
      punch: 8,
      lungeFrac: 1,
      duration: duration * 0.5,
      ease: 'Quad.Out',
      yoyo: true,
      onUpdate: () => {
        drawChaser(this.art, this.facing, false, true, animState.punch);
        this.art.setPosition(
          lungeX * animState.lungeFrac,
          lungeY * animState.lungeFrac,
        );
      },
      onComplete: () => {
        this.art.setPosition(0, 0);
        if (!this.down) {
          drawChaser(this.art, this.facing, false, false, 0);
        }
      },
    });

    // Slight physical forward burst
    this.body.velocity.x += this.aim.x * 80;
    this.body.velocity.y += this.aim.y * 80;
  }

  takeHit(damage: number, dirX: number, dirY: number, knockback: number): void {
    if (this.down) {
      return;
    }
    this.health = Math.max(0, this.health - damage);
    const length = Math.hypot(dirX, dirY) || 1;
    this.body.setVelocity((dirX / length) * knockback, (dirY / length) * knockback);
    this.stunnedUntil = this.view.scene.time.now + COMBAT.hitStunMs;
    drawChaser(this.art, this.facing, true, false, 0);
    this.view.setScale(1.18);
    this.view.scene.tweens.add({
      targets: this.view,
      scale: 1,
      duration: 110,
      ease: 'Stepped',
      easeParams: [3],
    });
    this.view.scene.time.delayedCall(COMBAT.hitStunMs, () => {
      if (!this.down) {
        drawChaser(this.art, this.facing, false, false, 0);
      }
    });
    if (this.down) {
      drawChaser(this.art, this.facing, true, false, 0);
      this.stop();
    }
  }
}
