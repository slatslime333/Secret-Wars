import type { AbilityController } from './abilities/AbilityController';
import { kitHasAllySupport, SLOT_ORDER } from './abilities/types';
import type { DashController } from '../combat/DashController';
import type { Progression } from '../match/Progression';
import type { NinjaBody } from './NinjaBody';

/** Stamp live kit pressure onto a body so CPU tactics can see ammo and cooldowns. */
export const stampKitPressure = (
  body: NinjaBody,
  now: number,
  abilities?: AbilityController,
  dash?: DashController,
  progression?: Progression,
): void => {
  if (abilities) {
    body.kitAbilityReady = SLOT_ORDER.some((slot) => {
      const state = abilities.slotState(slot, now);
      return state.ready && !state.consumed;
    });
    body.kitHasAllySupport = kitHasAllySupport(abilities.kit);
  }
  if (dash) {
    body.kitDashCharges = dash.chargeCount;
  }
  if (progression) {
    body.kitLevel = progression.level;
    body.kitXpRatio = progression.xpRatio;
  }
};
