import Phaser from 'phaser';
import { COMBAT } from '../config/combat';
import { playWorld } from '../audio';
import { NinjaBody } from '../heroes/NinjaBody';
import { ropeArmOrigin } from '../heroes/drawRope';
import { ROPE_DASH } from '../heroes/abilities/rope/tunables';
import { strokeRope } from '../heroes/abilities/rope/ropeVisual';

const totalMs = ROPE_DASH.shootMs + ROPE_DASH.grabMs + ROPE_DASH.travelMs;

type Phase = 'shoot' | 'grab' | 'fling' | 'done';

/**
 * Rope-sling dash: shoot a V of ropes, grab, then front-flip along them.
 * Distance is the rope landing points, not a generic slide length.
 */
export class RopeSlingDash {
  private phase: Phase = 'shoot';
  private startedAt = 0;
  private shootUntil = 0;
  private grabUntil = 0;
  private flingUntil = 0;
  private readonly origin = { x: 0, y: 0 };
  private readonly left = { x: 0, y: 0 };
  private readonly right = { x: 0, y: 0 };
  private readonly ropes: Phaser.GameObjects.Graphics;
  private ended = false;

  readonly durationMs = totalMs;

  constructor(
    scene: Phaser.Scene,
    private readonly ninja: NinjaBody,
    private readonly dir: Phaser.Math.Vector2,
  ) {
    this.ropes = scene.add.graphics().setDepth(16);
  }

  begin(now: number): void {
    this.startedAt = now;
    this.shootUntil = now + ROPE_DASH.shootMs;
    this.grabUntil = this.shootUntil + ROPE_DASH.grabMs;
    this.flingUntil = this.grabUntil + ROPE_DASH.travelMs;
    this.origin.x = this.ninja.x;
    this.origin.y = this.ninja.y;
    const nx = this.dir.x;
    const ny = this.dir.y;
    const c = Math.cos(ROPE_DASH.spreadRad);
    const s = Math.sin(ROPE_DASH.spreadRad);
    const lx = nx * c + ny * s;
    const ly = ny * c - nx * s;
    const rx = nx * c - ny * s;
    const ry = ny * c + nx * s;
    this.left.x = this.origin.x + lx * ROPE_DASH.distance;
    this.left.y = this.origin.y + ly * ROPE_DASH.distance;
    this.right.x = this.origin.x + rx * ROPE_DASH.distance;
    this.right.y = this.origin.y + ry * ROPE_DASH.distance;
    this.ninja.setAim(nx, ny);
    this.ninja.setSpeedCap(COMBAT.physicsMaxSpeed);
    this.ninja.playCustomAttack(now, ROPE_DASH.shootMs + ROPE_DASH.grabMs, (frac) => ({
      armLiftLeft: 0.85,
      armLiftRight: 0.85,
      swayX: nx * 4,
      jumpY: frac > 0.65 ? -6 : 0,
      ropeAction: 'grab' as const,
    }));
    playWorld('rope-dash-fire', this.ninja);
  }

  isActive(now: number): boolean {
    return !this.ended && now < this.flingUntil;
  }

  apply(now: number, ninja: NinjaBody): void {
    if (this.ended || ninja.down) {
      this.destroy();
      return;
    }
    if (this.phase === 'shoot') {
      ninja.stop();
      this.drawRopes(this.shootProgress(now), ninja);
      if (now >= this.shootUntil) {
        this.phase = 'grab';
        playWorld('rope-dash-snap', ninja);
        ninja.playCustomAttack(now, ROPE_DASH.grabMs, () => ({
          armLiftLeft: 1,
          armLiftRight: 1,
          jumpY: -8,
          ropeAction: 'grab' as const,
        }));
      }
      return;
    }
    if (this.phase === 'grab') {
      ninja.stop();
      this.drawRopes(1, ninja);
      if (now >= this.grabUntil) {
        this.beginFling(ninja);
      }
      return;
    }
    if (this.phase === 'fling') {
      const speed = ROPE_DASH.distance / (ROPE_DASH.travelMs / 1000);
      ninja.setSpeedCap(speed);
      ninja.body?.setDrag(0, 0);
      ninja.body?.setVelocity(this.dir.x * speed, this.dir.y * speed);
      this.drawRopes(1, ninja);
      if (now >= this.flingUntil) {
        this.finish(ninja);
      }
    }
  }

  destroy(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.phase = 'done';
    this.ropes.destroy();
    this.ninja.setSpeedCap(COMBAT.physicsMaxSpeed);
  }

  private beginFling(ninja: NinjaBody): void {
    this.phase = 'fling';
    playWorld('rope-dash-zip', ninja);
    ninja.playFrontFlip(this.dir.x, this.dir.y, ROPE_DASH.travelMs, ROPE_DASH.jumpHeight);
    playWorld('rope-dash-whoosh', ninja);
  }

  private finish(ninja: NinjaBody): void {
    this.destroy();
    ninja.setSpeedCap(COMBAT.physicsMaxSpeed);
  }

  private shootProgress(now: number): number {
    const t = (now - this.startedAt) / ROPE_DASH.shootMs;
    return Phaser.Math.Clamp(t, 0, 1);
  }

  private drawRopes(extend: number, ninja: NinjaBody): void {
    const aim = Math.atan2(this.dir.y, this.dir.x);
    const leftHand = ropeArmOrigin(ninja.x, ninja.y, aim, -1, 14);
    const rightHand = ropeArmOrigin(ninja.x, ninja.y, aim, 1, 14);
    const lx = this.origin.x + (this.left.x - this.origin.x) * extend;
    const ly = this.origin.y + (this.left.y - this.origin.y) * extend;
    const rx = this.origin.x + (this.right.x - this.origin.x) * extend;
    const ry = this.origin.y + (this.right.y - this.origin.y) * extend;
    this.ropes.clear();
    strokeRope(this.ropes, leftHand.x, leftHand.y, lx, ly, 3.1);
    strokeRope(this.ropes, rightHand.x, rightHand.y, rx, ry, 3.1);
  }
}
