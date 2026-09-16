import Phaser from 'phaser';
import { COMBAT, ComboStep, comboStepOf, lightAttackStaminaCost } from '../config/combat';
import { COLE_ATTACK, COLE_SHOCKWAVE } from '../heroes/abilities/cole/tunables';
import { DEATH_ATTACK } from '../heroes/abilities/death/tunables';
import { ROPE_SHOT } from '../heroes/abilities/rope/tunables';
import { MENDER_PULSE } from '../heroes/abilities/mender/tunables';
import { menderArmOrigin } from '../heroes/drawMender';
import { DEMON_ATTACK, DEMON_CLAW } from '../heroes/abilities/demon/tunables';
import { demonCandleOrigin } from '../heroes/drawDemon';
import { applyBurn } from '../heroes/abilities/demon/burnFx';
import { grantDemonRage, demonRageFromLightDamage, isBigDemon } from '../heroes/abilities/demon/form';
import { sweepKnockback, swingSignFor } from '../heroes/abilities/death/sweep';
import { deathIdleBatAngle } from '../heroes/drawDeath';
import { facingFromAim } from '../heroes/drawNinja';
import { ropeArmOrigin } from '../heroes/drawRope';
import { ComboTracker } from './ComboTracker';
import { HitMarker } from './HitMarker';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';
import { spawnMuzzleFlash } from '../effects/muzzleFlash';
import { spawnCombatCallout } from '../effects/combatCallout';
import { spawnLightningArc, spawnShockwaveRing } from '../effects/lightning';
import { resolveMelee } from './resolveMelee';
import { resolveAbilityHit } from '../heroes/abilities/resolveAbilityHit';
import { isInAttackArc } from './hitDetection';
import { playLightAttack } from '../audio';
import { BlockController } from './BlockController';
import { Projectile } from './projectile';
import { WitchSkullBarrage } from './WitchSkullBarrage';
import { SHADOW_ATTACK } from '../heroes/abilities/shadow/tunables';
import { spawnShadowSlash, spawnShadowHitBurst } from '../heroes/abilities/shadow/clawFx';
import { emitWorldStrike } from '../match/objectives/worldStrike';

type PendingImpact = {
  at: number;
  step: ComboStep;
};

/**
 * Hold = repeating light swings. Distinct taps within the combo window
 * step 1 → 2, then the chain resets. There is no tap finisher.
 *
 * Stamina is spent when the swing starts. Physical lunge + hit
 * resolve at impact.
 */
export class QuickAttack {
  private nextSwingAt = 0;
  private pendingTaps = 0;
  private lastPendingAt = 0;
  private wasHeld = false;
  private pendingImpact?: PendingImpact;
  private readonly combo = new ComboTracker();
  lastSwingAt = -9999;
  lastSwingStep: ComboStep = 1;
  private deathPairLockUntil = 0;
  /** After Death's first bat, the second swing is forced. Taps cannot skip it. */
  private deathBurstPending = false;
  private ropeArm: -1 | 1 = -1;
  private readonly ropeShots: Projectile[] = [];
  private readonly menderShots: Projectile[] = [];
  private readonly pulseHealed = new WeakMap<Projectile, WeakSet<NinjaBody>>();
  private readonly demonShots: Projectile[] = [];
  private readonly witchBarrages: WitchSkullBarrage[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker?: HitMarker,
  ) {}

  get comboStep(): number {
    return this.combo.step;
  }

  get nextRopeArm(): -1 | 1 {
    return this.ropeArm;
  }

  interrupt(now: number): void {
    this.combo.interrupt(now);
    this.pendingTaps = 0;
    this.pendingImpact = undefined;
    this.deathBurstPending = false;
    this.clearRopeShots();
    this.clearMenderShots();
    this.clearDemonShots();
  }

  destroy(): void {
    this.clearRopeShots();
    this.clearMenderShots();
    this.clearDemonShots();
    this.clearWitchBarrages();
  }

  update(
    now: number,
    held: boolean,
    pressed: boolean,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
    allies: NinjaBody[] = [],
  ): void {
    this.tickRopeShots(now, attacker, enemies, defenderBlock);
    this.tickMenderShots(now, attacker, enemies, allies, defenderBlock);
    this.tickDemonShots(now, attacker, enemies, defenderBlock);
    this.tickWitchBarrage(now, attacker, enemies, defenderBlock);
    this.resolveImpactIfReady(now, attacker, enemies, defenderBlock);

    const tapQueued = this.pendingTaps > 0;
    this.combo.expire(now, COMBAT.comboWindowMs, held || tapQueued || pressed);
    if (
      pressed &&
      attacker.heroId !== 'witch' &&
      attacker.heroId !== 'rope' &&
      attacker.heroId !== 'shadow' &&
      attacker.heroId !== 'mender' &&
      attacker.heroId !== 'demon' &&
      attacker.heroId !== 'death'
    ) {
      this.pendingTaps = Math.min(2, this.pendingTaps + 1);
      this.lastPendingAt = now;
    }
    if (this.pendingTaps > 0 && now - this.lastPendingAt > COMBAT.comboWindowMs) {
      this.pendingTaps = 0;
    }
    if (this.wasHeld && !held) {
      this.combo.holdReleased(now, COMBAT.comboWindowMs);
    }
    this.wasHeld = held;

    this.marker?.setAttacking((held || this.pendingTaps > 0) && attacker.canAttack(now));

    if (this.pendingImpact) {
      return;
    }
    if (attacker.heroId === 'death' && now < this.deathPairLockUntil) {
      this.pendingTaps = 0;
      return;
    }
    const deathFollow = attacker.heroId === 'death' && this.deathBurstPending;
    if (attacker.status.isHitReacting(now)) {
      return;
    }
    if (attacker.status.cannotAttack(now) && !deathFollow) {
      return;
    }
    if ((!held && this.pendingTaps === 0 && !deathFollow) || now < this.nextSwingAt) {
      return;
    }

    const step = deathFollow ? 2 : this.nextComboStep(now, attacker);
    const staminaCost = lightAttackStaminaCost(step, attacker.stats.attackStaminaMul ?? 1);
    if (!deathFollow) {
      if (!attacker.hasAttackStamina(staminaCost, now)) {
        return;
      }
      attacker.trySpendStamina(staminaCost, now);
    } else if (attacker.hasAttackStamina(staminaCost, now)) {
      attacker.trySpendStamina(staminaCost, now);
    }
    const profile = COMBAT.combo[step];
    if (attacker.heroId === 'death') {
      spawnCombatCallout(
        this.scene,
        attacker.x,
        attacker.y,
        step === 2 ? 'HIT 2' : 'HIT 1',
        COLORS.orange,
      );
    } else if (this.pendingTaps > 0) {
      this.combo.tap(now, COMBAT.comboWindowMs);
      this.pendingTaps -= 1;
      if (attacker.heroId !== 'rope' && attacker.heroId !== 'witch' && attacker.heroId !== 'shadow' && attacker.heroId !== 'mender' && attacker.heroId !== 'demon') {
        spawnCombatCallout(
          this.scene,
          attacker.x,
          attacker.y,
          step === 2 ? 'HIT 2' : `HIT ${step}`,
          COLORS.orange,
        );
      }
    } else {
      this.combo.reset();
    }

    const delay = Math.round(
      attacker.stats.attackCooldownMs * COMBAT.attackCooldownMultiplier * attacker.status.attackSlowMultiplier(now),
    );
    this.nextSwingAt = now + delay;
    this.lastSwingAt = now;
    this.lastSwingStep = step;
    playLightAttack(attacker);

    if (attacker.heroId === 'cole') {
      const span = COLE_ATTACK.animMs;
      attacker.status.applySlow(now, span, COLE_ATTACK.lightSlowMul);
      attacker.playCustomAttack(now, span, (frac) => ({
        armLiftLeft: Math.min(1, frac * 1.7),
        armLiftRight: Math.min(1, frac * 1.7),
        swayX: Math.sin(frac * Math.PI) * 3,
      }));
      if (step === 3) {
        spawnShockwaveRing(this.scene, attacker.x, attacker.y, COLE_SHOCKWAVE.radius);
      } else {
        const half = (attacker.stats.attackArcDegrees * Math.PI) / 360;
        spawnLightningArc(this.scene, attacker.x, attacker.y, attacker.aim.x, attacker.aim.y, COLE_ATTACK.range, half);
      }
    } else if (attacker.heroId === 'death') {
      this.playDeathLightSwing(attacker, now, step);
      this.spawnBatSweep(attacker, step);
      if (step === 1) {
        this.deathBurstPending = true;
        this.nextSwingAt = now + DEATH_ATTACK.animMs;
      } else {
        this.deathBurstPending = false;
        this.deathPairLockUntil = now + DEATH_ATTACK.pairDelayMs;
        this.nextSwingAt = this.deathPairLockUntil;
        this.pendingTaps = 0;
        this.combo.reset();
      }
    } else if (attacker.heroId === 'rope') {
      this.fireRopeLight(now, attacker);
    } else if (attacker.heroId === 'mender') {
      this.fireMenderLight(now, attacker);
    } else if (attacker.heroId === 'demon') {
      if (isBigDemon(attacker)) {
        this.playDemonClaw(attacker, now);
      } else {
        this.fireDemonLight(now, attacker);
      }
    } else if (attacker.heroId === 'witch') {
      this.fireWitchLight(now, attacker);
    } else if (attacker.heroId === 'shadow') {
      this.playShadowLight(attacker, now);
    } else {
      attacker.playAttackAnimation(now, step);
      this.spawnWhiteLineSlice(attacker, step);
    }
    if (attacker.heroId !== 'rope' && attacker.heroId !== 'witch' && attacker.heroId !== 'mender' && !(attacker.heroId === 'demon' && !isBigDemon(attacker))) {
      this.pendingImpact = { at: now + profile.impactDelayMs, step };
    }
  }

  private nextComboStep(now: number, attacker: NinjaBody): ComboStep {
    if (attacker.heroId === 'rope' || attacker.heroId === 'witch' || attacker.heroId === 'shadow' || attacker.heroId === 'mender' || attacker.heroId === 'demon') {
      return 1;
    }
    if (attacker.heroId === 'death') {
      return this.deathBurstPending ? 2 : 1;
    }
    if (this.pendingTaps > 0) {
      return comboStepOf(this.combo.preview(now, COMBAT.comboWindowMs));
    }
    return 1;
  }

  private fireRopeLight(now: number, attacker: NinjaBody): void {
    const arm = this.ropeArm;
    this.ropeArm = arm === -1 ? 1 : -1;
    const aim = Math.atan2(attacker.aim.y, attacker.aim.x);
    const origin = ropeArmOrigin(attacker.x, attacker.y, aim, arm, ROPE_SHOT.armReach);
    const spread = (Math.random() - 0.5) * 2 * ROPE_SHOT.spreadRad;
    const shotAngle = aim + arm * ROPE_SHOT.armOffsetRad + spread;
    const sx = Math.cos(shotAngle);
    const sy = Math.sin(shotAngle);
    const shot = new Projectile(
      this.scene,
      origin.x + sx * 4,
      origin.y + sy * 4,
      sx * ROPE_SHOT.speed,
      sy * ROPE_SHOT.speed,
      ROPE_SHOT.radius,
      ROPE_SHOT.lifetimeMs,
      0xc4894a,
      'rope',
    );
    shot.team = attacker.team;
    this.ropeShots.push(shot);
    attacker.playCustomAttack(now, 280, () => ({
      armLiftLeft: arm === -1 ? 0.95 : 0.06,
      armLiftRight: arm === 1 ? 0.95 : 0.06,
      jumpY: 0,
      swayX: 0,
      ropeAction: 'shot' as const,
    }));
  }

  private fireMenderLight(now: number, attacker: NinjaBody): void {
    const arm = this.ropeArm;
    this.ropeArm = arm === -1 ? 1 : -1;
    const aim = Math.atan2(attacker.aim.y, attacker.aim.x);
    const origin = menderArmOrigin(attacker.x, attacker.y, aim, arm, MENDER_PULSE.armReach);
    const spread = (Math.random() - 0.5) * 2 * MENDER_PULSE.spreadRad;
    const shotAngle = aim + arm * MENDER_PULSE.armOffsetRad + spread;
    const sx = Math.cos(shotAngle);
    const sy = Math.sin(shotAngle);
    const shot = new Projectile(
      this.scene,
      origin.x + sx * 4,
      origin.y + sy * 4,
      sx * MENDER_PULSE.speed,
      sy * MENDER_PULSE.speed,
      MENDER_PULSE.radius,
      MENDER_PULSE.lifetimeMs,
      MENDER_PULSE.color,
      'spark',
      Number.POSITIVE_INFINITY,
      undefined,
      attacker.team,
    );
    this.menderShots.push(shot);
    spawnMuzzleFlash(this.scene, origin.x, origin.y, sx, sy);
    attacker.playCustomAttack(now, 160, (frac) => ({
      armLiftLeft: 0.75 + Math.sin(frac * Math.PI) * 0.25,
      armLiftRight: 0.75 + Math.sin(frac * Math.PI) * 0.25,
      swayX: attacker.aim.x * 4 * Math.sin(frac * Math.PI),
    }));
  }

  private tickMenderShots(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    allies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    const dt = this.scene.game.loop.delta / 1000;
    const healTargets = allies.filter(
      (ally) => ally !== attacker && !ally.down && ally.isPresent && ally.stats.role !== 'minion',
    );
    for (let i = this.menderShots.length - 1; i >= 0; i -= 1) {
      const shot = this.menderShots[i];
      const result = shot.update(now, dt, enemies);
      if (result !== 'dead') {
        const pose = shot.pose();
        for (const ally of healTargets) {
          if (Math.hypot(ally.x - pose.x, ally.y - pose.y) <= pose.radius + ally.stats.bodyRadius) {
            this.grantPulseHeal(shot, ally, attacker);
          }
        }
      }
      if (!result) {
        continue;
      }
      this.menderShots.splice(i, 1);
      if (result === 'dead') {
        continue;
      }
      const kind = resolveAbilityHit(
        this.scene,
        now,
        attacker,
        result.target,
        {
          rawDamage: attacker.stats.attackDamage,
          knockback: attacker.stats.knockbackPower * MENDER_PULSE.knockbackMul,
          staminaDamage: MENDER_PULSE.staminaDamage,
          dirX: result.target.x - attacker.x,
          dirY: result.target.y - attacker.y,
          step: 1,
          heavy: false,
          sourceKind: 'light',
        },
        defenderBlock,
      );
      if (kind === 'hit') {
        result.target.status.applySlow(now, MENDER_PULSE.hitSlowMs, MENDER_PULSE.hitSlowMul);
      }
    }
  }

  private grantPulseHeal(shot: Projectile, ally: NinjaBody, healer: NinjaBody): void {
    let seen = this.pulseHealed.get(shot);
    if (!seen) {
      seen = new WeakSet();
      this.pulseHealed.set(shot, seen);
    }
    if (seen.has(ally)) {
      return;
    }
    seen.add(ally);
    ally.heal(MENDER_PULSE.healHealth, healer);
    ally.stamina = Math.min(ally.stats.maxStamina, ally.stamina + MENDER_PULSE.healStamina);
  }

  private clearMenderShots(): void {
    for (const shot of this.menderShots) {
      shot.destroy();
    }
    this.menderShots.length = 0;
  }

  private fireDemonLight(now: number, attacker: NinjaBody): void {
    const aim = Math.atan2(attacker.aim.y, attacker.aim.x);
    const origin = demonCandleOrigin(attacker.x, attacker.y, aim);
    const sx = Math.cos(aim);
    const sy = Math.sin(aim);
    const shot = new Projectile(
      this.scene,
      origin.x + sx * 3,
      origin.y + sy * 3,
      sx * DEMON_ATTACK.speed,
      sy * DEMON_ATTACK.speed,
      DEMON_ATTACK.radius,
      DEMON_ATTACK.lifetimeMs,
      DEMON_ATTACK.color,
      'flame',
      Number.POSITIVE_INFINITY,
      undefined,
      attacker.team,
    );
    this.demonShots.push(shot);
    attacker.playCustomAttack(now, DEMON_ATTACK.animMs, (frac) => ({
      armLiftRight: 0.15 + Math.sin(frac * Math.PI) * 0.85,
      armLiftLeft: 0.08,
      swayX: attacker.aim.x * 3 * Math.sin(frac * Math.PI),
    }));
  }

  private tickDemonShots(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    const dt = this.scene.game.loop.delta / 1000;
    for (let i = this.demonShots.length - 1; i >= 0; i -= 1) {
      const shot = this.demonShots[i];
      const result = shot.update(now, dt, enemies);
      if (!result) {
        continue;
      }
      this.demonShots.splice(i, 1);
      if (result === 'dead') {
        continue;
      }
      const kind = resolveAbilityHit(
        this.scene,
        now,
        attacker,
        result.target,
        {
          rawDamage: attacker.stats.attackDamage,
          knockback: attacker.stats.knockbackPower * DEMON_ATTACK.knockbackMul,
          staminaDamage: DEMON_ATTACK.staminaDamage,
          dirX: result.target.x - attacker.x,
          dirY: result.target.y - attacker.y,
          step: 1,
          heavy: false,
          hitReactionMs: DEMON_ATTACK.hitReactionMs,
          sourceKind: 'light',
        },
        defenderBlock,
      );
      if (kind === 'hit') {
        applyBurn(result.target, now, 'candle', attacker);
        grantDemonRage(attacker, demonRageFromLightDamage(attacker.stats.attackDamage), result.target);
      }
    }
  }

  private clearDemonShots(): void {
    for (const shot of this.demonShots) {
      shot.destroy();
    }
    this.demonShots.length = 0;
  }

  private playDemonClaw(attacker: NinjaBody, now: number): void {
    const len = Math.hypot(attacker.aim.x, attacker.aim.y) || 1;
    const nx = attacker.aim.x / len;
    const ny = attacker.aim.y / len;
    attacker.playCustomAttack(now, DEMON_CLAW.animMs, (frac) => ({
      armLiftRight: frac < 0.4 ? 0.3 + frac * 2 : Math.max(0.18, 1.2 - (frac - 0.4) * 1.8),
      armLiftLeft: 0.2 + Math.sin(frac * Math.PI) * 0.7,
      swayX: nx * (frac < 0.35 ? -4 : 10) * Math.min(1, frac * 1.7),
    }));
    spawnShadowSlash(this.scene, attacker.x, attacker.y, nx, ny, attacker.stats.attackRange, true);
  }

  private resolveDemonClaw(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    step: ComboStep,
    defenderBlock?: BlockController,
  ): void {
    let connected = false;
    for (const defender of enemies) {
      if (defender.down) {
        continue;
      }
      const result = resolveMelee(this.scene, now, attacker, defender, step, defenderBlock, {
        alreadyClashed: connected,
        knockbackMul: DEMON_CLAW.knockbackMul,
      });
      if (result === 'hit') {
        connected = true;
        defender.status.applyHitReaction(now, step, DEMON_CLAW.hitReactionMs);
      }
      if (result === 'blocked' || result === 'perfect-block' || result === 'clash') {
        this.combo.reset();
      }
    }
    if (!connected) {
      attacker.status.applyAttackRecovery(now, COMBAT.combo[step].recoveryMs);
      this.combo.reset();
    }
  }

  private fireWitchLight(now: number, attacker: NinjaBody): void {
    this.witchBarrages.push(new WitchSkullBarrage(this.scene, attacker, now));
  }

  private tickWitchBarrage(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    const dt = this.scene.game.loop.delta / 1000;
    for (let i = this.witchBarrages.length - 1; i >= 0; i -= 1) {
      const keep = this.witchBarrages[i].update(now, dt, attacker, enemies, defenderBlock);
      if (!keep) {
        this.witchBarrages.splice(i, 1);
      }
    }
  }

  private clearWitchBarrages(): void {
    for (const barrage of this.witchBarrages) {
      barrage.destroy();
    }
    this.witchBarrages.length = 0;
  }

  private playShadowLight(attacker: NinjaBody, now: number): void {
    const len = Math.hypot(attacker.aim.x, attacker.aim.y) || 1;
    const nx = attacker.aim.x / len;
    const ny = attacker.aim.y / len;
    attacker.playCustomAttack(now, SHADOW_ATTACK.animMs, (frac) => {
      const wind = frac < 0.18;
      const slash = frac >= 0.36;
      return {
        armLiftRight: wind ? 0.2 : slash ? 0.95 : 0.55,
        armLiftLeft: 0.04,
        swayX: nx * (wind ? -5 : 12) * Math.min(1, frac * 1.8),
      };
    });
    spawnShadowSlash(this.scene, attacker.x, attacker.y, nx, ny, attacker.stats.attackRange);
  }

  private resolveShadowImpact(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    step: ComboStep,
    defenderBlock?: BlockController,
  ): void {
    let connected = false;
    for (const defender of enemies) {
      if (defender.down) {
        continue;
      }
      const result = resolveMelee(this.scene, now, attacker, defender, step, defenderBlock, {
        alreadyClashed: connected,
        knockbackMul: SHADOW_ATTACK.knockbackMul,
      });
      if (result === 'hit') {
        connected = true;
        defender.applyClawMark(now);
        spawnShadowHitBurst(this.scene, defender.x, defender.y - 8);
      }
      if (result === 'blocked' || result === 'perfect-block' || result === 'clash') {
        this.combo.reset();
      }
    }
    if (!connected) {
      attacker.status.applyAttackRecovery(now, COMBAT.combo[step].recoveryMs);
      this.combo.reset();
    }
  }

  private tickRopeShots(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    const dt = this.scene.game.loop.delta / 1000;
    for (let i = this.ropeShots.length - 1; i >= 0; i -= 1) {
      const shot = this.ropeShots[i];
      const result = shot.update(now, dt, enemies);
      if (!result) {
        continue;
      }
      this.ropeShots.splice(i, 1);
      if (result === 'dead') {
        continue;
      }
      const dirX = result.target.x - attacker.x;
      const dirY = result.target.y - attacker.y;
      const kind = resolveAbilityHit(
        this.scene,
        now,
        attacker,
        result.target,
        {
          rawDamage: attacker.stats.attackDamage,
          knockback: attacker.stats.knockbackPower * ROPE_SHOT.knockbackMul,
          staminaDamage: ROPE_SHOT.staminaDamage,
          dirX,
          dirY,
          step: 1,
          heavy: false,
          sourceKind: 'light',
        },
        defenderBlock,
      );
      if (kind === 'hit') {
        result.target.status.applyStackedCripple(
          now,
          ROPE_SHOT.crippleMs,
          ROPE_SHOT.cripplePerHit,
          ROPE_SHOT.crippleCap,
        );
      }
    }
  }

  private clearRopeShots(): void {
    for (const shot of this.ropeShots) {
      shot.destroy();
    }
    this.ropeShots.length = 0;
  }

  private resolveImpactIfReady(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    const pending = this.pendingImpact;
    if (!pending || now < pending.at) {
      return;
    }
    this.pendingImpact = undefined;
    const profile = COMBAT.combo[pending.step];

    if (attacker.down || attacker.status.isHitReacting(now) || attacker.status.isBlockStunned(now) || attacker.status.isClashLocked(now)) {
      this.combo.reset();
      return;
    }

    attacker.applyLungeImpulse(now, pending.step);
    emitWorldStrike({
      attacker,
      now,
      damage: attacker.stats.attackDamage * profile.damageMultiplier,
      reach:
        (attacker.heroId === 'cole' ? COLE_ATTACK.range : attacker.stats.attackRange) + COMBAT.hitForgiveness,
      kind: 'melee',
      dirX: attacker.aim.x,
      dirY: attacker.aim.y,
      impulse: pending.step >= 2 ? 1.35 : 1,
    });

    if (attacker.heroId === 'cole') {
      this.resolveColeImpact(now, attacker, enemies, pending.step, defenderBlock);
      if (pending.step === 3) {
        this.combo.reset();
      }
      return;
    }
    if (attacker.heroId === 'death') {
      this.resolveDeathImpact(now, attacker, enemies, pending.step, defenderBlock);
      if (pending.step === 3) {
        this.combo.reset();
      }
      return;
    }
    if (attacker.heroId === 'shadow') {
      this.resolveShadowImpact(now, attacker, enemies, pending.step, defenderBlock);
      return;
    }
    if (attacker.heroId === 'demon' && isBigDemon(attacker)) {
      this.resolveDemonClaw(now, attacker, enemies, pending.step, defenderBlock);
      return;
    }

    let connected = false;
    for (const defender of enemies) {
      if (defender.down) {
        continue;
      }
      const result = resolveMelee(this.scene, now, attacker, defender, pending.step, defenderBlock, {
        alreadyClashed: connected,
      });
      if (result === 'hit') {
        connected = true;
      }
      if (result === 'blocked' || result === 'perfect-block' || result === 'clash') {
        this.combo.reset();
      }
    }
    if (!connected) {
      attacker.status.applyAttackRecovery(now, profile.recoveryMs);
      this.combo.reset();
    }
    if (pending.step === 3) {
      this.combo.reset();
    }
  }

  private resolveColeImpact(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    step: ComboStep,
    defenderBlock?: BlockController,
  ): void {
    if (step === 3) {
      this.resolveColeShockwave(now, attacker, enemies, defenderBlock);
      return;
    }
    const half = (attacker.stats.attackArcDegrees * Math.PI) / 360;
    let connected = false;
    for (const enemy of enemies) {
      if (enemy.down) {
        continue;
      }
      if (
        !isInAttackArc(
          attacker.x,
          attacker.y,
          attacker.aim.x,
          attacker.aim.y,
          enemy.x,
          enemy.y,
          COLE_ATTACK.range + COMBAT.hitForgiveness,
          half,
          enemy.stats.bodyRadius,
        )
      ) {
        continue;
      }
      const kind = resolveMelee(this.scene, now, attacker, enemy, step, defenderBlock, {
        alreadyClashed: connected,
        knockbackMul: COLE_ATTACK.knockbackMul,
        launchCap: COLE_ATTACK.launchCap,
      });
      if (kind === 'hit') {
        enemy.status.applySlow(now, COLE_ATTACK.targetSlowMs, COLE_ATTACK.targetSlowMul);
        connected = true;
      }
    }
    if (!connected) {
      attacker.status.applyAttackRecovery(now, COMBAT.combo[step].recoveryMs);
      this.combo.reset();
    }
  }

  private resolveColeShockwave(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    let connected = false;
    for (const enemy of enemies) {
      if (enemy.down) {
        continue;
      }
      const dist = Math.hypot(enemy.x - attacker.x, enemy.y - attacker.y);
      if (dist > COLE_SHOCKWAVE.radius + enemy.stats.bodyRadius) {
        continue;
      }
      const t = Math.min(1, dist / COLE_SHOCKWAVE.radius);
      const knockback = COLE_SHOCKWAVE.knockbackNear + (COLE_SHOCKWAVE.knockbackFar - COLE_SHOCKWAVE.knockbackNear) * t;
      const kind = resolveAbilityHit(
        this.scene,
        now,
        attacker,
        enemy,
        {
          rawDamage: attacker.stats.attackDamage * COMBAT.combo[3].damageMultiplier,
          knockback,
          staminaDamage: COMBAT.combo[3].staminaDamage,
          dirX: enemy.x - attacker.x || attacker.aim.x,
          dirY: enemy.y - attacker.y || attacker.aim.y,
          step: 3,
          heavy: true,
          sourceKind: 'light',
        },
        defenderBlock,
      );
      if (kind === 'hit') {
        connected = true;
      }
    }
    if (!connected) {
      attacker.status.applyAttackRecovery(now, COMBAT.combo[3].recoveryMs);
      this.combo.reset();
    }
  }

  private resolveDeathImpact(
    now: number,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    step: ComboStep,
    defenderBlock?: BlockController,
  ): void {
    const kb = sweepKnockback(attacker.aim.x, attacker.aim.y, swingSignFor(step));
    const rangeMul = step === 3 ? DEATH_ATTACK.hit3RangeMul : 1;
    const damageMul = step === 3 ? DEATH_ATTACK.hit3DamageMul : step === 2 ? 1.05 : 1;
    const knockbackMul = step === 3 ? DEATH_ATTACK.hit3KnockbackMul : DEATH_ATTACK.hit12KnockbackMul;
    let connected = false;
    for (const enemy of enemies) {
      if (enemy.down) {
        continue;
      }
      const kind = resolveMelee(this.scene, now, attacker, enemy, step === 3 ? 3 : 1, defenderBlock, {
        alreadyClashed: connected,
        knockbackMul,
        damageMul,
        dirX: kb.x,
        dirY: kb.y,
        rangeMul,
      });
      if (kind === 'hit') {
        connected = true;
      }
    }
    if (!connected) {
      attacker.status.applyAttackRecovery(now, COMBAT.combo[step].recoveryMs);
      this.combo.reset();
    }
  }

  private playDeathLightSwing(death: NinjaBody, now: number, step: ComboStep): void {
    const aimAngle = Math.atan2(death.aim.y, death.aim.x);
    const idle = deathIdleBatAngle(facingFromAim(death.aim.x, death.aim.y));
    const sign = swingSignFor(step);
    const half = attackHalfFor(step) * (step === 3 ? DEATH_ATTACK.hit3RangeMul : 1);
    const start = aimAngle - (half + DEATH_ATTACK.lightWindupRad) * sign;
    const end = aimAngle + (half + DEATH_ATTACK.lightFollowRad) * sign;
    const span = step === 3 ? DEATH_ATTACK.finisherAnimMs : DEATH_ATTACK.animMs;
    const scale = step === 3 ? DEATH_ATTACK.lightFinisherBatScale : DEATH_ATTACK.lightBatScale;
    death.playCustomAttack(
      now,
      span,
      (frac) => {
        let swingT = frac;
        if (frac < 0.2) {
          swingT = (frac / 0.2) * 0.14;
        } else if (frac < 0.7) {
          swingT = 0.14 + ((frac - 0.2) / 0.5) * 0.74;
        } else {
          swingT = 0.88 + ((frac - 0.7) / 0.3) * 0.12;
        }
        const angle = start + (end - start) * swingT;
        return {
          swordAngleOffset: angle - idle,
          batScale: scale,
          armLiftRight: frac < 0.26 ? (frac / 0.26) * 0.5 : Math.max(0.08, 0.5 - (frac - 0.26) * 0.45),
          swayX: Math.sin(Math.min(1, frac * 1.2) * Math.PI) * (death.aim.x >= 0 ? 4 : -4),
        };
      },
      'Linear',
    );
  }

  private spawnBatSweep(death: NinjaBody, step: ComboStep): void {
    const graphics = this.scene.add.graphics().setDepth(20);
    const aimAngle = Math.atan2(death.aim.y, death.aim.x);
    const sign = swingSignFor(step);
    const half = attackHalfFor(step) * (step === 3 ? DEATH_ATTACK.hit3RangeMul : 1);
    const startAngle = aimAngle - half * sign;
    const totalArc = half * 2 * sign;
    const radius = death.stats.attackRange * (step === 3 ? DEATH_ATTACK.hit3RangeMul : 1);
    const duration = step === 3 ? 240 : 150;
    const anim = { sweepProgress: 0, alpha: 1 };
    graphics.setPosition(death.x, death.y);
    this.scene.tweens.add({
      targets: anim,
      sweepProgress: 1,
      duration: duration * 0.55,
      ease: 'Cubic.Out',
      onUpdate: () => {
        graphics.clear();
        graphics.setPosition(death.x, death.y);
        const currentEnd = startAngle + totalArc * anim.sweepProgress;
        const a0 = sign >= 0 ? startAngle : currentEnd;
        const a1 = sign >= 0 ? currentEnd : startAngle;
        graphics.lineStyle(step === 3 ? 14 : 9, 0x3a2410, 0.4 * anim.alpha);
        graphics.beginPath();
        graphics.arc(0, 0, radius, a0, a1);
        graphics.strokePath();
        graphics.lineStyle(step === 3 ? 6 : 4, 0xc68654, 0.95 * anim.alpha);
        graphics.beginPath();
        graphics.arc(0, 0, radius, a0, a1);
        graphics.strokePath();
        if (step === 3) {
          graphics.lineStyle(2, COLORS.paper, 0.7 * anim.alpha);
          graphics.beginPath();
          graphics.arc(0, 0, radius - 8, a0, a1);
          graphics.strokePath();
        }
      },
    });
    this.scene.tweens.add({
      targets: anim,
      alpha: 0,
      delay: duration * 0.45,
      duration: duration * 0.55,
      ease: 'Quad.In',
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * White line slice grows with combo step so the finisher reads as a bigger cut.
   */
  private spawnWhiteLineSlice(ninja: NinjaBody, step: ComboStep): void {
    const graphics = this.scene.add.graphics().setDepth(20);
    const originX = ninja.x;
    const originY = ninja.y;
    const aimAngle = Math.atan2(ninja.aim.y, ninja.aim.x);
    const half = attackHalfFor(step);
    const startAngle = aimAngle - half;
    const totalArc = half * 2;
    const radius = ninja.stats.attackRange * (0.82 + step * 0.08);
    const duration = 160 + step * 44;
    const rivalTint = ninja.rival;

    const anim = { sweepProgress: 0, alpha: 1 };
    graphics.setPosition(originX, originY);

    this.scene.tweens.add({
      targets: anim,
      sweepProgress: 1,
      duration: duration * 0.5,
      ease: 'Cubic.Out',
      onUpdate: () => {
        graphics.clear();
        const currentEndAngle = startAngle + totalArc * anim.sweepProgress;
        const trailStartAngle = Math.max(startAngle, currentEndAngle - totalArc * 0.75);
        const glow = step === 1 ? 6 : step === 2 ? 9 : 13;
        const core = step === 1 ? 3 : step === 2 ? 4 : 6;
        const color = rivalTint ? 0xffe0c8 : 0xffffff;

        graphics.lineStyle(glow, color, 0.45 * anim.alpha);
        graphics.beginPath();
        graphics.arc(0, 0, radius, trailStartAngle, currentEndAngle);
        graphics.strokePath();

        graphics.lineStyle(core, color, 1 * anim.alpha);
        graphics.beginPath();
        graphics.arc(0, 0, radius, trailStartAngle, currentEndAngle);
        graphics.strokePath();

        if (step >= 2) {
          graphics.lineStyle(step === 3 ? 3 : 2, color, 0.9 * anim.alpha);
          graphics.beginPath();
          graphics.arc(0, 0, radius - 6, trailStartAngle, currentEndAngle);
          graphics.strokePath();
        }
        if (step === 3) {
          graphics.lineStyle(2, color, 0.85 * anim.alpha);
          graphics.beginPath();
          graphics.arc(0, 0, radius - 12, trailStartAngle, currentEndAngle);
          graphics.strokePath();
        }

        const tipX = Math.cos(currentEndAngle) * radius;
        const tipY = Math.sin(currentEndAngle) * radius;
        graphics.fillStyle(color, 1 * anim.alpha);
        graphics.fillCircle(tipX, tipY, 2 + step);
      },
    });

    this.scene.tweens.add({
      targets: anim,
      alpha: 0,
      delay: duration * 0.45,
      duration: duration * 0.55,
      ease: 'Quad.In',
      onComplete: () => {
        graphics.destroy();
      },
    });
  }
}

const attackHalfFor = (step: ComboStep): number => {
  const base = (COMBAT.attackArcDegrees * Math.PI) / 360;
  if (step === 3) {
    return base * 1.3;
  }
  if (step === 2) {
    return base * 1.15;
  }
  return base;
};
