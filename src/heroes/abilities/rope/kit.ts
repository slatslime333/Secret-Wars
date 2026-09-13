import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { ropeGrabDef } from './ropeGrab';
import { megaPunchDef } from './megaPunch';
import { ropeSprayDef } from './ropeSpray';

export const ROPE_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'rope',
  ability1: ropeGrabDef,
  ability2: megaPunchDef,
  ultimate: ropeSprayDef,
};

export const ROPE_HERO: HeroDefinition = {
  id: 'rope',
  displayName: 'Rope Man',
  role: 'support',
  abilities: ROPE_ABILITY_KIT,
};
