import type Phaser from 'phaser';
import type { NinjaBody } from '../../NinjaBody';

export type GuardianShield = {
  until: number;
  absorbed: number;
  gfx: Phaser.GameObjects.Graphics;
  flashUntil: number;
};

const shields = new WeakMap<NinjaBody, GuardianShield>();

export const guardianOf = (target: NinjaBody): GuardianShield | undefined => shields.get(target);

export const setGuardian = (target: NinjaBody, state: GuardianShield): void => {
  shields.set(target, state);
};

export const clearGuardian = (target: NinjaBody): void => {
  const state = shields.get(target);
  state?.gfx.destroy();
  shields.delete(target);
};

/** Convert incoming HP damage while a Guardian Angel shield is live. */
export const absorbGuardianAngel = (target: NinjaBody, amount: number, now: number): number => {
  const state = shields.get(target);
  if (!state || now >= state.until || amount <= 0) {
    return 0;
  }
  state.absorbed += amount;
  state.flashUntil = now + 180;
  return amount;
};

export const drawGuardianAura = (state: GuardianShield, x: number, y: number, now: number): void => {
  const gfx = state.gfx;
  gfx.clear();
  gfx.setPosition(x, y);
  const remain = Math.max(0, state.until - now);
  const pulse = 0.22 + Math.sin(now / 90) * 0.06;
  const flash = now < state.flashUntil ? 0.28 : 0;
  const radius = 28 + Math.min(14, state.absorbed * 0.12);
  gfx.fillStyle(0x4aa8ff, pulse + flash);
  gfx.fillCircle(0, 0, radius);
  gfx.lineStyle(2.4, now < state.flashUntil ? 0xffffff : 0xdff4ff, 0.75 + flash);
  gfx.strokeCircle(0, 0, radius);
  gfx.lineStyle(1.4, 0x7ecbff, 0.45 + remain / 12000);
  gfx.strokeCircle(0, 0, radius * 0.72);
};
