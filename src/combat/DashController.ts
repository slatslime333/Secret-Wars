import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { NINJA } from '../config/ninja';
import { spawnCombatCallout } from '../effects/combatCallout';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

const dashSpeed = (): number => COMBAT.dashDistance / (COMBAT.dashDurationMs / 1000);

/** Short leap in move direction, or facing if standing still. 4s cooldown. */
export class DashController {
  private activeUntil = 0;
  private readyAt = 0;
  private readonly dir = new Phaser.Math.Vector2(1, 0);

  constructor(private readonly scene: Phaser.Scene) {}

  tryStart(now: number, move: Phaser.Math.Vector2, aim: Phaser.Math.Vector2, ninja: NinjaBody): boolean {
    if (now < this.readyAt || this.isActive(now)) {
      return false;
    }
    if (!ninja.trySpendStamina(COMBAT.dashStaminaCost, now)) {
      return false;
    }
    if (move.lengthSq() > 0.04) {
      this.dir.copy(move).normalize();
    } else {
      this.dir.copy(aim).normalize();
    }
    this.activeUntil = now + COMBAT.dashDurationMs;
    this.readyAt = now + COMBAT.dashCooldownMs;
    ninja.setSpeedCap(dashSpeed());
    this.spawnStreaks(ninja);
    spawnCombatCallout(this.scene, ninja.x, ninja.y, 'DASH', COLORS.orange);
    return true;
  }

  isActive(now: number): boolean {
    return now < this.activeUntil;
  }

  cooldownRatio(now: number): number {
    if (now >= this.readyAt) {
      return 0;
    }
    return (this.readyAt - now) / COMBAT.dashCooldownMs;
  }

  apply(now: number, ninja: NinjaBody): void {
    if (!this.isActive(now)) {
      ninja.setSpeedCap(NINJA.moveSpeed);
      return;
    }
    const speed = dashSpeed();
    ninja.body.setVelocity(this.dir.x * speed, this.dir.y * speed);
  }

  private spawnStreaks(ninja: NinjaBody): void {
    for (let i = 0; i < 3; i += 1) {
      const streak = this.scene.add.rectangle(
        ninja.x - this.dir.x * (12 + i * 10),
        ninja.y - this.dir.y * (12 + i * 10),
        10,
        4,
        COLORS.paper,
        0.7 - i * 0.18,
      );
      streak.setRotation(Math.atan2(this.dir.y, this.dir.x)).setDepth(9);
      this.scene.tweens.add({
        targets: streak,
        alpha: 0,
        duration: 160 + i * 40,
        ease: 'Stepped',
        easeParams: [4],
        onComplete: () => streak.destroy(),
      });
    }
  }
}
