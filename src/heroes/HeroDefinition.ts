import type { HeroAbilityKit } from './abilities/types';

/**
 * A hero's identity is base stats + this kit + combat role.
 * Future heroes (frontliners, disruptors, tanks, assassins, ranged, supports, CC, hybrids)
 * plug in a different kit without rewriting core combat.
 */
export type HeroRole =
  | 'generalist'
  | 'frontliner'
  | 'disruptor'
  | 'assassin'
  | 'ranged'
  | 'tank'
  | 'support'
  | 'ranged-tank'
  | 'crowd-control'
  | 'hybrid'
  | 'minion';

export type HeroDefinition = {
  id: string;
  displayName: string;
  role: HeroRole;
  abilities: HeroAbilityKit;
};
