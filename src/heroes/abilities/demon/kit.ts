import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { hellfireDef } from './hellfire';
import { hellBatDef } from './hellBat';
import { demonRageDef } from './rage';

export const DEMON_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'demon',
  ability1: hellfireDef,
  ability2: hellBatDef,
  ultimate: demonRageDef,
};

export const DEMON_HERO: HeroDefinition = {
  id: 'demon',
  displayName: 'Demon',
  role: 'frontliner',
  abilities: DEMON_ABILITY_KIT,
};
