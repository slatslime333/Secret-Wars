import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { tombstoneDef } from './tombstone';
import { hexDef } from './hex';
import { tombstoneUltDef } from './tombstoneUlt';

export const WITCH_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'witch',
  ability1: tombstoneDef,
  ability2: hexDef,
  ultimate: tombstoneUltDef,
};

export const WITCH_HERO: HeroDefinition = {
  id: 'witch',
  displayName: 'Witch',
  role: 'ranged-tank',
  abilities: WITCH_ABILITY_KIT,
};
