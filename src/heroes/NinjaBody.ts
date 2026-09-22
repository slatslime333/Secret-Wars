import Phaser from 'phaser';
import { arenaInnerBounds } from '../config/arena';
import { HeroCombatConfig, TeamId, teamOfRival } from '../config/hero';
import { NINJA } from '../config/ninja';
import { COMBAT, ComboStep, blockShieldMaxFor, comboStepOf, lightAttackStaminaCost } from '../config/combat';
import { CombatStatus } from '../combat/CombatStatus';
import { TakeHitOptions } from '../combat/Hurtbox';
import { emitCombatBlocked, emitCombatDamage } from '../combat/damageEvents';
import { emitCombatHeal } from '../combat/healEvents';
import { BODY_TEXTURE, ensureBodyTexture } from './bodyTexture';
import { drawNinja, facingFromAim, type CardinalFacing } from './drawNinja';
import { drawColeElectricity } from './drawCole';
import type { HeroDrawFn, HeroDrawOptions } from './heroDraw';
import { applyWitchSprite, createWitchSprite, WITCH_FEET_Y, WITCH_WORLD_SCALE } from './witchSprite';
import { applyColeSprite, createColeSprite, COLE_FEET_Y, COLE_WORLD_SCALE } from './coleSprite';
import { applyNinjaSprite, createNinjaSprite, NINJA_FEET_Y, NINJA_WORLD_SCALE } from './ninjaSprite';
import { applyRopeSprite, createRopeSprite, ROPE_FEET_Y, ROPE_WALK_FRAMES, ROPE_WORLD_SCALE } from './ropeSprite';
import { applyDeathSprite, createDeathSprite, DEATH_FEET_Y, DEATH_WORLD_SCALE } from './deathSprite';
import { applyMenderSprite, createMenderSprite, MENDER_FEET_Y, MENDER_WORLD_SCALE } from './menderSprite';
import { applyShadowSprite, createShadowSprite, SHADOW_FEET_Y, SHADOW_WORLD_SCALE } from './shadowSprite';
import { playDeath, playWorld } from '../audio';
import { drawRopeWrap } from './abilities/rope/ropeVisual';
import { drawMagicVortex } from './abilities/witch/vortex';
import { drawClawMark, drawRageFire } from './abilities/shadow/clawFx';
import { SHADOW_MARK, SHADOW_RAGE } from './abilities/shadow/tunables';
import { dismissWitchSkeletons, unregisterWitchSkeleton } from './abilities/witch/skeletonPack';
import { absorbGuardianAngel, clearGuardian } from './abilities/mender/shieldState';
import { tickBurn, isBurning, clearBurn, drawBurnFlames } from './abilities/demon/burnFx';
import { resetDemonForm, type DemonForm } from './abilities/demon/form';
import { DEV_CHEATS } from '../debug/devCheats';
import {
  drawHurtGlow,
  drawHurtMark,
  hurtFlashMs,
  hurtPulse,
  HURT_MARK_MS,
  isLowHealth,
} from './hurtFeedback';
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
  kitHasAllySupport = false;
  /** Stamped from Progression so tactical views can see levels without a second AI. */
  kitLevel = 1;
  kitXpRatio = 0;
  lastAttacker?: NinjaBody;
  lastAttackerAt = 0;
  /** Last time an enemy actually dealt HP damage. Minion heals / regen do not touch this. */
  lastEnemyHitAt = -1e9;
  private present = true;
  readonly aim = new Phaser.Math.Vector2(1, 0);
  private facing: CardinalFacing = 'east';
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly spriteArt?: Phaser.GameObjects.Sprite;
  private spriteKind?: 'witch' | 'cole' | 'ninja' | 'rope' | 'death' | 'mender' | 'shadow';
  private spriteScale = 1;
  private spriteFeetY = 16;
  private lastStaffRaise = 0;
  private lastSwordAngle = 0;
  private lastRopeAction: 'shot' | 'punch' | 'grab' = 'shot';
  private lastShowUzi = false;
  private lastBatScale = 1;
  private witchMoving = false;
  private witchWalkPx = 0;
  private witchWalkAt = 0;
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
  private pendingLaunch?: { x: number; y: number; cap: number };
  private holdAttackPose = false;
  /** Sheet slash stays upright. Procedural tilt is for drawn heroes only. */
  private ninjaSheetAttack = false;
  private hurtGlow?: Phaser.GameObjects.Graphics;
  private hurtMark?: Phaser.GameObjects.Graphics;
  private hurtTint?: Phaser.GameObjects.Sprite;
  private hurtFlashUntil = 0;
  private hurtMarkUntil = 0;
  private hurtDirX = 1;
  private hurtDirY = 0;
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
  private fairyForm = false;
  private ghostHeroes = false;
  demonForm: DemonForm = 'little';
  demonRage = 0;
  demonTransformUntil = 0;
  demonScaled = false;
  readonly steer = new Phaser.Math.Vector2(0, 0);
  private burnGfx?: Phaser.GameObjects.Graphics;

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
    if (this.stats.id === 'witch') {
      this.spriteKind = 'witch';
      this.spriteScale = WITCH_WORLD_SCALE;
      this.spriteFeetY = WITCH_FEET_Y;
      this.spriteArt = createWitchSprite(scene, 0, WITCH_FEET_Y, { rival: this.rival, team: this.team });
      if (this.spriteArt) {
        this.view.add(this.spriteArt);
      }
    } else if (this.stats.id === 'cole') {
      this.spriteKind = 'cole';
      this.spriteScale = COLE_WORLD_SCALE;
      this.spriteFeetY = COLE_FEET_Y;
      this.spriteArt = createColeSprite(scene, 0, COLE_FEET_Y, { rival: this.rival, team: this.team });
      if (this.spriteArt) {
        this.view.add(this.spriteArt);
      }
    } else if (this.stats.id === 'ninja') {
      this.spriteKind = 'ninja';
      this.spriteScale = NINJA_WORLD_SCALE;
      this.spriteFeetY = NINJA_FEET_Y;
      this.spriteArt = createNinjaSprite(scene, 0, NINJA_FEET_Y, { rival: this.rival, team: this.team });
      if (this.spriteArt) {
        this.view.add(this.spriteArt);
      }
    } else if (this.stats.id === 'rope') {
      this.spriteKind = 'rope';
      this.spriteScale = ROPE_WORLD_SCALE;
      this.spriteFeetY = ROPE_FEET_Y;
      this.spriteArt = createRopeSprite(scene, 0, ROPE_FEET_Y, { rival: this.rival, team: this.team });
      if (this.spriteArt) {
        this.view.add(this.spriteArt);
      }
    } else if (this.stats.id === 'death') {
      this.spriteKind = 'death';
      this.spriteScale = DEATH_WORLD_SCALE;
      this.spriteFeetY = DEATH_FEET_Y;
      this.spriteArt = createDeathSprite(scene, 0, DEATH_FEET_Y, { rival: this.rival, team: this.team });
      if (this.spriteArt) {
        this.view.add(this.spriteArt);
      }
    } else if (this.stats.id === 'mender') {
      this.spriteKind = 'mender';
      this.spriteScale = MENDER_WORLD_SCALE;
      this.spriteFeetY = MENDER_FEET_Y;
      this.spriteArt = createMenderSprite(scene, 0, MENDER_FEET_Y, { rival: this.rival, team: this.team });
      if (this.spriteArt) {
        this.view.add(this.spriteArt);
      }
    } else if (this.stats.id === 'shadow') {
      this.spriteKind = 'shadow';
      this.spriteScale = SHADOW_WORLD_SCALE;
      this.spriteFeetY = SHADOW_FEET_Y;
      this.spriteArt = createShadowSprite(scene, 0, SHADOW_FEET_Y, { rival: this.rival, team: this.team });
      if (this.spriteArt) {
        this.view.add(this.spriteArt);
      }
    }
    if (options.handSparks) {
      this.sparks = scene.add.graphics();
      this.view.add(this.sparks);
    }
    this.hurtGlow = scene.add.graphics();
    this.hurtGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.view.addAt(this.hurtGlow, 1);
    if (this.spriteArt) {
      this.hurtTint = scene.add.sprite(this.spriteArt.x, this.spriteArt.y, this.spriteArt.texture.key, this.spriteArt.frame.name);
      this.hurtTint.setOrigin(this.spriteArt.originX, this.spriteArt.originY);
      this.hurtTint.setTintFill(0xff2430);
      this.hurtTint.setVisible(false);
      this.view.add(this.hurtTint);
    }
    this.hurtMark = scene.add.graphics();
    this.view.add(this.hurtMark);
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
    this.syncBurn();
    const now = this.now();
    if (this.heroId === 'rope' && !this.spriteArt && now >= this.attackingUntil && this.present && !this.down) {
      const hop = Math.abs(Math.sin(now / 130)) * 3.4;
      this.art.setY(-hop);
    }
    this.syncPixelSprite(now);
    this.syncHurtFeedback(now);
    const flashing = this.status.isFlashingHit(now);
    if (flashing !== this.lastDrawnFlash && this.now() >= this.attackingUntil) {
      this.lastDrawnFlash = flashing;
      this.redrawIdle();
    }
  }

  recordSteer(move: Phaser.Math.Vector2): void {
    this.steer.copy(move);
  }

  applyMove(move: Phaser.Math.Vector2): void {
    this.recordSteer(move);
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
    if (this.isInvulnerable(this.now())) {
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
    const converted = absorbGuardianAngel(this, incoming, now);
    if (converted > 0) {
      emitCombatBlocked({ defender: this, amount: converted, at: now });
      this.lastDrawnFlash = true;
      this.redrawIdle();
      this.view.setScale(1.1);
      this.scene.tweens.add({
        targets: this.view,
        scale: 1,
        duration: 90,
        ease: 'Stepped',
        easeParams: [3],
      });
      return;
    }
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
    const dirX = options.dirX / length;
    const dirY = options.dirY / length;
    const launchCap = options.launchCap ?? COMBAT.launchSpeedCap;
    this.deferOrLaunch(now, dirX, dirY, power, launchCap, hitStopMs);
    if (minion) {
      this.status.applyStun(now, options.hitReactionMs ?? MINION.hitReactionMs);
    } else if (options.stun) {
      this.status.applyStun(now, options.hitReactionMs ?? COMBAT.combo[options.step].hitReactionMs);
    } else {
      this.status.applyHitReaction(now, options.step, options.hitReactionMs);
    }
    this.lastDrawnFlash = true;
    this.redrawIdle();
    if (applied > 0) {
      this.hurtFlashUntil = now + hurtFlashMs();
      this.hurtMarkUntil = now + HURT_MARK_MS;
      this.hurtDirX = dirX;
      this.hurtDirY = dirY;
    }
    const squashY = options.clash ? 0.8 : options.step === 3 ? 0.76 : options.step === 2 ? 0.84 : 0.9;
    const stretchX = options.clash ? 1.12 : options.step === 3 ? 1.14 : options.step === 2 ? 1.08 : 1.04;
    const recoil = options.clash ? 8 : options.step === 3 ? 11 : options.step === 2 ? 7 : 4;
    const lean = options.step === 3 ? 0.22 : options.step === 2 ? 0.14 : 0.08;
    this.view.setScale(stretchX, squashY);
    this.view.setRotation(dirX >= 0 ? lean : -lean);
    this.art.setPosition(-dirX * recoil, -dirY * recoil);
    const settle = options.step === 3 ? 160 : options.step === 2 ? 120 : 90;
    this.scene.tweens.add({
      targets: this.view,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      delay: hitStopMs,
      duration: settle,
      ease: 'Quad.Out',
    });
    this.scene.tweens.add({
      targets: this.art,
      x: 0,
      y: 0,
      delay: hitStopMs,
      duration: settle,
      ease: 'Quad.Out',
    });
    if (this.down) {
      this.stop();
      this.clearTempShield();
      this.clearMagicVortex();
      this.clearClawMark();
      this.clearRage();
      this.setFairyForm(false);
      resetDemonForm(this);
      clearBurn(this);
      dismissWitchSkeletons(this);
      if (applied > 0) {
        playDeath(this);
      }
    }
  }

  /** Contact squash. Holds through hit-stop, then eases back. */
  playConnectPunch(step: ComboStep, holdMs = 0): void {
    if (this.spriteKind === 'ninja') {
      return;
    }
    const sy = step === 3 ? 0.8 : step === 2 ? 0.86 : 0.92;
    const sx = step === 3 ? 1.1 : step === 2 ? 1.06 : 1.03;
    const kick = step === 3 ? 8 : step === 2 ? 5 : 3;
    this.view.setScale(sx, sy);
    this.art.setPosition(-this.aim.x * kick, -this.aim.y * kick);
    this.scene.tweens.add({
      targets: this.view,
      scaleX: 1,
      scaleY: 1,
      delay: holdMs,
      duration: step === 3 ? 140 : 90,
      ease: 'Quad.Out',
    });
    this.scene.tweens.add({
      targets: this.art,
      x: 0,
      y: 0,
      delay: holdMs,
      duration: step === 3 ? 130 : 80,
      ease: 'Quad.Out',
    });
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
    if (durationMs <= 0) {
      return;
    }
    this.status.applyHitStop(now, durationMs);
    this.frozenUntil = Math.max(this.frozenUntil, now + durationMs);
    this.physics()?.setVelocity(0, 0);
    const tween = this.currentAttackTween;
    if (tween?.isPlaying()) {
      tween.pause();
      this.holdAttackPose = true;
    }
  }

  queueLaunch(dirX: number, dirY: number, power: number, launchCap: number = COMBAT.launchSpeedCap): void {
    if (power <= 0) {
      return;
    }
    const length = Math.hypot(dirX, dirY) || 1;
    this.pendingLaunch = { x: (dirX / length) * power, y: (dirY / length) * power, cap: launchCap };
  }

  /**
   * A live freeze holds the body still and stores the launch.
   * hitStopMs 0 after the freeze has ended launches immediately.
   */
  private deferOrLaunch(
    now: number,
    dirX: number,
    dirY: number,
    power: number,
    launchCap: number,
    hitStopMs: number,
  ): void {
    const stillFrozen = now < this.frozenUntil;
    if (hitStopMs > 0 || stillFrozen) {
      this.queueLaunch(dirX, dirY, power, launchCap);
      if (hitStopMs > 0) {
        this.freezeForHitStop(now, hitStopMs);
      }
      return;
    }
    const body = this.physics();
    if (!body) {
      return;
    }
    body.setDrag(COMBAT.bodyDrag, COMBAT.bodyDrag);
    this.launch(dirX, dirY, power, launchCap);
  }

  private tickHitStop(now: number): void {
    if (now < this.frozenUntil) {
      this.physics()?.setVelocity(0, 0);
      return;
    }
    if (this.holdAttackPose) {
      this.holdAttackPose = false;
      if (this.currentAttackTween?.isPaused()) {
        this.currentAttackTween.resume();
      }
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
    this.launch(launch.x, launch.y, Math.hypot(launch.x, launch.y), launch.cap);
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
    const startup = 70 + comboStep * 28;
    const duration = startup + profile.recoveryMs;
    this.attackingUntil = now + duration;
    this.status.markSwing(now, comboStep);
    if (this.spriteKind === 'ninja') {
      this.playNinjaSheetAttack(duration);
      return;
    }

    const lungeX = this.aim.x * (profile.lungeDistance + 6);
    const lungeY = this.aim.y * (profile.lungeDistance + 6);
    const tilt = (this.aim.x >= 0 ? 1 : -1) * (0.28 + comboStep * 0.1);
    const windAngle = comboStep === 1 ? -0.7 : comboStep === 2 ? -1.05 : -1.35;
    const strikeAngle = comboStep === 1 ? 0.95 : comboStep === 2 ? 1.35 : 1.8;
    const contactScale = comboStep === 3 ? 1.1 : comboStep === 2 ? 1.06 : 1.03;

    this.holdAttackPose = false;
    this.currentAttackTween?.stop();
    const swordAnimState = { frac: 0 };
    this.currentAttackTween = this.scene.tweens.add({
      targets: swordAnimState,
      frac: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        if (!this.present) {
          return;
        }
        const frac = swordAnimState.frac;
        let pose = 0;
        let reach = 0;
        if (frac < 0.34) {
          pose = windAngle * (frac / 0.34);
          reach = -0.25 * (frac / 0.34);
        } else if (frac < 0.62) {
          const t = (frac - 0.34) / 0.28;
          pose = windAngle + (strikeAngle - windAngle) * t;
          reach = -0.25 + 1.25 * t;
        } else {
          const t = (frac - 0.62) / 0.38;
          pose = strikeAngle * (1 - t);
          reach = 1 - t;
        }
        this.paintHero({
          facing: this.facing,
          attacking: true,
          swordAngleOffset: pose,
          comboStep,
          hitFlash: this.status.isFlashingHit(this.now()),
          rival: this.rival,
          team: this.team,
          fairyForm: this.fairyForm,
          demonForm: this.demonForm,
        });
        this.art.setPosition(lungeX * reach, lungeY * reach);
        this.art.setRotation(tilt * Math.max(0, reach));
        const squash = reach > 0.65 ? contactScale : 1;
        this.art.setScale(squash, reach > 0.65 ? 2 - contactScale : 1);
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

  /**
   * Wind-up, strike, follow-through on the sheet. The slash is already drawn,
   * so the sprite stays planted instead of tilting off its feet.
   */
  private playNinjaSheetAttack(duration: number): void {
    this.holdAttackPose = false;
    this.currentAttackTween?.stop();
    this.ninjaSheetAttack = true;
    this.art.setPosition(0, 0);
    this.art.setRotation(0);
    this.art.setScale(1);
    const phase = { frac: 0 };
    const paint = (frac: number) => {
      const swordAngleOffset = frac < 0.34 ? -1 : frac < 0.62 ? 0 : 1;
      this.paintHero({
        facing: this.facing,
        attacking: true,
        swordAngleOffset,
        comboStep: 1,
        hitFlash: this.status.isFlashingHit(this.now()),
        rival: this.rival,
        team: this.team,
        fairyForm: this.fairyForm,
        demonForm: this.demonForm,
      });
    };
    paint(0);
    const tween = this.scene.tweens.add({
      targets: phase,
      frac: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        if (!this.present || this.currentAttackTween !== tween) {
          return;
        }
        this.art.setPosition(0, 0);
        this.art.setRotation(0);
        this.art.setScale(1);
        paint(phase.frac);
      },
      onComplete: () => {
        if (!this.present || this.currentAttackTween !== tween) {
          return;
        }
        this.ninjaSheetAttack = false;
        this.art.setPosition(0, 0);
        this.art.setRotation(0);
        this.art.setScale(1);
        this.redrawIdle();
      },
    });
    this.currentAttackTween = tween;
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
      ropeAction?: 'shot' | 'punch' | 'grab';
      scaleX?: number;
      scaleY?: number;
    },
    ease: string = 'Sine.InOut',
  ): void {
    this.holdAttackPose = false;
    this.ninjaSheetAttack = false;
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
        this.paintHero({
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
          ropeAction: pose.ropeAction,
          fairyForm: this.fairyForm,
          demonForm: this.demonForm,
        });
        this.art.setPosition(pose.swayX ?? 0, pose.jumpY ?? 0);
        this.art.setScale(pose.scaleX ?? 1, pose.scaleY ?? 1);
      },
      onComplete: () => {
        if (!this.present) {
          return;
        }
        this.armLiftLeft = 0;
        this.armLiftRight = 0;
        this.art.setPosition(0, 0);
        this.art.setScale(1);
        this.redrawIdle();
      },
    });
  }

  playEvasiveLean(dirX: number, dirY: number, durationMs: number): void {
    this.ninjaSheetAttack = false;
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
    this.ninjaSheetAttack = false;
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
    this.ninjaSheetAttack = false;
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
    this.ninjaSheetAttack = false;
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

  playBlockRecoil(now: number, heavy: boolean, holdMs = 0): void {
    this.status.applyBlockStun(now, heavy ? COMBAT.perfectShieldStunMs : COMBAT.perfectShieldStunMs * 0.75);
    const power = heavy ? 120 : 70;
    if (holdMs > 0) {
      this.freezeForHitStop(now, holdMs);
      this.queueLaunch(-this.aim.x, -this.aim.y, power);
      this.status.applySteerLock(now, holdMs + 50);
    } else {
      this.applyRecoil(-this.aim.x, -this.aim.y, power);
    }
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
    resetDemonForm(this);
    clearBurn(this);
    this.health = this.stats.maxHealth;
    this.stamina = this.stats.maxStamina;
    this.maxBlockShield = blockShieldMaxFor(this.stats.maxHealth);
    this.blockShield = this.maxBlockShield;
    this.clearTempShield();
    this.clearMagicVortex();
    this.clearClawMark();
    this.setFairyForm(false);
    clearGuardian(this);
  }

  /** Restore HP. Returns the amount actually applied (no overheal). */
  heal(amount: number, healer?: NinjaBody): number {
    if (amount <= 0 || this.down || !this.present) {
      return 0;
    }
    const missing = this.stats.maxHealth - this.health;
    const applied = Math.min(missing, amount);
    if (applied <= 0) {
      return 0;
    }
    this.health += applied;
    if (healer) {
      emitCombatHeal({ healer, target: this, amount: applied, at: this.scene.time.now });
    }
    return applied;
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
      this.setFairyForm(false);
      resetDemonForm(this);
      clearBurn(this);
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

  setFairyForm(value: boolean): void {
    if (this.fairyForm !== value) {
      this.fairyForm = value;
      this.view.setScale(value ? 0.72 : 1);
      this.setPhysicsEnabled(!value);
      this.redrawIdle();
    }
    this.refreshSkipHeroCollide();
  }

  /** Soul Dash flies through allies so the host CPU is not collider-frozen. */
  setGhostHeroes(value: boolean): void {
    this.ghostHeroes = value;
    this.refreshSkipHeroCollide();
  }

  /** Fairy attach disables collision so the host CPU can keep walking. */
  setPhysicsEnabled(enabled: boolean): void {
    const body = this.body;
    if (!body) {
      return;
    }
    body.enable = enabled;
    if (!enabled) {
      body.setVelocity(0, 0);
    }
  }

  private refreshSkipHeroCollide(): void {
    this.sprite.setData('skipHeroCollide', this.fairyForm || this.ghostHeroes);
  }

  setDemonForm(form: DemonForm): void {
    this.demonForm = form;
    if (form === 'bat') {
      this.view.setScale(0.92);
    } else if (form === 'big') {
      this.view.setScale(1.28);
    } else if (form === 'transforming') {
      this.view.setScale(1.08);
    } else {
      this.view.setScale(1);
    }
    this.redrawIdle();
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

  takeDotDamage(amount: number, now: number, attacker?: NinjaBody): void {
    if (this.down || !this.present || amount <= 0) {
      return;
    }
    const converted = absorbGuardianAngel(this, amount, now);
    if (converted > 0) {
      emitCombatBlocked({ defender: this, amount: converted, at: now });
      return;
    }
    const applied = Math.min(this.health, amount);
    this.health = Math.max(0, this.health - amount);
    if (applied > 0) {
      emitCombatDamage({
        attacker: attacker ?? null,
        victim: this,
        amount: applied,
        kind: 'other',
        at: now,
        attackerTeam: attacker?.team,
        victimTeam: this.team,
      });
    }
    if (attacker && attacker.team !== this.team) {
      this.lastAttacker = attacker;
      this.lastAttackerAt = now;
      this.lastEnemyHitAt = now;
    }
    if (this.down) {
      this.stop();
      this.clearTempShield();
      this.clearMagicVortex();
      this.clearClawMark();
      this.clearRage();
      this.setFairyForm(false);
      resetDemonForm(this);
      clearBurn(this);
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

  private syncBurn(): void {
    const now = this.now();
    tickBurn(this, now);
    if (!isBurning(this, now)) {
      this.burnGfx?.destroy();
      this.burnGfx = undefined;
      return;
    }
    if (!this.burnGfx || !this.burnGfx.active) {
      this.burnGfx = this.scene.add.graphics().setDepth(12);
    }
    drawBurnFlames(this.burnGfx, this.x, this.y, now);
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
    this.setFairyForm(false);
    resetDemonForm(this);
    clearBurn(this);
    this.burnGfx?.destroy();
    clearGuardian(this);
    this.sprite.destroy();
    this.view.destroy();
  }

  private paintHero(options: HeroDrawOptions): void {
    this.lastStaffRaise = options.staffRaise ?? 0;
    this.lastSwordAngle = options.swordAngleOffset ?? 0;
    this.lastRopeAction = options.ropeAction ?? this.lastRopeAction;
    this.lastShowUzi = Boolean(options.showUzi);
    this.lastBatScale = options.batScale ?? 1;
    if (this.spriteArt && this.spriteKind) {
      if (options.fairyForm) {
        this.spriteArt.setVisible(false);
        this.drawHero(this.art, options);
        return;
      }
      this.spriteArt.setVisible(true);
      this.art.clear();
      if (options.attacking) {
        this.applyPixelSprite({
          facing: options.facing,
          attacking: true,
          staffRaise: options.staffRaise,
          swordAngleOffset: options.swordAngleOffset,
          ropeAction: options.ropeAction ?? this.lastRopeAction,
          armLiftLeft: options.armLiftLeft,
          armLiftRight: options.armLiftRight,
          charge: Math.max(options.armLiftLeft ?? 0, options.armLiftRight ?? 0, options.staffRaise ?? 0),
          showUzi: options.showUzi,
          batScale: options.batScale,
          hitFlash: options.hitFlash,
        });
      }
      return;
    }
    this.drawHero(this.art, options);
  }

  private applyPixelSprite(pose: {
    facing: CardinalFacing;
    attacking?: boolean;
    staffRaise?: number;
    swordAngleOffset?: number;
    ropeAction?: 'shot' | 'punch' | 'grab';
    armLiftLeft?: number;
    armLiftRight?: number;
    charge?: number;
    showUzi?: boolean;
    batScale?: number;
    hitFlash?: boolean;
    moving?: boolean;
    walkFrame?: number;
    now?: number;
  }): void {
    if (!this.spriteArt) {
      return;
    }
    if (this.spriteKind === 'death') {
      applyDeathSprite(this.spriteArt, {
        facing: pose.facing,
        attacking: pose.attacking,
        swordAngleOffset: pose.swordAngleOffset ?? this.lastSwordAngle,
        batScale: pose.batScale ?? this.lastBatScale,
        showUzi: pose.showUzi ?? this.lastShowUzi,
        armLiftRight: pose.armLiftRight ?? this.armLiftRight,
        hitFlash: pose.hitFlash,
        moving: pose.moving,
        walkFrame: pose.walkFrame,
        now: pose.now,
      });
      return;
    }
    if (this.spriteKind === 'cole') {
      applyColeSprite(this.spriteArt, {
        facing: pose.facing,
        attacking: pose.attacking,
        charge: pose.charge ?? pose.staffRaise,
        hitFlash: pose.hitFlash,
        moving: pose.moving,
        walkFrame: pose.walkFrame,
        now: pose.now,
      });
      return;
    }
    if (this.spriteKind === 'ninja') {
      applyNinjaSprite(this.spriteArt, {
        facing: pose.facing,
        attacking: pose.attacking,
        swordAngleOffset: pose.swordAngleOffset ?? this.lastSwordAngle,
        charge: pose.charge,
        hitFlash: pose.hitFlash,
        moving: pose.moving,
        walkFrame: pose.walkFrame,
        now: pose.now,
      });
      return;
    }
    if (this.spriteKind === 'rope') {
      applyRopeSprite(this.spriteArt, {
        facing: pose.facing,
        attacking: pose.attacking,
        ropeAction: pose.ropeAction ?? this.lastRopeAction,
        armLiftLeft: pose.armLiftLeft ?? this.armLiftLeft,
        armLiftRight: pose.armLiftRight ?? this.armLiftRight,
        hitFlash: pose.hitFlash,
        moving: pose.moving,
        walkFrame: pose.walkFrame,
        now: pose.now,
      });
      return;
    }
    if (this.spriteKind === 'mender') {
      applyMenderSprite(this.spriteArt, {
        facing: pose.facing,
        attacking: pose.attacking,
        charge: pose.charge ?? Math.max(pose.armLiftLeft ?? 0, pose.armLiftRight ?? 0),
        hitFlash: pose.hitFlash,
        moving: pose.moving,
        walkFrame: pose.walkFrame,
        now: pose.now,
      });
      return;
    }
    if (this.spriteKind === 'shadow') {
      applyShadowSprite(this.spriteArt, {
        facing: pose.facing,
        attacking: pose.attacking,
        charge: pose.charge ?? pose.armLiftRight,
        hitFlash: pose.hitFlash,
        moving: pose.moving,
        walkFrame: pose.walkFrame,
        now: pose.now,
      });
      return;
    }
    applyWitchSprite(this.spriteArt, {
      facing: pose.facing,
      attacking: pose.attacking,
      staffRaise: pose.staffRaise,
      hitFlash: pose.hitFlash,
      rival: this.rival,
      moving: pose.moving,
      walkFrame: pose.walkFrame,
      now: pose.now,
    });
  }

  private syncPixelSprite(now: number): void {
    const figure = this.spriteArt;
    if (!figure) {
      return;
    }
    const speed = this.body?.speed ?? 0;
    const wantMove = this.present && !this.down && (speed > 26 || this.steer.length() > 0.28);
    if (this.witchMoving) {
      this.witchMoving = this.present && !this.down && (speed > 10 || this.steer.length() > 0.12);
    } else {
      this.witchMoving = wantMove;
    }
    if (this.witchMoving) {
      if (this.witchWalkAt > 0 && now > this.witchWalkAt) {
        this.witchWalkPx += speed * ((now - this.witchWalkAt) / 1000);
      }
      this.witchWalkAt = now;
    } else {
      this.witchWalkPx = 0;
      this.witchWalkAt = 0;
    }
    const bob =
      !this.witchMoving && now >= this.attackingUntil && this.present && !this.down
        ? Math.sin(now / 280) * 0.8
        : 0;
    if (this.spriteKind === 'ninja' && this.ninjaSheetAttack) {
      figure.setPosition(0, this.spriteFeetY);
      figure.setRotation(0);
      figure.setScale(this.spriteScale);
    } else {
      figure.setPosition(this.art.x, this.art.y + this.spriteFeetY + bob);
      figure.setRotation(this.art.rotation);
      figure.setScale(this.art.scaleX * this.spriteScale, this.art.scaleY * this.spriteScale);
    }
    if (this.fairyForm) {
      figure.setVisible(false);
      return;
    }
    figure.setVisible(true);
    if (now < this.attackingUntil) {
      this.applyPixelSprite({
        facing: this.facing,
        attacking: true,
        staffRaise: this.lastStaffRaise,
        swordAngleOffset: this.lastSwordAngle,
        ropeAction: this.lastRopeAction,
        armLiftLeft: this.armLiftLeft,
        armLiftRight: this.armLiftRight,
        charge: Math.max(this.armLiftLeft, this.armLiftRight, this.lastStaffRaise),
        showUzi: this.lastShowUzi,
        batScale: this.lastBatScale,
        hitFlash: this.status.isFlashingHit(now),
        now,
      });
      return;
    }
    this.applyPixelSprite({
      facing: this.ninjaTravelFacing() ?? this.facing,
      moving: this.witchMoving,
      walkFrame:
        this.spriteKind === 'rope'
          ? Math.floor(this.witchWalkPx / 22) % ROPE_WALK_FRAMES
          : Math.floor(this.witchWalkPx / 14) % 4,
      hitFlash: this.status.isFlashingHit(now),
      now,
    });
  }

  private syncHurtFeedback(now: number): void {
    const low = isLowHealth(this.health, this.stats.maxHealth, this.down);
    const pulse = hurtPulse(now);
    const glow = this.hurtGlow;
    if (glow) {
      if (low && !this.fairyForm) {
        drawHurtGlow(glow, pulse);
      } else {
        glow.clear();
      }
    }
    this.syncHurtTint(now, low, pulse);
    const mark = this.hurtMark;
    if (!mark) {
      return;
    }
    if (now >= this.hurtMarkUntil || this.fairyForm) {
      mark.clear();
      return;
    }
    const progress = 1 - (this.hurtMarkUntil - now) / HURT_MARK_MS;
    drawHurtMark(mark, progress, this.hurtDirX, this.hurtDirY, !this.hurtTint);
  }

  private syncHurtTint(now: number, low: boolean, pulse: number): void {
    const copy = this.hurtTint;
    const source = this.spriteArt;
    if (!copy || !source || this.fairyForm || !source.visible) {
      copy?.setVisible(false);
      return;
    }
    if (copy.texture.key !== source.texture.key) {
      copy.setTexture(source.texture.key);
    }
    copy.setFrame(source.frame.name);
    copy.setTintFill(0xff2430);
    copy.setPosition(source.x, source.y);
    copy.setScale(source.scaleX, source.scaleY);
    copy.setRotation(source.rotation);
    copy.setFlip(source.flipX, source.flipY);
    const flash = now < this.hurtFlashUntil ? (this.hurtFlashUntil - now) / hurtFlashMs() : 0;
    if (flash > 0) {
      copy.setVisible(true);
      copy.setAlpha(0.5 + flash * 0.5);
      return;
    }
    if (low) {
      copy.setVisible(true);
      copy.setAlpha(0.08 + pulse * 0.48);
      return;
    }
    copy.setVisible(false);
    copy.setAlpha(0);
  }

  /** Run cycle faces travel. Aim still aims the slash. */
  private ninjaTravelFacing(): CardinalFacing | undefined {
    if (this.spriteKind !== 'ninja' || !this.witchMoving || this.now() < this.attackingUntil) {
      return undefined;
    }
    const velocity = this.body?.velocity;
    const vx = velocity?.x ?? 0;
    const vy = velocity?.y ?? 0;
    if (vx * vx + vy * vy > 36) {
      return facingFromAim(vx, vy);
    }
    if (this.steer.lengthSq() > 0.04) {
      return facingFromAim(this.steer.x, this.steer.y);
    }
    return undefined;
  }

  private redrawIdle(): void {
    this.paintHero({
      facing: this.facing,
      attacking: false,
      swordAngleOffset: 0,
      comboStep: 1,
      hitFlash: this.status.isFlashingHit(this.now()),
      rival: this.rival,
      team: this.team,
      fairyForm: this.fairyForm,
      demonForm: this.demonForm,
    });
  }

  private redrawHandSparks(): void {
    if (!this.sparks) {
      return;
    }
    drawColeElectricity(this.sparks, {
      facing: this.facing,
      now: this.now(),
      liftL: this.armLiftLeft,
      liftR: this.armLiftRight,
      attacking: this.now() < this.attackingUntil,
      team: this.team,
      pixel: this.spriteKind === 'cole',
    });
  }
}

/** Arcade processCallback: skip hero-hero collide while Soul Dash is ghosting or attached. */
export const allowsHeroCollide = (a: object, b: object): boolean => {
  const left = a as Phaser.GameObjects.GameObject;
  const right = b as Phaser.GameObjects.GameObject;
  return left.getData('skipHeroCollide') !== true && right.getData('skipHeroCollide') !== true;
};
