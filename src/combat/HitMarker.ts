import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { NINJA } from '../config/ninja';
import { COLORS } from '../ui/theme';

/**
 * Core combat readout: range ring, hit wedge, and aim marker.
 * This is the attack-direction system, not a debug overlay.
 */
export class HitMarker {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly ballAim: Phaser.GameObjects.Graphics;
  private attacking = false;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(12);
    this.ballAim = scene.add.graphics().setDepth(13);
  }

  setAttacking(value: boolean): void {
    this.attacking = value;
  }

  sync(
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    range: number = NINJA.attackRange,
    arcDegrees: number = COMBAT.attackArcDegrees,
  ): void {
    const angle = Math.atan2(aimY, aimX);
    const half = (arcDegrees * Math.PI) / 360;
    const accent = COLORS.cyan;
    const g = this.graphics;
    g.clear();
    g.setPosition(x, y);

    g.lineStyle(2, COLORS.paper, 0.22);
    for (let i = 0; i < 16; i += 1) {
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = a0 + 0.12;
      g.beginPath();
      g.arc(0, 0, range, a0, a1);
      g.strokePath();
    }

    g.fillStyle(accent, this.attacking ? 0.14 : 0.1);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, range, angle - half, angle + half);
    g.closePath();
    g.fillPath();
    // Subdued reticle stroke during attack so the dynamic white line slice takes center stage
    g.lineStyle(1.5, accent, this.attacking ? 0.25 : 0.65);
    g.beginPath();
    g.arc(0, 0, range, angle - half, angle + half);
    g.strokePath();

    const mx = Math.cos(angle) * range;
    const my = Math.sin(angle) * range;
    g.fillStyle(COLORS.paper, 1);
    g.fillTriangle(mx + Math.cos(angle) * 10, my + Math.sin(angle) * 10, mx + Math.cos(angle + 1.3) * 8, my + Math.sin(angle + 1.3) * 8, mx + Math.cos(angle - 1.3) * 8, my + Math.sin(angle - 1.3) * 8);
    g.lineStyle(2, COLORS.ink, 1);
    g.strokeTriangle(mx + Math.cos(angle) * 10, my + Math.sin(angle) * 10, mx + Math.cos(angle + 1.3) * 8, my + Math.sin(angle + 1.3) * 8, mx + Math.cos(angle - 1.3) * 8, my + Math.sin(angle - 1.3) * 8);
  }

  /** Electric Ball direction + radius ring around Cole. */
  syncBallAim(
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    explodeRadius: number,
    aiming: boolean,
  ): void {
    const angle = Math.atan2(aimY, aimX);
    const g = this.ballAim;
    g.clear();
    g.setPosition(x, y);
    const alpha = aiming ? 0.9 : 0.55;
    g.lineStyle(2, 0x7ecbff, alpha);
    g.strokeCircle(0, 0, explodeRadius);
    g.lineStyle(1, 0xdff4ff, alpha * 0.7);
    g.strokeCircle(0, 0, explodeRadius * 0.55);
    const reach = explodeRadius + 28;
    g.lineStyle(aiming ? 3 : 2, 0x4aa8ff, alpha);
    g.lineBetween(Math.cos(angle) * 10, Math.sin(angle) * 10, Math.cos(angle) * reach, Math.sin(angle) * reach);
    const tipX = Math.cos(angle) * reach;
    const tipY = Math.sin(angle) * reach;
    g.fillStyle(0xdff4ff, alpha);
    g.fillTriangle(
      tipX + Math.cos(angle) * 8,
      tipY + Math.sin(angle) * 8,
      tipX + Math.cos(angle + 1.4) * 6,
      tipY + Math.sin(angle + 1.4) * 6,
      tipX + Math.cos(angle - 1.4) * 6,
      tipY + Math.sin(angle - 1.4) * 6,
    );
  }

  clearBallAim(): void {
    this.ballAim.clear();
  }
}
