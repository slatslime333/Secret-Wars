import Phaser from 'phaser';
import { MATCH } from '../config/match';
import { INPUT } from '../config/input';
import { applyGameplayCamera, lockCameraFollow, spectatorZoomLimits } from '../ui/layout';
import type { HeroRuntime } from './HeroRuntime';

export type SpectatorMode = 'free' | 'lock';

/**
 * Shared death / simulator camera: WASD or the left stick pans and breaks
 * lock; [ ] / TAB (and on-screen PREV/NEXT) cycle living heroes.
 * Right stick zooms: up pulls out, down pushes in toward the FOV slider.
 */
export class SpectatorCamera {
  mode: SpectatorMode = 'lock';
  target: HeroRuntime | null = null;
  enabled = false;

  private zoom = 1;
  private zoomReady = false;
  private readonly prevKey?: Phaser.Input.Keyboard.Key;
  private readonly nextKey?: Phaser.Input.Keyboard.Key;
  private readonly tabKey?: Phaser.Input.Keyboard.Key;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly heroes: () => HeroRuntime[],
  ) {
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      keyboard.addCapture(['TAB']);
      this.prevKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET);
      this.nextKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET);
      this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    }
  }

  enable(unit: HeroRuntime | null): void {
    this.enabled = true;
    this.follow(unit);
  }

  disable(): void {
    this.enabled = false;
    this.target = null;
    this.mode = 'lock';
    this.zoomReady = false;
    applyGameplayCamera(this.scene.cameras.main, this.scene.scale.width, this.scene.scale.height);
  }

  follow(unit: HeroRuntime | null): void {
    this.target = unit;
    this.mode = unit ? 'lock' : 'free';
    const cam = this.scene.cameras.main;
    if (unit?.alive) {
      lockCameraFollow(cam, unit.body.sprite);
    } else {
      cam.stopFollow();
    }
  }

  cycle(dir: 1 | -1): void {
    if (!this.enabled) {
      return;
    }
    const living = this.living();
    if (!living.length) {
      this.follow(null);
      return;
    }
    const idx = this.target ? living.indexOf(this.target) : -1;
    const start = idx >= 0 ? idx : dir > 0 ? -1 : 0;
    this.follow(living[(start + dir + living.length) % living.length]);
  }

  tick(move: Phaser.Math.Vector2, delta: number, blocked: boolean): void {
    if (!this.enabled || blocked) {
      return;
    }
    if (this.prevKey && Phaser.Input.Keyboard.JustDown(this.prevKey)) {
      this.cycle(-1);
    }
    if (
      (this.nextKey && Phaser.Input.Keyboard.JustDown(this.nextKey)) ||
      (this.tabKey && Phaser.Input.Keyboard.JustDown(this.tabKey))
    ) {
      this.cycle(1);
    }

    if (move.lengthSq() > 0.02) {
      this.mode = 'free';
      const cam = this.scene.cameras.main;
      cam.stopFollow();
      const dt = delta / 1000;
      const speed = MATCH.spectator.panSpeed;
      cam.setScroll(cam.scrollX + move.x * speed * dt, cam.scrollY + move.y * speed * dt);
      return;
    }

    if (this.mode === 'lock' && !this.target?.alive) {
      this.follow(this.living()[0] ?? null);
    }
  }

  /** Apply right-stick zoom. Up (negative Y) zooms out; down zooms in. */
  tickZoom(stickY: number, delta: number): void {
    if (!this.enabled) {
      return;
    }
    const { min, max } = this.limits();
    if (!this.zoomReady) {
      this.zoom = max;
      this.zoomReady = true;
    }
    if (Math.abs(stickY) >= INPUT.rightDeadzone) {
      this.zoom += -stickY * MATCH.spectator.zoomSpeed * (delta / 1000);
    }
    this.zoom = Phaser.Math.Clamp(this.zoom, min, max);
    this.scene.cameras.main.setZoom(this.zoom);
  }

  syncZoom(): void {
    if (!this.enabled) {
      return;
    }
    const { min, max } = this.limits();
    if (!this.zoomReady) {
      this.zoom = max;
      this.zoomReady = true;
    }
    this.zoom = Phaser.Math.Clamp(this.zoom, min, max);
    this.scene.cameras.main.setZoom(this.zoom);
  }

  private limits(): { min: number; max: number } {
    return spectatorZoomLimits(this.scene.scale.width, this.scene.scale.height);
  }

  private living(): HeroRuntime[] {
    return this.heroes().filter((hero) => hero.alive);
  }
}
