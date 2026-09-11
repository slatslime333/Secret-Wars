import Phaser from 'phaser';
import { attackHalfArcRad, COMBAT } from '../config/combat';
import { NINJA } from '../config/ninja';
import { applyDefense } from './damage';
import { HitMarker } from './HitMarker';
import { isInAttackArc } from './hitDetection';
import { spawnHitSpark } from '../effects/hitSpark';
import { DummyTarget } from '../heroes/DummyTarget';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

/**
 * Hold-to-swing quick attacks. Same light hit each pulse.
 * Phase 3 adds the three-tap finisher on top of this cadence.
 */
export class QuickAttack {
  private nextSwingAt = 0;
  private slash?: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker: HitMarker,
  ) {}

  update(now: number, held: boolean, ninja: NinjaBody, dummy: DummyTarget): void {
    this.marker.setAttacking(held && ninja.stamina >= COMBAT.attackStaminaCost);
    if (!held || now < this.nextSwingAt) {
      return;
    }
    if (!ninja.trySpendStamina(COMBAT.attackStaminaCost, now)) {
      return;
    }

    this.nextSwingAt = now + NINJA.attackCooldownMs;
    this.flashSlash(ninja);
    this.tryHit(ninja, dummy);
  }

  private tryHit(ninja: NinjaBody, dummy: DummyTarget): void {
    const connected = isInAttackArc(
      ninja.x,
      ninja.y,
      ninja.aim.x,
      ninja.aim.y,
      dummy.x,
      dummy.y,
      NINJA.attackRange,
      attackHalfArcRad,
      COMBAT.dummyRadius,
    );
    if (!connected) {
      return;
    }

    const damage = applyDefense(NINJA.attackDamage, NINJA.defense);
    dummy.takeHit(damage, ninja.aim.x, ninja.aim.y);
    spawnHitSpark(
      this.scene,
      dummy.x + ninja.aim.x * 12,
      dummy.y + ninja.aim.y * 12,
    );
    this.scene.cameras.main.shake(90, 0.008);
  }

  private flashSlash(ninja: NinjaBody): void {
    this.slash?.destroy();
    const graphics = this.scene.add.graphics().setDepth(13);
    const angle = Math.atan2(ninja.aim.y, ninja.aim.x);
    graphics.setPosition(ninja.x, ninja.y);
    graphics.lineStyle(6, COLORS.paper, 0.95);
    graphics.beginPath();
    graphics.arc(0, 0, NINJA.attackRange * 0.82, angle - attackHalfArcRad, angle + attackHalfArcRad);
    graphics.strokePath();
    graphics.lineStyle(3, COLORS.orange, 1);
    graphics.beginPath();
    graphics.arc(0, 0, NINJA.attackRange * 0.7, angle - attackHalfArcRad, angle + attackHalfArcRad);
    graphics.strokePath();
    this.slash = graphics;
    this.scene.time.delayedCall(140, () => {
      graphics.destroy();
      if (this.slash === graphics) {
        this.slash = undefined;
      }
    });
  }
}
