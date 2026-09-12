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
  ammo = COMBAT.attackAmmoMax;
  readonly defense = NINJA.defense;
  readonly aim = new Phaser.Math.Vector2(1, 0);
  private facing: CardinalFacing = 'east';
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly scene: Phaser.Scene;
  private staminaLockUntil = 0;
  private staminaDeniedAt = 0;
  private invulnerableUntil = 0;
  private attackingUntil = 0;
  private reloadEndsAt = 0;
  private currentAttackTween?: Phaser.Tweens.Tween;
  private lastDrawnFlash = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: NinjaBodyOptions = {}) {
    this.scene = scene;
    this.rival = Boolean(options.rival);
    ensureBodyTexture(scene);
    this.sprite = scene.physics.add.image(x, y, BODY_TEXTURE);
    this.sprite.setAlpha(0);
    this.sprite.setCircle(NINJA.bodyRadius);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setMaxVelocity(COMBAT.physicsMaxSpeed, COMBAT.physicsMaxSpeed);
    this.sprite.setDrag(0, 0);
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

  get down(): boolean {
    return this.health <= 0;
  }

  get maxAmmo(): number {
    return COMBAT.attackAmmoMax;
  }

  get body(): Phaser.Physics.Arcade.Body | undefined {
    return this.sprite.body as Phaser.Physics.Arcade.Body | undefined;
  }

  private now(): number {
    return this.scene.time.now;
  }

  private physics(): Phaser.Physics.Arcade.Body | undefined {
    if (!this.sprite.active) {
      return undefined;
    }
    return this.body;
  }

  syncView(): void {
    if (!this.view.active || !this.sprite.active) {
      return;
    }
    this.view.setPosition(this.sprite.x, this.sprite.y);
    const flashing = this.status.isFlashingHit(this.now());
    if (flashing !== this.lastDrawnFlash && this.now() >= this.attackingUntil) {
      this.lastDrawnFlash = flashing;
      this.redrawIdle();
    }
  }

  applyMove(move: Phaser.Math.Vector2): void {
    const body = this.physics();
    if (!body) {
      return;
    }
    const now = this.now();
    const speed = NINJA.moveSpeed * this.status.moveMultiplier(now);
    body.setDrag(0, 0);
    body.setVelocity(move.x * speed, move.y * speed);
  }

  stop(): void {
    this.physics()?.setVelocity(0, 0);
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
    const now = this.now();
    const body = this.physics();
    if (!body) {
      return;
    }
    this.health = Math.max(0, this.health - options.damage);
    this.drainStamina(options.staminaDamage, now);
    const length = Math.hypot(options.dirX, options.dirY) || 1;
    const power = options.knockback;
    body.setDrag(COMBAT.bodyDrag, COMBAT.bodyDrag);
    body.setVelocity((options.dirX / length) * power, (options.dirY / length) * power);
    if (options.hitReactionMs !== undefined) {
      this.status.applyStun(now, options.hitReactionMs);
    } else {
      this.status.applyHitReaction(now, options.step);
    }
    this.status.applyHitStop(
      now,
      options.clash || options.step === 3 ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs,
    );
    this.lastDrawnFlash = true;
    this.redrawIdle();
    this.view.setScale(options.step === 3 ? 1.22 : 1.12);
    this.scene.tweens.add({
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
    const body = this.physics();
    if (!body) {
      return;
    }
    const length = Math.hypot(dirX, dirY) || 1;
    body.setDrag(COMBAT.bodyDrag, COMBAT.bodyDrag);
    body.setVelocity((dirX / length) * power, (dirY / length) * power);
  }

  applyLungeImpulse(now: number, step: ComboStep): void {
    const body = this.physics();
    if (!body) {
      return;
    }
    const profile = COMBAT.combo[step];
    body.setDrag(COMBAT.bodyDrag * 0.55, COMBAT.bodyDrag * 0.55);
    body.setVelocity(
      body.velocity.x + this.aim.x * profile.lungeImpulse,
      body.velocity.y + this.aim.y * profile.lungeImpulse,
    );
    this.status.applyLunge(now, profile.lungeLockMs);
  }

  setSpeedCap(speed: number): void {
    this.physics()?.setMaxVelocity(speed, speed);
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
      if (this.now() >= this.attackingUntil) {
        this.redrawIdle();
      }
    }
  }

  /**
   * Sword sweep + visual lunge. Physical body lunge is applied at impact.
   */
  playAttackAnimation(now: number, step: ComboStep | boolean): void {
    const comboStep = typeof step === 'boolean' ? comboStepOf(step ? 3 : 1) : step;
    const profile = COMBAT.combo[comboStep];
    const duration = 110 + comboStep * 48;
    this.attackingUntil = now + duration;
    this.status.markSwing(now, comboStep);

    const lungeX = this.aim.x * profile.lungeDistance;
    const lungeY = this.aim.y * profile.lungeDistance;
    const tiltDirection = this.aim.x >= 0 ? 0.12 + comboStep * 0.06 : -(0.12 + comboStep * 0.06);
    const startAngle = comboStep === 1 ? -0.55 : comboStep === 2 ? -0.85 : -1.15;
    const endAngle = comboStep === 1 ? 0.85 : comboStep === 2 ? 1.25 : 1.65;

    this.currentAttackTween?.stop();
    const swordAnimState = { angleOffset: startAngle, lungeFrac: 0 };
    this.currentAttackTween = this.scene.tweens.add({
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
          hitFlash: this.status.isFlashingHit(this.now()),
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
  }

  playEvasiveLean(dirX: number, dirY: number, durationMs: number): void {
    this.currentAttackTween?.stop();
    this.view.setRotation(dirX >= 0 ? 0.22 : -0.22);
    this.art.setPosition(dirX * 6, dirY * 6);
    this.scene.tweens.add({
      targets: this.view,
      rotation: 0,
      duration: durationMs + 80,
      ease: 'Quad.Out',
    });
    this.scene.tweens.add({
      targets: this.art,
      x: 0,
      y: 0,
      duration: durationMs,
      ease: 'Quad.Out',
    });
  }

  playKickPose(durationMs: number): void {
    this.currentAttackTween?.stop();
    const lean = this.aim.x >= 0 ? 0.35 : -0.35;
    this.art.setRotation(lean);
    this.art.setPosition(this.aim.x * 10, this.aim.y * 10);
    this.scene.tweens.add({
      targets: this.art,
      rotation: lean * 1.15,
      duration: durationMs,
      ease: 'Cubic.Out',
    });
  }

  playBackflip(dirX: number, dirY: number, durationMs: number): void {
    this.currentAttackTween?.stop();
    const spin = { value: 0 };
    const sign = dirX >= 0 ? -1 : 1;
    this.scene.tweens.add({
      targets: spin,
      value: 1,
      duration: durationMs,
      ease: 'Cubic.Out',
      onUpdate: () => {
        this.view.setRotation(sign * spin.value * Math.PI * 2);
        this.art.setY(-22 * Math.sin(spin.value * Math.PI) + dirY * 4);
        this.art.setX(dirX * 6);
      },
      onComplete: () => {
        this.view.setRotation(0);
        this.art.setPosition(0, 0);
        this.art.setRotation(0);
        this.redrawIdle();
      },
    });
  }

  playBlockRecoil(now: number, heavy: boolean): void {
    this.status.applyBlockStun(now, heavy ? COMBAT.perfectShieldStunMs : COMBAT.perfectShieldStunMs * 0.75);
    this.applyRecoil(-this.aim.x, -this.aim.y, heavy ? 120 : 70);
    this.view.setRotation(this.aim.x >= 0 ? -0.18 : 0.18);
    this.scene.tweens.add({
      targets: this.view,
      rotation: 0,
      duration: heavy ? 240 : 160,
      ease: 'Quad.Out',
    });
  }

  isReloading(now: number): boolean {
    return this.ammo <= 0 && now < this.reloadEndsAt;
  }

  canAttack(now: number): boolean {
    return this.ammo > 0 && !this.isReloading(now) && !this.status.cannotAttack(now);
  }

  trySpendAmmo(now: number): boolean {
    this.tickAmmo(now);
    if (this.ammo <= 0 || now < this.reloadEndsAt) {
      return false;
    }
    this.ammo -= 1;
    if (this.ammo <= 0) {
      this.reloadEndsAt = now + COMBAT.attackReloadMs;
    }
    return true;
  }

  tickAmmo(now: number): void {
    if (this.ammo <= 0 && this.reloadEndsAt > 0 && now >= this.reloadEndsAt) {
      this.ammo = COMBAT.attackAmmoMax;
      this.reloadEndsAt = 0;
    }
  }

  ammoDisplay(now: number): { current: number; max: number; reloading: boolean; reloadRatio: number } {
    this.tickAmmo(now);
    if (this.isReloading(now)) {
      const remaining = this.reloadEndsAt - now;
      const recovered = 1 - remaining / COMBAT.attackReloadMs;
      return {
        current: Math.min(COMBAT.attackAmmoMax, Math.floor(recovered * COMBAT.attackAmmoMax)),
        max: COMBAT.attackAmmoMax,
        reloading: true,
        reloadRatio: Phaser.Math.Clamp(recovered, 0, 1),
      };
    }
    return {
      current: this.ammo,
      max: COMBAT.attackAmmoMax,
      reloading: false,
      reloadRatio: 1,
    };
  }

  trySpendStamina(cost: number, now: number): boolean {
    if (cost <= 0) {
      return true;
    }
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
    const scaled = amount * this.status.staminaDrainMultiplier();
    this.stamina = Math.max(0, this.stamina - scaled);
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
    this.scene.tweens.killTweensOf(this.view);
    this.scene.tweens.killTweensOf(this.art);
    this.sprite.destroy();
    this.view.destroy();
  }

  private redrawIdle(): void {
    drawNinja(this.art, {
      facing: this.facing,
      attacking: false,
      swordAngleOffset: 0,
      comboStep: 1,
      hitFlash: this.status.isFlashingHit(this.now()),
      rival: this.rival,
    });
  }
}
