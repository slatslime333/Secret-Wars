import Phaser from 'phaser';
import { attackHalfArcRad, COMBAT } from '../config/combat';
import { CHASER } from '../config/chaser';
import { NINJA } from '../config/ninja';
import { applyDefense } from './damage';
import { ComboTracker } from './ComboTracker';
import { HitMarker } from './HitMarker';
import { isInAttackArc } from './hitDetection';
import { spawnCombatCallout } from '../effects/combatCallout';
import { playHitJuice } from '../effects/hitJuice';
import { spawnHitSpark } from '../effects/hitSpark';
import { Hurtbox } from './Hurtbox';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

/**
 * Hold = repeating light swings. Distinct taps within the combo window
 * step 1 → 2 → finisher. The third hit is the only heavier attack.
 *
 * Ninja performs a physical forward lunge/swipe in the attack direction with his
 * sword, accompanied by a clean razor-sharp white line slice animation tracing the arc.
 */
export class QuickAttack {
  private nextSwingAt = 0;
  private pendingTaps = 0;
  private lastPendingAt = 0;
  private wasHeld = false;
  private readonly combo = new ComboTracker();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker: HitMarker,
  ) {}

  get comboStep(): number {
    return this.combo.step;
  }

  update(
    now: number,
    held: boolean,
    pressed: boolean,
    ninja: NinjaBody,
    dummy: Hurtbox,
  ): void {
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

    this.marker.setAttacking((held || this.pendingTaps > 0) && ninja.stamina >= COMBAT.attackStaminaCost);
    if ((!held && this.pendingTaps === 0) || now < this.nextSwingAt) {
      return;
    }

    const step = this.pendingTaps > 0 ? this.combo.preview(now, COMBAT.comboWindowMs) : 1;
    const finisher = step === 3;
    const staminaCost = finisher
      ? Math.round(COMBAT.attackStaminaCost * COMBAT.comboFinisherStaminaMultiplier)
      : COMBAT.attackStaminaCost;
    if (!ninja.trySpendStamina(staminaCost, now)) {
      return;
    }
    if (this.pendingTaps > 0) {
      this.combo.tap(now, COMBAT.comboWindowMs);
      this.pendingTaps -= 1;
      spawnCombatCallout(
        this.scene,
        ninja.x,
        ninja.y,
        finisher ? 'FINISHER' : `HIT ${this.combo.step}`,
        finisher ? COLORS.yellow : COLORS.orange,
      );
    }

    this.nextSwingAt = now + NINJA.attackCooldownMs;

    // Physical player model lunge and sword swing animation
    ninja.playAttackAnimation(now, finisher);

    // White line slice animation tracing the blade arc in attack direction
    this.spawnWhiteLineSlice(ninja, finisher);

    this.tryHit(ninja, dummy, finisher);
    if (finisher) {
      this.combo.reset();
    }
  }

  private tryHit(ninja: NinjaBody, dummy: Hurtbox, finisher: boolean): void {
    if (dummy.down) {
      return;
    }
    const connected = isInAttackArc(
      ninja.x,
      ninja.y,
      ninja.aim.x,
      ninja.aim.y,
      dummy.x,
      dummy.y,
      NINJA.attackRange + COMBAT.hitForgiveness,
      attackHalfArcRad,
      CHASER.bodyRadius,
    );
    if (!connected) {
      return;
    }

    const raw = finisher
      ? NINJA.attackDamage * COMBAT.comboFinisherDamageMultiplier
      : NINJA.attackDamage;
    const damage = applyDefense(raw, CHASER.defense);
    const knockback =
      NINJA.knockbackPower * (finisher ? COMBAT.comboFinisherKnockbackMultiplier : 1);
    dummy.takeHit(damage, ninja.aim.x, ninja.aim.y, knockback);
    spawnHitSpark(
      this.scene,
      dummy.x + ninja.aim.x * 12,
      dummy.y + ninja.aim.y * 12,
    );
    playHitJuice(this.scene, dummy.x, dummy.y, { damage, finisher });
  }

  /**
   * Spawns a crisp, high-impact white line slice arc in the aimed direction,
   * sweeping across the hit cone as Ninja swings his sword.
   */
  private spawnWhiteLineSlice(ninja: NinjaBody, finisher: boolean): void {
    const graphics = this.scene.add.graphics().setDepth(20);
    const originX = ninja.x;
    const originY = ninja.y;
    const aimAngle = Math.atan2(ninja.aim.y, ninja.aim.x);
    const half = finisher ? attackHalfArcRad * 1.3 : attackHalfArcRad * 1.1;
    const startAngle = aimAngle - half;
    const totalArc = half * 2;
    const radius = NINJA.attackRange * (finisher ? 1.05 : 0.95);
    const duration = finisher ? 220 : 180;

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

        // Broad white glow arc
        graphics.lineStyle(finisher ? 12 : 8, 0xffffff, 0.55 * anim.alpha);
        graphics.beginPath();
        graphics.arc(0, 0, radius, trailStartAngle, currentEndAngle);
        graphics.strokePath();

        // Thick vivid pure white line slice
        graphics.lineStyle(finisher ? 6 : 4, 0xffffff, 1 * anim.alpha);
        graphics.beginPath();
        graphics.arc(0, 0, radius, trailStartAngle, currentEndAngle);
        graphics.strokePath();

        // Second inner parallel white slash line for comic energy feel
        graphics.lineStyle(finisher ? 3 : 2, 0xffffff, 0.9 * anim.alpha);
        graphics.beginPath();
        graphics.arc(0, 0, radius - 6, trailStartAngle, currentEndAngle);
        graphics.strokePath();

        // Third inner white slash line for finisher
        if (finisher) {
          graphics.lineStyle(2, 0xffffff, 0.85 * anim.alpha);
          graphics.beginPath();
          graphics.arc(0, 0, radius - 12, trailStartAngle, currentEndAngle);
          graphics.strokePath();
        }

        // White slash spark tip at leading edge
        const tipX = Math.cos(currentEndAngle) * radius;
        const tipY = Math.sin(currentEndAngle) * radius;
        graphics.fillStyle(0xffffff, 1 * anim.alpha);
        graphics.fillCircle(tipX, tipY, finisher ? 5 : 3.5);
      },
    });

    // Fade out and clean up
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
