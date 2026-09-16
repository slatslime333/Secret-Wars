import type { NinjaBody } from '../../heroes/NinjaBody';

export type WorldStrikeEvent = {
  attacker: NinjaBody;
  now: number;
  damage: number;
  reach: number;
  kind: 'melee' | 'ability' | 'dash' | 'explosion';
  dirX?: number;
  dirY?: number;
  impulse?: number;
};

type Listener = (event: WorldStrikeEvent) => void;

const listeners = new Set<Listener>();

/** Lightweight bus so objectives can take swings without becoming combatants. */
export const onWorldStrike = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitWorldStrike = (event: WorldStrikeEvent): void => {
  if (event.damage <= 0 || listeners.size === 0) {
    return;
  }
  for (const listener of listeners) {
    listener(event);
  }
};
