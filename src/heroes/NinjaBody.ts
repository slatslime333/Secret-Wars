import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { COMBAT, ComboStep, comboStepOf } from '../config/combat';
import { CombatStatus } from '../combat/CombatStatus';
import { TakeHitOptions } from '../combat/Hurtbox';
import { BODY_TEXTURE, ensureBodyTexture } from './bodyTexture';
import { drawNinja, facingFromAim, type CardinalFacing } from './drawNinja';

type NinjaBodyOptions = {
  rival?: boolean;
};

export class NinjaBody {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly view: Phaser.GameObjects.Container;
  readonly status = new CombatStatus();
  readonly rival: boolean;
  health = NINJA.maxHealth;
  stamina = NINJA.maxStamina;
  readonly defense = NINJA.defense;
  readonly aim = new Phaser.Math.Vector2(1, 0);
  private facing: CardinalFacing = 'east';
  private readonly art: Phaser.GameObjects.Graphics;
  private staminaLockUntil = 0;
  private staminaDeniedAt = 0;
  private invulnerableUntil = 0;
  private attackingUntil = 0;
  private currentAttackTween?: Phaser.Tweens.Tween;
  private lastDrawnFlash = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: NinjaBodyOptions = {}) {
    this.rival = Boolean(options.rival);
    ensureBodyTexture(scene);
    this.sprite = scene.physics.add.image(x, y, BODY_TEXTURE);
    this.sprite.setAlpha(0);
    this.sprite.setCircle(NINJA.bodyRadius);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setMaxVelocity(NINJA.moveSpeed, NINJA.moveSpeed);
    this.sprite.setDepth(this.rival ? 9 : 10);
    if (this.rival) {
      this.aim.set(-1, 0);
      this.facing = 'west';
    }

    this.view = scene.add.container(x, y).setDepth(this.rival ? 9 : 10);
    this.art = scene.add.graphics();
    this.view.add(this.art);
    this.redrawIdle();
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

  syncView(): void {
    this.view.setPosition(this.sprite.x, this.sprite.y);
    const flashing = this.status.isFlashingHit(this.view.scene.time.now);
    if (flashing !== this.lastDrawnFlash && this.view.scene.time.now >= this.attackingUntil) {
      this.lastDrawnFlash = flashing;
      this.redrawIdle();
    }
  }

  applyMove(move: Phaser.Math.Vector2): void {
    const now = this.view.scene.time.now;
    const speed = NINJA.moveSpeed * this.status.moveMultiplier(now);
    this.body.setVelocity(move.x * speed, move.y * speed);
  }

  stop(): void {
    this.body.setVelocity(0, 0);
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
  }

  grantInvulnerable(until: number): void {
    this.invulnerableUntil = until;
  }

  takeHit(options: TakeHitOptions): void {
    if (this.down) {
      return;
    }
    const now = this.view.scene.time.now;
    this.health = Math.max(0, this.health - options.damage);
    this.drainStamina(options.staminaDamage, now);
    const length = Math.hypot(options.dirX, options.dirY) || 1;
    this.body.setVelocity((options.dirX / length) * options.knockback, (options.dirY / length) * options.knockback);
    this.status.applyHitReaction(now);
    this.status.applyHitStop(
      now,
      options.clash || options.step === 3 ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs,
    );
    this.lastDrawnFlash = true;
    this.redrawIdle();
    this.view.setScale(options.step === 3 ? 1.22 : 1.12);
    this.view.scene.tweens.add({
      targets: this.view,
      scale: 1,
      duration: options.step === 3 ? 150 : 110,
      ease: 'Stepped',
      easeParams: [3],
    });
    if (this.down) {
      this.stop();
    }
  }

  applyRecoil(dirX: number, dirY: number, power: number): void {
    const length = Math.hypot(dirX, dirY) || 1;
    this.body.setVelocity((dirX / length) * power, (dirY / length) * power);
  }

  setSpeedCap(speed: number): void {
    this.body.setMaxVelocity(speed, speed);
  }

  setAim(aim: Phaser.Math.Vector2 | number, aimY?: number): void {
    let x: number;
    let y: number;
    if (typeof aim === 'number') {
      x = aim;
      y = aimY ?? 0;
    } else {
      x = aim.x;
      y = aim.y;
    }
    if (x * x + y * y < 0.01) {
      return;
    }
    this.aim.set(x, y).normalize();
    const next = facingFromAim(this.aim.x, this.aim.y);
    if (next !== this.facing) {
      this.facing = next;
      if (this.view.scene.time.now >= this.attackingUntil) {
        this.redrawIdle();
      }
    }
  }

  /**
   * Per-step physical lunge + sword sweep. Light stays snappy; heavier hits grow.
   */
  playAttackAnimation(now: number, step: ComboStep | boolean): void {
    const comboStep = typeof step === 'boolean' ? comboStepOf(step ? 3 : 1) : step;
    const profile = COMBAT.combo[comboStep];
    const duration = 90 + comboStep * 40;
    this.attackingUntil = now + duration;
    this.status.markSwing(now, comboStep);

    const lungeX = this.aim.x * profile.lungeDistance;
    const lungeY = this.aim.y * profile.lungeDistance;
    const tiltDirection = this.aim.x >= 0 ? 0.12 + comboStep * 0.06 : -(0.12 + comboStep * 0.06);
    const startAngle = comboStep === 1 ? -0.55 : comboStep === 2 ? -0.85 : -1.15;
    const endAngle = comboStep === 1 ? 0.85 : comboStep === 2 ? 1.25 : 1.65;

    this.currentAttackTween?.stop();
    const swordAnimState = { angleOffset: startAngle, lungeFrac: 0 };
    this.currentAttackTween = this.view.scene.tweens.add({
      targets: swordAnimState,
      angleOffset: endAngle,
      lungeFrac: 1,
      duration: duration * (comboStep === 3 ? 0.7 : 0.6),
      ease: comboStep === 3 ? 'Back.Out' : 'Cubic.Out',
      yoyo: true,
      onUpdate: () => {
        drawNinja(this.art, {
          facing: this.facing,
          attacking: true,
          swordAngleOffset: swordAnimState.angleOffset,
          comboStep,
          hitFlash: this.status.isFlashingHit(this.view.scene.time.now),
          rival: this.rival,
        });
        this.art.setPosition(
          lungeX * swordAnimState.lungeFrac,
          lungeY * swordAnimState.lungeFrac,
        );
        this.art.setRotation(tiltDirection * swordAnimState.lungeFrac);
        this.art.setScale(1 + (comboStep - 1) * 0.06 * swordAnimState.lungeFrac);
      },
      onComplete: () => {
        this.art.setPosition(0, 0);
        this.art.setRotation(0);
        this.art.setScale(1);
        this.redrawIdle();
      },
    });

    this.body.velocity.x += this.aim.x * profile.lungeImpulse;
    this.body.velocity.y += this.aim.y * profile.lungeImpulse;
  }

  playBlockRecoil(now: number, heavy: boolean): void {
    this.status.applyBlockStun(now, heavy ? COMBAT.blockStunHeavyMs : COMBAT.blockStunLightMs);
    this.applyRecoil(-this.aim.x, -this.aim.y, heavy ? 110 : 55);
    this.view.setRotation(this.aim.x >= 0 ? -0.18 : 0.18);
    this.view.scene.tweens.add({
      targets: this.view,
      rotation: 0,
      duration: heavy ? 220 : 140,
      ease: 'Quad.Out',
    });
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

  drainStamina(amount: number, now: number): void {
    if (amount <= 0) {
      return;
    }
    this.stamina = Math.max(0, this.stamina - amount);
    this.staminaLockUntil = now + COMBAT.staminaRegenDelayMs;
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

  destroy(): void {
    this.currentAttackTween?.stop();
    this.sprite.destroy();
    this.view.destroy();
  }

  private redrawIdle(): void {
    drawNinja(this.art, {
      facing: this.facing,
      attacking: false,
      swordAngleOffset: 0,
      comboStep: 1,
      hitFlash: this.status.isFlashingHit(this.view.scene.time.now),
      rival: this.rival,
    });
  }
}
