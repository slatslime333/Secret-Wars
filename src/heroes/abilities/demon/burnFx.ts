import Phaser from 'phaser';
import type { NinjaBody } from '../../NinjaBody';
import { DEMON_BURN } from './tunables';
import { grantDemonRage, demonRageFromBurn } from './form';

export type BurnKind = 'candle' | 'hellfire';

type BurnState = {
  until: number;
  tickAt: number;
  tickMs: number;
  damage: number;
  kind: BurnKind;
  attacker?: NinjaBody;
};

const burns = new WeakMap<NinjaBody, BurnState>();

/** Last applied burn wins. Duration refreshes; DPS does not stack. */
export const applyBurn = (target: NinjaBody, now: number, kind: BurnKind, attacker?: NinjaBody): void => {
  const next: BurnState =
    kind === 'hellfire'
      ? {
          until: now + DEMON_BURN.hellfireDurationMs,
          tickAt: now,
          tickMs: DEMON_BURN.hellfireTickMs,
          damage: DEMON_BURN.hellfireDamage,
          kind,
          attacker,
        }
      : {
          until: now + DEMON_BURN.candleDurationMs,
          tickAt: now,
          tickMs: DEMON_BURN.candleTickMs,
          damage: DEMON_BURN.candleDamage,
          kind,
          attacker,
        };
  const current = burns.get(target);
  if (current && now < current.until && current.kind === kind) {
    current.until = next.until;
    current.attacker = attacker ?? current.attacker;
    return;
  }
  if (current && now < current.until && current.kind === 'hellfire' && kind === 'candle') {
    current.until = Math.max(current.until, next.until);
    return;
  }
  burns.set(target, next);
};

export const clearBurn = (target: NinjaBody): void => {
  burns.delete(target);
};

export const isBurning = (target: NinjaBody, now: number): boolean => {
  const state = burns.get(target);
  return Boolean(state && now < state.until);
};

export const tickBurn = (target: NinjaBody, now: number): void => {
  const state = burns.get(target);
  if (!state) {
    return;
  }
  if (now >= state.until || target.down || !target.isPresent) {
    burns.delete(target);
    return;
  }
  while (state.tickAt + state.tickMs <= now && state.tickAt + state.tickMs <= state.until) {
    state.tickAt += state.tickMs;
    target.takeDotDamage(state.damage, now, state.attacker);
    if (state.attacker && !target.down) {
      grantDemonRage(state.attacker, demonRageFromBurn(), target);
    }
    if (target.down) {
      burns.delete(target);
      return;
    }
  }
};

export const drawBurnFlames = (g: Phaser.GameObjects.Graphics, x: number, y: number, now: number): void => {
  g.clear();
  g.setPosition(x, y);
  const t = now / 80;
  for (let i = 0; i < 5; i += 1) {
    const a = t * (1.1 + i * 0.17) + i * 1.1;
    const lift = 6 + (i % 3) * 3 + Math.sin(t * 1.4 + i) * 2.4;
    const px = Math.cos(a) * (4 + i);
    const py = -8 - lift * 0.45;
    g.fillStyle(0x3a1008, 0.45);
    g.fillEllipse(px, py + 2, 7, 10);
    g.fillStyle(i % 2 === 0 ? 0xff6a18 : 0xffc030, 0.92);
    g.fillEllipse(px, py, 5.4, 8.6);
    g.fillStyle(0xfff2a0, 0.7);
    g.fillEllipse(px, py - 2.2, 2.4, 4);
  }
};
