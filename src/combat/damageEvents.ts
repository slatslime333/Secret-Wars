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

export type CombatBlockedEvent = {
  defender: NinjaBody;
  amount: number;
  at: number;
};

type BlockedListener = (event: CombatBlockedEvent) => void;

const blockedListeners = new Set<BlockedListener>();

export const onCombatBlocked = (listener: BlockedListener): (() => void) => {
  blockedListeners.add(listener);
  return () => {
    blockedListeners.delete(listener);
  };
};

export const emitCombatBlocked = (event: CombatBlockedEvent): void => {
  for (const listener of blockedListeners) {
    listener(event);
  }
};

export const isHeroFighter = (body: NinjaBody): boolean => body.stats.role !== 'minion';
