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

/** Foundational mobile disruptor. */
export const NINJA_HERO: HeroDefinition = {
  id: 'ninja',
  displayName: 'Ninja',
  role: 'disruptor',
  abilities: NINJA_ABILITY_KIT,
};
