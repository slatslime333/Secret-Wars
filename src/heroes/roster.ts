import { COLE } from '../config/cole';
import { DEATH } from '../config/death';
import { NINJA } from '../config/ninja';
import { HeroCombatConfig } from '../config/hero';
import { HeroAbilityKit } from './abilities/types';
import { NINJA_ABILITY_KIT } from './abilities/ninja/kit';
import { COLE_ABILITY_KIT } from './abilities/cole/kit';
import { DEATH_ABILITY_KIT } from './abilities/death/kit';
import { drawNinja } from './drawNinja';
import { drawCole } from './drawCole';
import { drawDeath } from './drawDeath';
import { HeroDrawFn } from './heroDraw';
import type { CoreRatings } from '../config/ratings';

export type HeroId = 'ninja' | 'cole' | 'death';

export const HERO_IDS: HeroId[] = ['ninja', 'cole', 'death'];

export const nextHeroId = (id: HeroId): HeroId => {
  const index = HERO_IDS.indexOf(id);
  return HERO_IDS[(index + 1) % HERO_IDS.length];
};

export type PlayableHero = {
  id: HeroId;
  stats: HeroCombatConfig & { ratings: CoreRatings };
  kit: HeroAbilityKit;
  draw: HeroDrawFn;
  handSparks: boolean;
};

export const PLAYABLE_HEROES: Record<HeroId, PlayableHero> = {
  ninja: {
    id: 'ninja',
    stats: NINJA,
    kit: NINJA_ABILITY_KIT,
    draw: (graphics, options) => drawNinja(graphics, options),
    handSparks: false,
  },
  cole: {
    id: 'cole',
    stats: COLE,
    kit: COLE_ABILITY_KIT,
    draw: drawCole,
    handSparks: true,
  },
  death: {
    id: 'death',
    stats: DEATH,
    kit: DEATH_ABILITY_KIT,
    draw: drawDeath,
    handSparks: false,
  },
};

let selectedHero: HeroId = 'ninja';

export const getSelectedHeroId = (): HeroId => selectedHero;

export const setSelectedHeroId = (id: HeroId): void => {
  selectedHero = id;
};

export const getSelectedHero = (): PlayableHero => PLAYABLE_HEROES[selectedHero];
