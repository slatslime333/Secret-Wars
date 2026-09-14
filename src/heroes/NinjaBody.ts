import Phaser from 'phaser';
import { arenaInnerBounds } from '../config/arena';
import { HeroCombatConfig, TeamId, teamOfRival } from '../config/hero';
import { NINJA } from '../config/ninja';
import { COMBAT, ComboStep, blockShieldMaxFor, comboStepOf, lightAttackStaminaCost } from '../config/combat';
import { CombatStatus } from '../combat/CombatStatus';
import { TakeHitOptions } from '../combat/Hurtbox';
import { emitCombatBlocked, emitCombatDamage } from '../combat/damageEvents';
import { BODY_TEXTURE, ensureBodyTexture } from './bodyTexture';
import { drawNinja, facingFromAim, type CardinalFacing } from './drawNinja';
import { drawColeElectricity } from './drawCole';
import type { HeroDrawFn } from './heroDraw';
import { playDeath, playWorld } from '../audio';
import { drawRopeWrap } from './abilities/rope/ropeVisual';
import { drawMagicVortex } from './abilities/witch/vortex';
import { drawClawMark, drawRageFire } from './abilities/shadow/clawFx';
import { SHADOW_MARK, SHADOW_RAGE } from './abilities/shadow/tunables';
import { dismissWitchSkeletons, unregisterWitchSkeleton } from './abilities/witch/skeletonPack';
import { DEV_CHEATS } from '../debug/devCheats';
import { MATCH } from '../config/match';
import { MINION } from '../config/minion';

export type FighterOptions = {
  rival?: boolean;
  team?: TeamId;
  stats?: HeroCombatConfig;
  draw?: HeroDrawFn;
  handSparks?: boolean;
  playerControlled?: boolean;
};

export class NinjaBody {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly view: Phaser.GameObjects.Container;
  readonly status = new CombatStatus();
  readonly rival: boolean;
  readonly team: TeamId;
  readonly playerControlled: boolean;
  readonly stats: HeroCombatConfig;
  health: number;
  stamina: number;
  /** Hold-block shield HP. Separate from Witch hex (`shieldAmount`) and from stamina. */
  blockShield: number;
  maxBlockShield: number;
  /** Live shield flag. Set by BlockController so AI and HUD share one source. */
  blocking = false;
  /** CPU kit pressure. Defaults assume a full kit so tests and minions stay aggressive. */
  kitAbilityReady = true;
  kitDashCharges = 2;
  lastAttacker?: NinjaBody;
  lastAttackerAt = 0;
  /** Last time an enemy actually dealt HP damage. Minion heals / regen do not touch this. */
  lastEnemyHitAt = -1e9;
  private present = true;
  readonly aim = new Phaser.Math.Vector2(1, 0);
  private facing: CardinalFacing = 'east';
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly sparks?: Phaser.GameObjects.Graphics;
  private readonly drawHero: HeroDrawFn;
  private readonly scene: Phaser.Scene;
  private staminaLockUntil = 0;
  private staminaDeniedAt = 0;
  private blockShieldLockUntil = 0;
  private invulnerableUntil = 0;
  private attackingUntil = 0;
  private currentAttackTween?: Phaser.Tweens.Tween;
  private lastDrawnFlash = false;
  private frozenUntil = 0;
  private pendingLaunch?: { x: number; y: number };
  private armLiftLeft = 0;
  private armLiftRight = 0;
  private wrapGfx?: Phaser.GameObjects.Graphics;
  private wrapUntil = 0;
  private vortexGfx?: Phaser.GameObjects.Graphics;
  private vortexUntil = 0;
  private vortexTint = 0x9b4dff;
  private tempShield = 0;
  private tempShieldUntil = 0;
  private clawGfx?: Phaser.GameObjects.Graphics;
  private clawUntil = 0;
  private clawTickAt = 0;
  private rageGfx?: Phaser.GameObjects.Graphics;
  private rageUntil = 0;
  private rageCastUntil = 0;
  private readonly baseMaxStamina: number;
  private rageStaminaUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, options: FighterOptions = {}) {
    this.scene = scene;
    this.rival = Boolean(options.rival);
    this.team = options.team ?? teamOfRival(this.rival);
    this.playerControlled = Boolean(options.playerControlled);
    this.stats = { ...(options.stats ?? NINJA) };
    this.drawHero = options.draw ?? ((graphics, drawOptions) => drawNinja(graphics, drawOptions));
    this.health = this.stats.maxHealth;
    this.stamina = this.stats.maxStamina;
    this.maxBlockShield = blockShieldMaxFor(this.stats.maxHealth);
    this.blockShield = this.maxBlockShield;
    this.baseMaxStamina = this.stats.maxStamina;
    ensureBodyTexture(scene);
    this.sprite = scene.physics.add.image(x, y, BODY_TEXTURE);
    this.sprite.setAlpha(0);
    this.sprite.setCircle(this.stats.bodyRadius);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(0);
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
    this.scene.physics.world.on('worldstep', this.containInArena, this);
  }

  get defense(): number {
    return Math.round(this.stats.defense * this.status.defenseMultiplier(this.now()));
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
    this.containInArena();
    this.tickHitStop(this.now());
    this.view.setPosition(this.sprite.x, this.sprite.y);
    this.redrawHandSparks();
    this.syncRopeWrap();
    this.syncMagicVortex();
    this.syncClawMark();
    this.syncRageFire();
    const now = this.now();
    if (this.heroId === 'rope' && now >= this.attackingUntil && this.present && !this.down) {
      const hop = Math.abs(Math.sin(now / 130)) * 3.4;
      this.art.setY(-hop);
    }
    const flashing = this.status.isFlashingHit(now);
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
    if (this.down || !this.present) {
      return;
    }
    if (DEV_CHEATS.godMode && this.stats.role !== 'minion') {
      return;
    }
    const now = this.now();
    const body = this.physics();
    if (!body) {
      return;
    }
    const incoming = options.damage;
    const shielded = this.absorbShield(incoming, now);
    const hpDamage = incoming - shielded;
    const applied = Math.min(this.health, hpDamage);
    this.health = Math.max(0, this.health - hpDamage);
    if (options.source?.attacker) {
      this.lastAttacker = options.source.attacker;
      this.lastAttackerAt = now;
      if ((applied > 0 || shielded > 0) && options.source.attacker.team !== this.team) {
        this.lastEnemyHitAt = now;
      }
    }
    if (shielded > 0) {
      emitCombatBlocked({ defender: this, amount: shielded, at: now });
    }
    if (applied > 0) {
      emitCombatDamage({
        attacker: options.source?.attacker ?? null,
        victim: this,
        amount: applied,
        kind: options.source?.kind ?? 'other',
        abilityId: options.source?.abilityId,
        at: now,
        attackerTeam: options.source?.attacker?.team,
        victimTeam: this.team,
      });
    }
    this.drainStamina(options.staminaDamage, now);
    const length = Math.hypot(options.dirX, options.dirY) || 1;
    const minion = this.stats.role === 'minion';
    const receiveMul = options.receivedKnockbackMul ?? (minion ? MINION.hitKnockbackMul : 1);
    const power = options.knockback * receiveMul;
    const hitStopMs =
      options.hitStopMs ??
      (options.clash || options.step === 3 ? COMBAT.hitStopHeavyMs : COMBAT.hitStopLightMs);
    body.setDrag(COMBAT.bodyDrag, COMBAT.bodyDrag);
    this.launch(options.dirX / length, options.dirY / length, power, options.launchCap ?? COMBAT.launchSpeedCap);
    if (minion) {
      this.status.applyStun(now, options.hitReactionMs ?? MINION.hitReactionMs);
    } else if (options.stun) {
      this.status.applyStun(now, options.hitReactionMs ?? COMBAT.combo[options.step].hitReactionMs);
    } else {
      this.status.applyHitReaction(now, options.step, options.hitReactionMs);
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
      this.clearTempShield();
      this.clearMagicVortex();
      this.clearClawMark();
      this.clearRage();
      dismissWitchSkeletons(this);
      if (applied > 0) {
        playDeath(this);
      }
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

  private launch(dirX: number, dirY: number, power: number, launchCap: number = COMBAT.launchSpeedCap): void {
    const body = this.physics();
    if (!body || power <= 0) {
      return;
    }
    const length = Math.hypot(dirX, dirY) || 1;
    const used = Math.min(power, launchCap);
    this.setSpeedCap(Math.min(launchCap, Math.max(COMBAT.physicsMaxSpeed, used)));
    body.setVelocity((dirX / length) * used, (dirY / length) * used);
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
        if (!this.present) {
          return;
        }
        this.drawHero(this.art, {
          facing: this.facing,
          attacking: true,
          swordAngleOffset: swordAnimState.angleOffset,
          comboStep,
          hitFlash: this.status.isFlashingHit(this.now()),
          rival: this.rival,
          team: this.team,
        });
        this.art.setPosition(
          lungeX * swordAnimState.lungeFrac,
          lungeY * swordAnimState.lungeFrac,
        );
        this.art.setRotation(tiltDirection * swordAnimState.lungeFrac);
        this.art.setScale(1 + (comboStep - 1) * 0.06 * swordAnimState.lungeFrac);
      },
      onComplete: () => {
        if (!this.present) {
          return;
        }
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
      jumpY?: number;
      armLiftLeft?: number;
      armLiftRight?: number;
      swordAngleOffset?: number;
      batScale?: number;
      batOnBack?: boolean;
      showUzi?: boolean;
      staffRaise?: number;
    },
    ease: string = 'Sine.InOut',
  ): void {
    this.currentAttackTween?.stop();
    this.attackingUntil = now + durationMs;
    const anim = { frac: 0 };
    this.currentAttackTween = this.scene.tweens.add({
      targets: anim,
      frac: 1,
      duration: durationMs,
      ease,
      onUpdate: () => {
        if (!this.present) {
          return;
        }
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
          team: this.team,
          armLiftLeft: this.armLiftLeft,
          armLiftRight: this.armLiftRight,
          batScale: pose.batScale,
          batOnBack: pose.batOnBack,
          showUzi: pose.showUzi,
          staffRaise: pose.staffRaise,
        });
        this.art.setPosition(pose.swayX ?? 0, pose.jumpY ?? 0);
      },
      onComplete: () => {
        if (!this.present) {
          return;
        }
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

  playFrontFlip(dirX: number, dirY: number, durationMs: number, jumpHeight = 28): void {
    this.currentAttackTween?.stop();
    this.scene.tweens.killTweensOf(this.art);
    this.scene.tweens.killTweensOf(this.view);
    this.attackingUntil = this.now() + durationMs;
    const spin = { value: 0 };
    const length = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;
    const sign = nx >= 0 ? 1 : -1;
    this.currentAttackTween = this.scene.tweens.add({
      targets: spin,
      value: 1,
      duration: durationMs,
      ease: 'Sine.Out',
      onUpdate: () => {
        const lift = Math.sin(spin.value * Math.PI);
        this.view.setRotation(sign * spin.value * Math.PI * 2);
        this.art.setY(-jumpHeight * lift + ny * 4);
        this.art.setX(nx * 8 * (1 - spin.value));
        this.art.setScale(1 + lift * 0.1);
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

  canAttack(now: number): boolean {
    const minCost = lightAttackStaminaCost(1, this.stats.attackStaminaMul ?? 1);
    return !this.status.cannotAttack(now) && this.stamina >= minCost;
  }

  healFull(): void {
    this.clearRage();
    this.health = this.stats.maxHealth;
    this.stamina = this.stats.maxStamina;
    this.maxBlockShield = blockShieldMaxFor(this.stats.maxHealth);
    this.blockShield = this.maxBlockShield;
    this.clearTempShield();
    this.clearMagicVortex();
    this.clearClawMark();
  }

  heal(amount: number): void {
    if (amount <= 0 || this.down || !this.present) {
      return;
    }
    this.health = Math.min(this.stats.maxHealth, this.health + amount);
  }

  get isPresent(): boolean {
    return this.present;
  }

  setPresent(value: boolean): void {
    this.present = value;
    this.sprite.setActive(value);
    this.sprite.setVisible(false);
    this.view.setVisible(value);
    const body = this.body;
    if (body) {
      body.enable = value;
    }
    if (!value) {
      this.stop();
      this.clearRopeWrap();
      this.clearMagicVortex();
      this.clearTempShield();
      this.clearClawMark();
      this.clearRage();
      dismissWitchSkeletons(this);
    }
  }

  showRopeWrap(untilMs: number): void {
    this.wrapUntil = untilMs;
    if (!this.wrapGfx || !this.wrapGfx.active) {
      this.wrapGfx = this.scene.add.graphics().setDepth(11);
    }
  }

  clearRopeWrap(): void {
    this.wrapUntil = 0;
    this.wrapGfx?.destroy();
    this.wrapGfx = undefined;
  }

  applyTempShield(now: number, amount: number, durationMs: number): void {
    this.tempShield = Math.max(0, amount);
    this.tempShieldUntil = now + durationMs;
  }

  clearTempShield(): void {
    this.tempShield = 0;
    this.tempShieldUntil = 0;
  }

  shieldAmount(now = this.now()): number {
    if (now >= this.tempShieldUntil) {
      this.tempShield = 0;
      return 0;
    }
    return this.tempShield;
  }

  private absorbShield(amount: number, now: number): number {
    const available = this.shieldAmount(now);
    if (available <= 0 || amount <= 0) {
      return 0;
    }
    const used = Math.min(available, amount);
    this.tempShield = available - used;
    if (this.tempShield <= 0) {
      this.clearTempShield();
    }
    return used;
  }

  showMagicVortex(untilMs: number, tint = 0x9b4dff): void {
    this.vortexUntil = untilMs;
    this.vortexTint = tint;
    if (!this.vortexGfx || !this.vortexGfx.active) {
      this.vortexGfx = this.scene.add.graphics().setDepth(11);
    }
  }

  clearMagicVortex(): void {
    this.vortexUntil = 0;
    this.vortexGfx?.destroy();
    this.vortexGfx = undefined;
  }

  private syncMagicVortex(): void {
    const gfx = this.vortexGfx;
    if (!gfx) {
      return;
    }
    const now = this.now();
    if (!this.present || this.down || now >= this.vortexUntil) {
      this.clearMagicVortex();
      return;
    }
    drawMagicVortex(gfx, this.x, this.y, now, this.vortexTint);
  }

  applyClawMark(now: number): void {
    const fresh = now >= this.clawUntil;
    this.clawUntil = now + SHADOW_MARK.durationMs;
    if (fresh) {
      this.clawTickAt = now;
      playWorld('shadow-claw-mark', this);
    }
    if (!this.clawGfx || !this.clawGfx.active) {
      this.clawGfx = this.scene.add.graphics().setDepth(11);
    }
  }

  takeDotDamage(amount: number, now: number): void {
    if (this.down || !this.present || amount <= 0) {
      return;
    }
    const applied = Math.min(this.health, amount);
    this.health = Math.max(0, this.health - amount);
    if (applied > 0) {
      emitCombatDamage({
        attacker: null,
        victim: this,
        amount: applied,
        kind: 'other',
        at: now,
        victimTeam: this.team,
      });
    }
    if (this.down) {
      this.stop();
      this.clearTempShield();
      this.clearMagicVortex();
      this.clearClawMark();
      this.clearRage();
      dismissWitchSkeletons(this);
      if (applied > 0) {
        playDeath(this);
      }
    }
  }

  applyRagePool(now: number, durationMs: number, extraMul: number): void {
    this.clearRagePool();
    const extra = Math.round(this.baseMaxStamina * extraMul);
    this.stats.maxStamina = this.baseMaxStamina + extra;
    this.stamina += extra;
    this.rageStaminaUntil = now + durationMs;
  }

  showRageFire(untilMs: number, castUntilMs: number): void {
    this.rageUntil = untilMs;
    this.rageCastUntil = castUntilMs;
    if (!this.rageGfx || !this.rageGfx.active) {
      this.rageGfx = this.scene.add.graphics().setDepth(12);
    }
  }

  clearRage(): void {
    this.clearRagePool();
    this.status.clearTimedBuffs();
    this.rageUntil = 0;
    this.rageCastUntil = 0;
    this.rageGfx?.destroy();
    this.rageGfx = undefined;
  }

  private clearRagePool(): void {
    if (this.rageStaminaUntil <= 0) {
      return;
    }
    this.stats.maxStamina = this.baseMaxStamina;
    this.stamina = Math.min(this.stamina, this.baseMaxStamina);
    this.rageStaminaUntil = 0;
  }

  clearClawMark(): void {
    this.clawUntil = 0;
    this.clawTickAt = 0;
    this.clawGfx?.destroy();
    this.clawGfx = undefined;
  }

  private syncClawMark(): void {
    const gfx = this.clawGfx;
    if (!gfx) {
      return;
    }
    const now = this.now();
    if (!this.present || this.down || now >= this.clawUntil) {
      this.clearClawMark();
      return;
    }
    while (this.clawTickAt + SHADOW_MARK.tickMs <= now && this.clawTickAt + SHADOW_MARK.tickMs <= this.clawUntil) {
      this.clawTickAt += SHADOW_MARK.tickMs;
      const amount = this.stats.maxHealth * SHADOW_MARK.healthPerSecond * (SHADOW_MARK.tickMs / 1000);
      this.takeDotDamage(amount, now);
      if (this.down) {
        return;
      }
    }
    drawClawMark(gfx, this.x, this.y, now);
  }

  private syncRageFire(): void {
    if (this.rageStaminaUntil > 0 && this.now() >= this.rageStaminaUntil) {
      this.clearRagePool();
    }
    const gfx = this.rageGfx;
    if (!gfx) {
      return;
    }
    const now = this.now();
    if (!this.present || this.down || now >= this.rageUntil) {
      this.rageGfx?.destroy();
      this.rageGfx = undefined;
      this.rageUntil = 0;
      return;
    }
    const intensity =
      now < this.rageCastUntil
        ? 0.28 + 0.72 * (1 - (this.rageCastUntil - now) / SHADOW_RAGE.castMs)
        : 1;
    drawRageFire(gfx, this.x, this.y, now, intensity);
  }

  private syncRopeWrap(): void {
    const gfx = this.wrapGfx;
    if (!gfx) {
      return;
    }
    const now = this.now();
    if (!this.present || this.down || now >= this.wrapUntil) {
      this.clearRopeWrap();
      return;
    }
    drawRopeWrap(gfx, this.x, this.y, now);
  }

  placeAt(x: number, y: number): void {
    const boxed = this.boxedPoint(x, y);
    this.sprite.setPosition(boxed.x, boxed.y);
    this.body?.reset(boxed.x, boxed.y);
    this.view.setPosition(boxed.x, boxed.y);
  }

  private boxedPoint(x: number, y: number): { x: number; y: number } {
    const box = arenaInnerBounds(this.stats.bodyRadius);
    return {
      x: Math.min(box.maxX, Math.max(box.minX, x)),
      y: Math.min(box.maxY, Math.max(box.minY, y)),
    };
  }

  /** Keep walk and knockback from leaving the wall strip. */
  private containInArena(): void {
    if (!this.present) {
      return;
    }
    const box = arenaInnerBounds(this.stats.bodyRadius);
    const x = Math.min(box.maxX, Math.max(box.minX, this.sprite.x));
    const y = Math.min(box.maxY, Math.max(box.minY, this.sprite.y));
    const body = this.body;
    if (x !== this.sprite.x || y !== this.sprite.y) {
      this.sprite.setPosition(x, y);
      if (body) {
        body.x = x - body.halfWidth;
        body.y = y - body.halfHeight;
      }
    }
    if (!body) {
      return;
    }
    if (x <= box.minX && body.velocity.x < 0) {
      body.setVelocityX(0);
    }
    if (x >= box.maxX && body.velocity.x > 0) {
      body.setVelocityX(0);
    }
    if (y <= box.minY && body.velocity.y < 0) {
      body.setVelocityY(0);
    }
    if (y >= box.maxY && body.velocity.y > 0) {
      body.setVelocityY(0);
    }
  }

  hasAttackStamina(cost: number, now: number): boolean {
    if (cost <= 0) {
      return true;
    }
    if (this.stamina >= cost) {
      return true;
    }
    this.staminaDeniedAt = now;
    return false;
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

  canRaiseBlock(): boolean {
    return this.blockShield >= COMBAT.blockMinShield;
  }

  drainBlockShield(amount: number, now: number): number {
    if (amount <= 0) {
      return this.blockShield;
    }
    this.blockShield = Math.max(0, this.blockShield - amount);
    this.blockShieldLockUntil = now + COMBAT.blockShieldRegenDelayMs;
    return this.blockShield;
  }

  regenBlockShield(deltaMs: number, now: number): void {
    if (this.blocking || now < this.blockShieldLockUntil) {
      return;
    }
    this.blockShield = Math.min(
      this.maxBlockShield,
      this.blockShield + COMBAT.blockShieldRegenPerSecond * (deltaMs / 1000),
    );
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
      this.stamina + this.stats.staminaRegenPerSecond * this.status.staminaRegenMultiplier(now) * (deltaMs / 1000),
    );
  }

  regenHealth(deltaMs: number, now: number): void {
    if (this.down || !this.present || this.stats.role === 'minion') {
      return;
    }
    if (now - this.lastEnemyHitAt < MATCH.outOfCombat.delayMs) {
      return;
    }
    if (this.health >= this.stats.maxHealth) {
      return;
    }
    this.health = Math.min(
      this.stats.maxHealth,
      this.health + MATCH.outOfCombat.regenPerSecond * (deltaMs / 1000),
    );
  }

  destroy(): void {
    this.present = false;
    this.scene.physics.world?.off('worldstep', this.containInArena, this);
    this.currentAttackTween?.stop();
    this.currentAttackTween = undefined;
    this.scene.tweens.killTweensOf(this.view);
    this.scene.tweens.killTweensOf(this.art);
    this.clearRopeWrap();
    this.clearMagicVortex();
    this.clearTempShield();
    this.clearClawMark();
    this.clearRage();
    unregisterWitchSkeleton(this);
    dismissWitchSkeletons(this);
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
      team: this.team,
    });
  }

  private redrawHandSparks(): void {
    if (!this.sparks) {
      return;
    }
    drawColeElectricity(this.sparks, this.facing, this.now(), this.armLiftLeft, this.armLiftRight);
  }
}
