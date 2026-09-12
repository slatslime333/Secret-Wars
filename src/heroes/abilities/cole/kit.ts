import { HeroDefinition } from '../../HeroDefinition';
import { HeroAbilityKit } from '../types';
import { electricBallDef } from './electricBall';
import { dischargeDef } from './discharge';
import { thunderstormDef } from './thunderstorm';

export const COLE_ABILITY_KIT: HeroAbilityKit = {
  heroId: 'cole',
  ability1: electricBallDef,
  ability2: dischargeDef,
  ultimate: thunderstormDef,
};

export const COLE_HERO: HeroDefinition = {
  id: 'cole',
  displayName: 'Cole',
  role: 'frontliner',
  abilities: COLE_ABILITY_KIT,
};
