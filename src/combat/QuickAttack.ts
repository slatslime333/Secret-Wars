import Phaser from 'phaser';
import { COMBAT, ComboStep, comboStepOf } from '../config/combat';
import { COLE_ATTACK, COLE_SHOCKWAVE } from '../heroes/abilities/cole/tunables';
import { ComboTracker } from './ComboTracker';
import { HitMarker } from './HitMarker';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';
import { spawnCombatCallout } from '../effects/combatCallout';
import { spawnLightningArc, spawnShockwaveRing } from '../effects/lightning';
import { resolveMelee } from './resolveMelee';
import { resolveAbilityHit } from '../heroes/abilities/resolveAbilityHit';
import { isInAttackArc } from './hitDetection';
import { BlockController } from './BlockController';

type PendingImpact = {
  at: number;
  step: ComboStep;
};

/**
 * Hold = repeating light swings. Distinct taps within the combo window
 * step 1 → 2 → finisher. The third hit is the only heavier attack.
 *
 * Ammo is spent when the swing starts. Physical lunge + hit resolve at impact.
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker?: HitMarker,
  ) {}

  get comboStep(): number {
    return this.combo.step;
  }

  interrupt(now: number): void {
    this.combo.interrupt(now);
    this.pendingTaps = 0;
    this.pendingImpact = undefined;
  }

  update(
    now: number,
    held: boolean,
    pressed: boolean,
    attacker: NinjaBody,
    enemies: NinjaBody[],
    defenderBlock?: BlockController,
  ): void {
    attacker.tickAmmo(now);
    this.resolveImpactIfReady(now, attacker, enemies, defenderBlock);

    const tapQueued = this.pendingTaps > 0;
    this.combo.expire(now, COMBAT.comboWindowMs, held || tapQueued || pressed);
    if (pressed) {
      this.pendingTaps = Math.min(3, this.pendingTaps + 1);
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
    if (attacker.status.cannotAttack(now) || attacker.status.isHitReacting(now)) {
      return;
    }
    if ((!held && this.pendingTaps === 0) || now < this.nextSwingAt) {
      return;
    }
    if (!attacker.trySpendAmmo(now)) {
      return;
    }

    const step = comboStepOf(this.pendingTaps > 0 ? this.combo.preview(now, COMBAT.comboWindowMs) : 1);
    const profile = COMBAT.combo[step];
    if (this.pendingTaps > 0) {
      this.combo.tap(now, COMBAT.comboWindowMs);
      this.pendingTaps -= 1;
      spawnCombatCallout(
        this.scene,
        attacker.x,
        attacker.y,
        step === 3 ? 'FINISHER' : `HIT ${step}`,
        step === 3 ? COLORS.yellow : COLORS.orange,
      );
    } else {
      this.combo.reset();
    }

    const delay = Math.round(
      attacker.stats.attackCooldownMs * COMBAT.attackCooldownMultiplier * attacker.status.attackSlowMultiplier(now),
    );
    this.nextSwingAt = now + delay;
    this.lastSwingAt = now;
    this.lastSwingStep = step;

    if (attacker.heroId === 'cole') {
      const span = attacker.heroId === 'cole' ? COLE_ATTACK.animMs : 220;
      attacker.status.applySlow(now, span, COLE_ATTACK.lightSlowMul);
      attacker.playCustomAttack(now, span, (frac) => ({
        armLiftLeft: frac < 0.55 ? Math.sin(frac * Math.PI) : 0.15,
        armLiftRight: frac >= 0.35 ? Math.sin((frac - 0.2) * Math.PI) : 0,
        swayX: Math.sin(frac * Math.PI * 2) * 5,
      }));
      if (step === 3) {
        spawnShockwaveRing(this.scene, attacker.x, attacker.y, COLE_SHOCKWAVE.radius);
      } else {
        const half = (attacker.stats.attackArcDegrees * Math.PI) / 360;
        spawnLightningArc(this.scene, attacker.x, attacker.y, attacker.aim.x, attacker.aim.y, attacker.stats.attackRange, half);
      }
    } else {
      attacker.playAttackAnimation(now, step);
      this.spawnWhiteLineSlice(attacker, step);
    }
    this.pendingImpact = { at: now + profile.impactDelayMs, step };
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

    if (attacker.heroId === 'cole') {
      this.resolveColeImpact(now, attacker, enemies, pending.step, defenderBlock);
      if (pending.step === 3) {
        this.combo.reset();
      }
      return;
    }

    const defender = enemies[0];
    if (!defender || defender.down) {
      attacker.status.applyAttackRecovery(now, profile.recoveryMs);
      this.combo.reset();
      return;
    }

    const result = resolveMelee(this.scene, now, attacker, defender, pending.step, defenderBlock);
    if (result === 'whiff' || result === 'blocked' || result === 'perfect-block' || result === 'clash') {
      this.combo.reset();
    }
    if (result === 'whiff') {
      attacker.status.applyAttackRecovery(now, profile.recoveryMs);
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
          attacker.stats.attackRange + COMBAT.hitForgiveness,
          half,
          enemy.stats.bodyRadius,
        )
      ) {
        continue;
      }
      const kind = resolveMelee(this.scene, now, attacker, enemy, step, defenderBlock, { alreadyClashed: connected });
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
