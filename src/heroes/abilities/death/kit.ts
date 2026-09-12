import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { gunBarrageDef } from './gunBarrage';
import { batSmashDef } from './batSmash';
import { deathBatSweepDef } from './batSweep';

export const DEATH_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'death',
  ability1: gunBarrageDef,
  ability2: batSmashDef,
  ultimate: deathBatSweepDef,
};

export const DEATH_HERO: HeroDefinition = {
  id: 'death',
  displayName: 'Death',
  role: 'frontliner',
  abilities: DEATH_ABILITY_KIT,
};
