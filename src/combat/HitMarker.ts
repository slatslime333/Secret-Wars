import Phaser from 'phaser';
import { NINJA } from '../config/ninja';
import { attackHalfArcRad } from '../config/combat';
import { COLORS } from '../ui/theme';

/**
 * Core combat readout: range ring, hit wedge, and aim marker.
 * This is the attack-direction system, not a debug overlay.
 */
export class HitMarker {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private attacking = false;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(12);
  }

  setAttacking(value: boolean): void {
    this.attacking = value;
  }

  sync(x: number, y: number, aimX: number, aimY: number): void {
    const range = NINJA.attackRange;
    const angle = Math.atan2(aimY, aimX);
    const half = attackHalfArcRad;
    const accent = this.attacking ? COLORS.orange : COLORS.cyan;
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

    g.fillStyle(accent, this.attacking ? 0.28 : 0.12);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, range, angle - half, angle + half);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, accent, 0.9);
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
}
