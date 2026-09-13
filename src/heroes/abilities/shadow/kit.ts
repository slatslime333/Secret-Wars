import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { shadowClawDef } from './shadowClaw';
import { shadowDashDef } from './shadowDash';
import { shadowRageDef } from './rage';

export const SHADOW_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'shadow',
  ability1: shadowClawDef,
  ability2: shadowDashDef,
  ultimate: shadowRageDef,
};

export const SHADOW_HERO: HeroDefinition = {
  id: 'shadow',
  displayName: 'Shadow',
  role: 'frontliner',
  abilities: SHADOW_ABILITY_KIT,
};
