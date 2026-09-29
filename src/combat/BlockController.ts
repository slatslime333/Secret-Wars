import Phaser from 'phaser';
import { audio } from '../audio';
import { COMBAT } from '../config/combat';
import { spawnCombatCallout } from '../effects/combatCallout';
import { forEachLiveFighter, NinjaBody } from '../heroes/NinjaBody';
import { COLORS } from '../ui/theme';

export type BlockAbsorbResult = {
  absorbed: boolean;
  perfect: boolean;
};

type BlastPush = {
  body: NinjaBody;
  dirX: number;
  dirY: number;
  power: number;
};

/**
 * Hold-to-block shield. The ring covers every direction around the fighter.
 * Holding and blocked hits drain shield HP, not stamina.
 * Walking remains allowed while the shield is up.
 * Breaking the shield shoves nearby enemies, then waits out a cooldown.
 */
export class BlockController {
  private holding = false;
  private raisedAt = -9999;
  private drainAcc = 0;
  private lastBlastAt = -Infinity;
  private readonly shield: Phaser.GameObjects.Graphics;
  private drawn = false;
  private lastPerfect = false;

  constructor(scene: Phaser.Scene) {
    this.shield = scene.add.graphics().setDepth(11);
  }

  setHeld(now: number, ninja: NinjaBody, held: boolean): void {
    if (!held || ninja.down || ninja.status.isBlockStunned(now)) {
      this.drop(ninja);
      return;
    }
    if (!ninja.canRaiseBlock()) {
      this.drop(ninja);
      return;
    }
    if (!this.holding) {
      this.holding = true;
      this.raisedAt = now;
      this.drainAcc = 0;
      ninja.blocking = true;
      spawnCombatCallout(this.shield.scene, ninja.x, ninja.y, 'SHIELD', COLORS.cyan);
    }
  }

  tick(deltaMs: number, now: number, ninja: NinjaBody): void {
    if (!this.holding) {
      ninja.blocking = false;
      return;
    }
    if (ninja.down || ninja.status.isBlockStunned(now)) {
      this.drop(ninja);
      return;
    }
    this.drainAcc += COMBAT.blockDrainPerSecond * (deltaMs / 1000);
    const spent = Math.floor(this.drainAcc);
    if (spent > 0) {
      this.drainAcc -= spent;
      ninja.drainBlockShield(spent, now);
    }
    if (!ninja.canRaiseBlock()) {
      this.breakShield(ninja);
    }
  }

  isActive(now?: number): boolean {
    return this.holding && (now === undefined || now >= 0);
  }

  isPerfect(now: number): boolean {
    return this.holding && now - this.raisedAt <= COMBAT.perfectShieldWindowMs;
  }

  /** True when the held shield is up. Coverage is a full circle, so facing is ignored. */
  tryAbsorb(now: number, ninja: NinjaBody, fromX: number, fromY: number): BlockAbsorbResult {
    if (!this.holding || ninja.blockShield <= 0) {
      return { absorbed: false, perfect: false };
    }
    void fromX;
    void fromY;
    return { absorbed: true, perfect: this.isPerfect(now) };
  }

  breakShield(ninja: NinjaBody): void {
    if (!this.holding && !ninja.blocking) {
      return;
    }
    spawnCombatCallout(this.shield.scene, ninja.x, ninja.y, 'SHIELD BREAK', COLORS.orange);
    this.blast(ninja);
    this.drop(ninja);
  }

  destroy(): void {
    this.shield.destroy();
  }

  sync(now: number, ninja: NinjaBody): void {
    if (!this.holding) {
      if (this.drawn) {
        this.shield.clear();
        this.drawn = false;
      }
      return;
    }
    const perfect = this.isPerfect(now);
    this.shield.setPosition(ninja.x, ninja.y);
    if (this.drawn && perfect === this.lastPerfect) {
      return;
    }
    this.lastPerfect = perfect;
    this.drawn = true;
    this.shield.clear();
    this.shield.lineStyle(10, COLORS.paper, perfect ? 0.95 : 0.62);
    this.shield.strokeCircle(0, 0, 30);
    this.shield.lineStyle(5, perfect ? COLORS.yellow : COLORS.cyan, perfect ? 1 : 0.9);
    this.shield.strokeCircle(0, 0, 24);
  }

  private drop(ninja: NinjaBody): void {
    this.holding = false;
    this.drainAcc = 0;
    ninja.blocking = false;
  }

  /** Medium-small outward shove. The callout still plays when this is cooling down. */
  private blast(ninja: NinjaBody): void {
    const now = this.shield.scene.time.now;
    if (now - this.lastBlastAt < COMBAT.shieldBreakBlastCooldownMs) {
      return;
    }
    this.lastBlastAt = now;
    const pushes = this.collectPushes(ninja);
    if (pushes.length === 0) {
      this.spawnBreakRing(ninja.x, ninja.y);
      return;
    }
    this.spawnBreakRing(ninja.x, ninja.y);
    audio.play('combat-knockback', { x: ninja.x, y: ninja.y });
    const apply = (): void => {
      for (const push of pushes) {
        if (!push.body.sprite.active || push.body.down || !push.body.isPresent) {
          continue;
        }
        push.body.applyRecoil(push.dirX, push.dirY, push.power);
      }
    };
    apply();
    // A breaking hit freezes the attacker and queues a smaller recoil after this returns.
    this.shield.scene.time.delayedCall(COMBAT.hitStopBlockMs + 40, apply);
  }

  private collectPushes(ninja: NinjaBody): BlastPush[] {
    const pushes: BlastPush[] = [];
    const radius = COMBAT.shieldBreakBlastRadius;
    forEachLiveFighter((other) => {
      if (other === ninja || other.team === ninja.team || other.down || !other.isPresent) {
        return;
      }
      if (other.isInvulnerable(this.shield.scene.time.now)) {
        return;
      }
      const dx = other.x - ninja.x;
      const dy = other.y - ninja.y;
      const dist = Math.hypot(dx, dy);
      const reach = radius + other.stats.bodyRadius;
      if (dist > reach) {
        return;
      }
      const dirX = dist > 1 ? dx / dist : 1;
      const dirY = dist > 1 ? dy / dist : 0;
      const t = dist / reach;
      const power =
        COMBAT.shieldBreakBlastKnockNear +
        (COMBAT.shieldBreakBlastKnockFar - COMBAT.shieldBreakBlastKnockNear) * t;
      pushes.push({ body: other, dirX, dirY, power });
    });
    return pushes;
  }

  private spawnBreakRing(x: number, y: number): void {
    const scene = this.shield.scene;
    const ring = scene.add.graphics().setDepth(16);
    ring.setPosition(x, y);
    const radius = COMBAT.shieldBreakBlastRadius;
    const anim = { t: 0 };
    scene.tweens.add({
      targets: anim,
      t: 1,
      duration: 180,
      ease: 'Cubic.Out',
      onUpdate: () => {
        ring.clear();
        const r = 8 + anim.t * radius;
        ring.lineStyle(5 - anim.t * 3, COLORS.orange, 0.85 * (1 - anim.t));
        ring.strokeCircle(0, 0, r);
        ring.lineStyle(2, COLORS.paper, 0.7 * (1 - anim.t));
        ring.strokeCircle(0, 0, Math.max(4, r * 0.7));
      },
      onComplete: () => ring.destroy(),
    });
  }
}
