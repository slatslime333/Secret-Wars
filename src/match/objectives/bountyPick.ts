import type { TeamId } from '../../config/hero';
import type { HeroRuntime } from '../HeroRuntime';

export type BountyPick = {
  alpha?: HeroRuntime;
  bravo?: HeroRuntime;
};

const livingOf = (heroes: readonly HeroRuntime[], team: TeamId): HeroRuntime[] =>
  heroes.filter((hero) => hero.team === team && hero.alive);

const preferFresh = (pool: HeroRuntime[], avoidId: string | undefined): HeroRuntime[] => {
  if (!avoidId) {
    return pool;
  }
  const fresh = pool.filter((hero) => hero.instanceId !== avoidId);
  return fresh.length > 0 ? fresh : pool;
};

/**
 * One living target per team. Never the same hero for both. Prefer not repeating
 * the previous event's instance ids.
 */
export const pickBountyTargets = (
  heroes: readonly HeroRuntime[],
  rng: () => number,
  last?: { alpha?: string; bravo?: string },
): BountyPick => {
  const alphaPool = preferFresh(livingOf(heroes, 'alpha'), last?.alpha);
  const bravoPool = preferFresh(livingOf(heroes, 'bravo'), last?.bravo);
  if (alphaPool.length === 0 || bravoPool.length === 0) {
    return {};
  }
  const alpha = alphaPool[Math.floor(rng() * alphaPool.length)];
  const bravoChoices = bravoPool.filter((hero) => hero !== alpha);
  const bravo = bravoChoices[Math.floor(rng() * bravoChoices.length)];
  if (!alpha || !bravo) {
    return {};
  }
  return { alpha, bravo };
};
