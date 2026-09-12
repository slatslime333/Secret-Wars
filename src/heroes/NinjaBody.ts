import Phaser from 'phaser';
import { HeroCombatConfig, TeamId, teamOfRival } from '../config/hero';
import { NINJA } from '../config/ninja';
import { COMBAT, ComboStep, comboStepOf } from '../config/combat';
import { CombatStatus } from '../combat/CombatStatus';
import { TakeHitOptions } from '../combat/Hurtbox';
import { BODY_TEXTURE, ensureBodyTexture } from './bodyTexture';
import { drawNinja, facingFromAim, type CardinalFacing } from './drawNinja';
import { drawColeElectricity } from './drawCole';
import type { HeroDrawFn } from './heroDraw';

export type FighterOptions = {
  rival?: boolean;
  team?: TeamId;
  stats?: HeroCombatConfig;
  draw?: HeroDrawFn;
  handSparks?: boolean;
};

export class NinjaBody {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly view: Phaser.GameObjects.Container;
  readonly status = new CombatStatus();
  readonly rival: boolean;
  readonly team: TeamId;
  readonly stats: HeroCombatConfig;
  health: number;
  stamina: number;
  ammo: number;
  readonly aim = new Phaser.Math.Vector2(1, 0);
  private facing: CardinalFacing = 'east';
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly sparks?: Phaser.GameObjects.Graphics;
  private readonly drawHero: HeroDrawFn;
  private readonly scene: Phaser.Scene;
  private staminaLockUntil = 0;
  private staminaDeniedAt = 0;
  private invulnerableUntil = 0;
  private attackingUntil = 0;
  private reloadEndsAt = 0;
  private currentAttackTween?: Phaser.Tweens.Tween;
  private lastDrawnFlash = false;
  private frozenUntil = 0;
  private pendingLaunch?: { x: number; y: number };
  private armLiftLeft = 0;
  private armLiftRight = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, options: FighterOptions = {}) {
    this.scene = scene;
    this.rival = Boolean(options.rival);
    this.team = options.team ?? teamOfRival(this.rival);
    this.stats = options.stats ?? NINJA;
    this.drawHero = options.draw ?? ((graphics, drawOptions) => drawNinja(graphics, drawOptions));
    this.health = this.stats.maxHealth;
    this.stamina = this.stats.maxStamina;
    this.ammo = this.stats.ammoMax;
    ensureBodyTexture(scene);
    this.sprite = scene.physics.add.image(x, y, BODY_TEXTURE);
    this.sprite.setAlpha(0);
    this.sprite.setCircle(this.stats.bodyRadius);
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
    if (options.handSparks) {
      this.sparks = scene.add.graphics();
      this.view.add(this.sparks);
    }
    this.redrawIdle();
  }

  get defense(): number {
    return this.stats.defense;
  }

  get heroId(): string {
    return this.stats.id;
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
    return this.stats.ammoMax;
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
    this.tickHitStop(this.now());
    this.view.setPosition(this.sprite.x, this.sprite.y);
    this.redrawHandSparks();
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
    const speed = this.stats.moveSpeed * this.status.moveMultiplier(now);
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
    const hitStopMs =
      options.hitStopMs ??
      (options.clash || options.step === 3 ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs);
    body.setDrag(COMBAT.bodyDrag, COMBAT.bodyDrag);
    this.launch(options.dirX / length, options.dirY / length, power);
    if (options.hitReactionMs !== undefined) {
      this.status.applyStun(now, options.hitReactionMs);
    } else {
      this.status.applyHitReaction(now, options.step);
    }
    if (hitStopMs > 0) {
      this.status.applyHitStop(now, hitStopMs);
    }
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
    this.launch(dirX / length, dirY / length, power);
  }

  /**
   * Freeze in place for a shared impact pause. Other heroes can call this too.
   * A queued launch fires the moment the freeze ends.
   */
  freezeForHitStop(now: number, durationMs: number): void {
    this.status.applyHitStop(now, durationMs);
    this.frozenUntil = Math.max(this.frozenUntil, now + durationMs);
    this.physics()?.setVelocity(0, 0);
  }

  queueLaunch(dirX: number, dirY: number, power: number): void {
    const length = Math.hypot(dirX, dirY) || 1;
    this.pendingLaunch = { x: (dirX / length) * power, y: (dirY / length) * power };
  }

  private tickHitStop(now: number): void {
    if (now < this.frozenUntil) {
      this.physics()?.setVelocity(0, 0);
      return;
    }
    if (!this.pendingLaunch) {
      return;
    }
    const launch = this.pendingLaunch;
    this.pendingLaunch = undefined;
    const body = this.physics();
    if (!body) {
      return;
    }
    body.setDrag(COMBAT.bodyDrag, COMBAT.bodyDrag);
    this.launch(launch.x, launch.y, Math.hypot(launch.x, launch.y));
  }

  private launch(dirX: number, dirY: number, power: number): void {
    const body = this.physics();
    if (!body || power <= 0) {
      return;
    }
    const length = Math.hypot(dirX, dirY) || 1;
    this.setSpeedCap(Math.min(COMBAT.launchSpeedCap, Math.max(COMBAT.physicsMaxSpeed, power)));
    body.setVelocity((dirX / length) * Math.min(power, COMBAT.launchSpeedCap), (dirY / length) * Math.min(power, COMBAT.launchSpeedCap));
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
        this.drawHero(this.art, {
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

  playCustomAttack(
    now: number,
    durationMs: number,
    frame: (frac: number) => {
      swayX?: number;
      armLiftLeft?: number;
      armLiftRight?: number;
      swordAngleOffset?: number;
      batScale?: number;
      batOnBack?: boolean;
      showUzi?: boolean;
    },
  ): void {
    this.currentAttackTween?.stop();
    this.attackingUntil = now + durationMs;
    const anim = { frac: 0 };
    this.currentAttackTween = this.scene.tweens.add({
      targets: anim,
      frac: 1,
      duration: durationMs,
      ease: 'Sine.InOut',
      onUpdate: () => {
        const pose = frame(anim.frac);
        this.armLiftLeft = pose.armLiftLeft ?? 0;
        this.armLiftRight = pose.armLiftRight ?? 0;
        this.drawHero(this.art, {
          facing: this.facing,
          attacking: true,
          swordAngleOffset: pose.swordAngleOffset ?? 0,
          comboStep: 1,
          hitFlash: this.status.isFlashingHit(this.now()),
          rival: this.rival,
          armLiftLeft: this.armLiftLeft,
          armLiftRight: this.armLiftRight,
          batScale: pose.batScale,
          batOnBack: pose.batOnBack,
          showUzi: pose.showUzi,
        });
        this.art.setPosition(pose.swayX ?? 0, 0);
      },
      onComplete: () => {
        this.armLiftLeft = 0;
        this.armLiftRight = 0;
        this.art.setPosition(0, 0);
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
    this.attackingUntil = this.now() + durationMs;
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

  playBackflip(dirX: number, dirY: number, durationMs: number, jumpHeight = 34): void {
    this.currentAttackTween?.stop();
    this.scene.tweens.killTweensOf(this.art);
    this.scene.tweens.killTweensOf(this.view);
    this.attackingUntil = this.now() + durationMs;
    const spin = { value: 0 };
    const length = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;
    const sign = nx >= 0 ? -1 : 1;
    this.currentAttackTween = this.scene.tweens.add({
      targets: spin,
      value: 1,
      duration: durationMs,
      ease: 'Sine.Out',
      onUpdate: () => {
        const lift = Math.sin(spin.value * Math.PI);
        this.view.setRotation(sign * spin.value * Math.PI * 2);
        this.art.setY(-jumpHeight * lift + ny * 6);
        this.art.setX(nx * 10 * (1 - spin.value));
        this.art.setScale(1 + lift * 0.12);
      },
      onComplete: () => {
        this.view.setRotation(0);
        this.art.setPosition(0, 0);
        this.art.setRotation(0);
        this.art.setScale(1);
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
      this.reloadEndsAt = now + this.stats.reloadMs;
    }
    return true;
  }

  tickAmmo(now: number): void {
    if (this.ammo <= 0 && this.reloadEndsAt > 0 && now >= this.reloadEndsAt) {
      this.ammo = this.stats.ammoMax;
      this.reloadEndsAt = 0;
    }
  }

  ammoDisplay(now: number): { current: number; max: number; reloading: boolean; reloadRatio: number } {
    this.tickAmmo(now);
    if (this.isReloading(now)) {
      const remaining = this.reloadEndsAt - now;
      const recovered = 1 - remaining / this.stats.reloadMs;
      return {
        current: Math.min(this.stats.ammoMax, Math.floor(recovered * this.stats.ammoMax)),
        max: this.stats.ammoMax,
        reloading: true,
        reloadRatio: Phaser.Math.Clamp(recovered, 0, 1),
      };
    }
    return {
      current: this.ammo,
      max: this.stats.ammoMax,
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
      this.stats.maxStamina,
      this.stamina + this.stats.staminaRegenPerSecond * (deltaMs / 1000),
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
    this.drawHero(this.art, {
      facing: this.facing,
      attacking: false,
      swordAngleOffset: 0,
      comboStep: 1,
      hitFlash: this.status.isFlashingHit(this.now()),
      rival: this.rival,
    });
  }

  private redrawHandSparks(): void {
    if (!this.sparks) {
      return;
    }
    drawColeElectricity(this.sparks, this.facing, this.now(), this.armLiftLeft, this.armLiftRight);
  }
}
