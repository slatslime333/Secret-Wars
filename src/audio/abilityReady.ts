import { audio } from '../audio';
import type { AbilitySlotState } from '../heroes/abilities/types';

const wasReady = new WeakMap<object, boolean[]>();

/** Play a distinct chime the frame a slot flips from cooling to ready. */
export const cueAbilityReady = (owner: object, states: AbilitySlotState[]): void => {
  const prev = wasReady.get(owner) ?? [true, true, true];
  states.forEach((state, i) => {
    const ready = state.ready && !state.consumed;
    if (ready && prev[i] === false) {
      audio.play('ability-ready');
    }
    prev[i] = ready;
  });
  wasReady.set(owner, prev);
};
