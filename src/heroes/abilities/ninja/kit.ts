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

/** Current all-rounder identity. Future Ninja shifts toward a fast diver kit. */
export const NINJA_HERO: HeroDefinition = {
  id: 'ninja',
  displayName: 'Ninja',
  role: 'generalist',
  abilities: NINJA_ABILITY_KIT,
};
