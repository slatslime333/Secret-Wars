import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { spawnCombatCallout } from '../effects/combatCallout';
import { NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';
import { RopeSlingDash } from './RopeSlingDash';

const dashSpeed = (): number => COMBAT.dashDistance / (COMBAT.dashDurationMs / 1000);

/**
 * Short leap in move direction, or facing if standing still.
 * Hero-specific charge count; each spend recharges on a 1.5s timer.
 */
export class DashController {
  private activeUntil = 0;
  private charges: number;
  private rechargeAt = 0;
  private readonly dir = new Phaser.Math.Vector2(1, 0);
  private readonly chargeCap: number;
  private sling?: RopeSlingDash;

  constructor(private readonly scene: Phaser.Scene, maxCharges: number = COMBAT.dashMaxCharges) {
    this.chargeCap = maxCharges;
    this.charges = maxCharges;
  }

  get chargeCount(): number {
    return this.charges;
  }

  get maxCharges(): number {
    return this.chargeCap;
  }

  get direction(): Phaser.Math.Vector2 {
    return this.dir;
  }

  tryStart(now: number, move: Phaser.Math.Vector2, aim: Phaser.Math.Vector2, ninja: NinjaBody): boolean {
    this.tickRecharge(now);
    if (this.charges <= 0 || this.isActive(now) || ninja.status.isBlockStunned(now)) {
      return false;
    }
    if (move.lengthSq() > 0.04) {
      this.dir.copy(move).normalize();
    } else {
      this.dir.copy(aim).normalize();
    }
    this.charges -= 1;
    if (this.rechargeAt <= now) {
      this.rechargeAt = now + COMBAT.dashRechargeMs;
    }
    if (ninja.heroId === 'rope') {
      this.sling?.destroy();
      this.sling = new RopeSlingDash(this.scene, ninja, this.dir);
      this.sling.begin(now);
      this.activeUntil = now + this.sling.durationMs;
      ninja.grantInvulnerable(now + this.sling.durationMs);
      spawnCombatCallout(this.scene, ninja.x, ninja.y, 'DASH', COLORS.orange);
      return true;
    }
    this.activeUntil = now + COMBAT.dashDurationMs;
    ninja.setSpeedCap(dashSpeed());
    ninja.grantInvulnerable(now + COMBAT.dashDurationMs);
    this.spawnStreaks(ninja);
    spawnCombatCallout(this.scene, ninja.x, ninja.y, 'DASH', COLORS.orange);
    return true;
  }

  isActive(now: number): boolean {
    if (this.sling) {
      return this.sling.isActive(now);
    }
    return now < this.activeUntil;
  }

  cancel(ninja: NinjaBody): void {
    this.sling?.destroy();
    this.sling = undefined;
    if (this.activeUntil <= 0) {
      return;
    }
    this.activeUntil = 0;
    ninja.setSpeedCap(COMBAT.physicsMaxSpeed);
  }

  tickRecharge(now: number): void {
    while (this.charges < this.chargeCap && this.rechargeAt > 0 && now >= this.rechargeAt) {
      this.charges += 1;
      if (this.charges < this.chargeCap) {
        this.rechargeAt += COMBAT.dashRechargeMs;
      } else {
        this.rechargeAt = 0;
      }
    }
  }

  /** 1 = just spent / empty fill, 0 = next charge ready or full. */
  rechargeRatio(now: number): number {
    this.tickRecharge(now);
    if (this.charges >= this.chargeCap || this.rechargeAt <= 0) {
      return 0;
    }
    const remaining = this.rechargeAt - now;
    return Phaser.Math.Clamp(remaining / COMBAT.dashRechargeMs, 0, 1);
  }

  apply(now: number, ninja: NinjaBody): void {
    this.tickRecharge(now);
    if (this.sling) {
      if (!this.sling.isActive(now) || ninja.down) {
        this.sling.destroy();
        this.sling = undefined;
        this.activeUntil = 0;
        if (!ninja.status.shouldLockMovement(now)) {
          ninja.setSpeedCap(COMBAT.physicsMaxSpeed);
        }
        return;
      }
      this.sling.apply(now, ninja);
      return;
    }
    if (!this.isActive(now)) {
      if (!ninja.status.shouldLockMovement(now)) {
        ninja.setSpeedCap(COMBAT.physicsMaxSpeed);
      }
      return;
    }
    const speed = dashSpeed();
    ninja.body?.setDrag(0, 0);
    ninja.body?.setVelocity(this.dir.x * speed, this.dir.y * speed);
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
