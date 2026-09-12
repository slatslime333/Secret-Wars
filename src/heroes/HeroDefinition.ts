import type { HeroAbilityKit } from './abilities/types';

/**
 * A hero's identity is base stats + this kit + combat role.
 * Future heroes (frontliners, assassins, ranged, tanks, supports, CC, hybrids)
 * plug in a different kit without rewriting core combat.
 */
export type HeroRole =
  | 'generalist'
  | 'frontliner'
  | 'assassin'
  | 'ranged'
  | 'tank'
  | 'support'
  | 'crowd-control'
  | 'hybrid'
  | 'minion';

export type HeroDefinition = {
  id: string;
  displayName: string;
  role: HeroRole;
  abilities: HeroAbilityKit;
};
