import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { smokeBombDef } from './smokeBomb';
import { backflipKickDef } from './backflipKick';
import { ninjaTornadoDef } from './ninjaTornado';

export const NINJA_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'ninja',
  ability1: smokeBombDef,
  ability2: backflipKickDef,
  ultimate: ninjaTornadoDef,
};

/** Fast support / disruptor. Numbers stay on the 70 baseline for now. */
export const NINJA_HERO: HeroDefinition = {
  id: 'ninja',
  displayName: 'Ninja',
  role: 'support',
  abilities: NINJA_ABILITY_KIT,
};
