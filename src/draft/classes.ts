import type { HeroId } from '../heroes/roster';

/**
 * Draft composition classes. Combat `role` strings are not used here:
 * Witch is a tank in draft even though her kit is ranged-tank, and Ninja is
 * support even though his kit is disruptor.
 */
export type DraftClass = 'frontliner' | 'support' | 'tank';

export const DRAFT_CLASSES: readonly DraftClass[] = ['frontliner', 'support', 'tank'];

export const HERO_DRAFT_CLASS: Record<HeroId, DraftClass> = {
  cole: 'frontliner',
  shadow: 'frontliner',
  ninja: 'support',
  rope: 'support',
  witch: 'tank',
  death: 'tank',
};

export const DRAFT_CLASS_LABEL: Record<DraftClass, string> = {
  frontliner: 'FRONTLINER',
  support: 'SUPPORT',
  tank: 'TANK',
};

export const HEROES_BY_CLASS: Record<DraftClass, readonly [HeroId, HeroId]> = {
  frontliner: ['cole', 'shadow'],
  support: ['ninja', 'rope'],
  tank: ['witch', 'death'],
};

export const DRAFT_HERO_IDS: readonly HeroId[] = ['cole', 'shadow', 'ninja', 'rope', 'witch', 'death'];

export const draftClassOf = (heroId: HeroId): DraftClass => HERO_DRAFT_CLASS[heroId];

export const otherHeroOfClass = (heroId: HeroId): HeroId => {
  const cls = draftClassOf(heroId);
  const pair = HEROES_BY_CLASS[cls];
  return pair[0] === heroId ? pair[1] : pair[0];
};
