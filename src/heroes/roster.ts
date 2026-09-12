import { COLE } from '../config/cole';
import { NINJA } from '../config/ninja';
import { HeroCombatConfig } from '../config/hero';
import { HeroAbilityKit } from './abilities/types';
import { NINJA_ABILITY_KIT } from './abilities/ninja/kit';
import { COLE_ABILITY_KIT } from './abilities/cole/kit';
import { drawNinja } from './drawNinja';
import { drawCole } from './drawCole';
import { HeroDrawFn } from './heroDraw';

export type HeroId = 'ninja' | 'cole';

export type PlayableHero = {
  id: HeroId;
  stats: HeroCombatConfig;
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
};

let selectedHero: HeroId = 'ninja';

export const getSelectedHeroId = (): HeroId => selectedHero;

export const setSelectedHeroId = (id: HeroId): void => {
  selectedHero = id;
};

export const getSelectedHero = (): PlayableHero => PLAYABLE_HEROES[selectedHero];
