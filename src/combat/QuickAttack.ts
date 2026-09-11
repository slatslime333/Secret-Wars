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
 */
export class QuickAttack {
  private nextSwingAt = 0;
  private pendingTaps = 0;
  private lastPendingAt = 0;
  private wasHeld = false;
  private slash?: Phaser.GameObjects.Graphics;
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
    this.flashSlash(ninja, finisher);
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

  private flashSlash(ninja: NinjaBody, finisher: boolean): void {
    this.slash?.destroy();
    const graphics = this.scene.add.graphics().setDepth(13);
    const angle = Math.atan2(ninja.aim.y, ninja.aim.x);
    const half = finisher ? attackHalfArcRad * 1.25 : attackHalfArcRad;
    graphics.setPosition(ninja.x, ninja.y);
    graphics.lineStyle(finisher ? 10 : 6, finisher ? COLORS.yellow : COLORS.paper, 0.95);
    graphics.beginPath();
    graphics.arc(0, 0, NINJA.attackRange * (finisher ? 0.95 : 0.82), angle - half, angle + half);
    graphics.strokePath();
    graphics.lineStyle(finisher ? 5 : 3, COLORS.orange, 1);
    graphics.beginPath();
    graphics.arc(0, 0, NINJA.attackRange * (finisher ? 0.8 : 0.7), angle - half, angle + half);
    graphics.strokePath();
    this.slash = graphics;
    this.scene.time.delayedCall(finisher ? 180 : 140, () => {
      graphics.destroy();
      if (this.slash === graphics) {
        this.slash = undefined;
      }
    });
  }
}
