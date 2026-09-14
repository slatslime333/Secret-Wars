import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { guardianAngelDef } from './guardianAngel';
import { soulDashDef } from './soulDash';
import { secondWindDef } from './secondWind';

export const MENDER_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'mender',
  ability1: guardianAngelDef,
  ability2: soulDashDef,
  ultimate: secondWindDef,
};

export const MENDER_HERO: HeroDefinition = {
  id: 'mender',
  displayName: 'Mender',
  role: 'support',
  abilities: MENDER_ABILITY_KIT,
};
