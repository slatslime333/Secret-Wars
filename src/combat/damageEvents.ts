import type { TeamId } from '../config/hero';
import type { NinjaBody } from '../heroes/NinjaBody';

export type DamageSourceKind = 'light' | 'ability' | 'other';

export type CombatDamageEvent = {
  attacker: NinjaBody | null;
  victim: NinjaBody;
  amount: number;
  kind: DamageSourceKind;
  abilityId?: string;
  at: number;
  attackerTeam?: TeamId;
  victimTeam: TeamId;
};

type Listener = (event: CombatDamageEvent) => void;

const listeners = new Set<Listener>();

export const onCombatDamage = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitCombatDamage = (event: CombatDamageEvent): void => {
  for (const listener of listeners) {
    listener(event);
  }
};

export const isHeroFighter = (body: NinjaBody): boolean => body.stats.role !== 'minion';
