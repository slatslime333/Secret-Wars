import { COMBAT } from '../config/combat';
import { NinjaBody } from '../heroes/NinjaBody';

/**
 * Shared impact freeze. Heroes and abilities call this instead of inventing
 * their own pause so hit-stop stays one system.
 */
export const applyImpactHitStop = (
  now: number,
  fighters: NinjaBody[],
  durationMs: number = COMBAT.hitStopImpactMs,
): void => {
  for (const fighter of fighters) {
    if (!fighter.down) {
      fighter.freezeForHitStop(now, durationMs);
    }
  }
};
