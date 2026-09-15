import type { NinjaBody } from '../heroes/NinjaBody';

export type CombatHealEvent = {
  healer: NinjaBody;
  target: NinjaBody;
  amount: number;
  at: number;
};

type Listener = (event: CombatHealEvent) => void;

const listeners = new Set<Listener>();

export const onCombatHeal = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitCombatHeal = (event: CombatHealEvent): void => {
  if (event.amount <= 0) {
    return;
  }
  for (const listener of listeners) {
    listener(event);
  }
};
