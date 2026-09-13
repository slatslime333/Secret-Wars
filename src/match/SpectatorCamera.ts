import Phaser from 'phaser';
import { MATCH } from '../config/match';
import type { HeroRuntime } from './HeroRuntime';

export type SpectatorMode = 'free' | 'lock';

/**
 * Shared death / simulator camera: WASD or the left stick pans and breaks
 * lock; [ ] / TAB (and on-screen PREV/NEXT) cycle living heroes.
 */
export class SpectatorCamera {
  mode: SpectatorMode = 'lock';
  target: HeroRuntime | null = null;
  enabled = false;

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
  }

  follow(unit: HeroRuntime | null): void {
    this.target = unit;
    this.mode = unit ? 'lock' : 'free';
    const cam = this.scene.cameras.main;
    if (unit?.alive) {
      cam.startFollow(unit.body.sprite, true, 0.16, 0.16);
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

  private living(): HeroRuntime[] {
    return this.heroes().filter((hero) => hero.alive);
  }
}
