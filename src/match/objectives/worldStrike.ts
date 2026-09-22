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
  /** Defaults to the attacker. Storm bolts and placed fields use their own point. */
  originX?: number;
  originY?: number;
  /** Radians. Omit to use the attacker's light-attack arc. Math.PI is a full circle. */
  halfArc?: number;
};

export type PropBreak = {
  attacker: NinjaBody;
  now: number;
  damage: number;
  reach: number;
  dirX: number;
  dirY: number;
  originX?: number;
  originY?: number;
  halfArc?: number;
  impulse?: number;
};

/** Damages crates, walls, and other props in the ability volume even when no hero is there. */
export const breakProps = (strike: PropBreak): void => {
  emitWorldStrike({
    attacker: strike.attacker,
    now: strike.now,
    damage: strike.damage,
    reach: strike.reach,
    kind: 'ability',
    dirX: strike.dirX,
    dirY: strike.dirY,
    originX: strike.originX,
    originY: strike.originY,
    halfArc: strike.halfArc ?? Math.PI,
    impulse: strike.impulse ?? 1.55,
  });
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
