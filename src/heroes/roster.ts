import { COLE } from '../config/cole';
import { DEATH } from '../config/death';
import { NINJA } from '../config/ninja';
import { ROPE } from '../config/rope';
import { WITCH } from '../config/witch';
import { SHADOW } from '../config/shadow';
import { MENDER } from '../config/mender';
import { HeroCombatConfig } from '../config/hero';
import { HeroAbilityKit } from './abilities/types';
import { NINJA_ABILITY_KIT } from './abilities/ninja/kit';
import { COLE_ABILITY_KIT } from './abilities/cole/kit';
import { DEATH_ABILITY_KIT } from './abilities/death/kit';
import { ROPE_ABILITY_KIT } from './abilities/rope/kit';
import { WITCH_ABILITY_KIT } from './abilities/witch/kit';
import { SHADOW_ABILITY_KIT } from './abilities/shadow/kit';
import { MENDER_ABILITY_KIT } from './abilities/mender/kit';
import { drawNinja } from './drawNinja';
import { drawCole } from './drawCole';
import { drawDeath } from './drawDeath';
import { drawRope } from './drawRope';
import { drawWitch } from './drawWitch';
import { drawShadow } from './drawShadow';
import { drawMender } from './drawMender';
import { HeroDrawFn } from './heroDraw';
import type { CoreRatings } from '../config/ratings';

export type HeroId = 'ninja' | 'cole' | 'death' | 'rope' | 'witch' | 'shadow' | 'mender';

export const HERO_IDS: HeroId[] = ['ninja', 'cole', 'death', 'rope', 'witch', 'shadow', 'mender'];

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
  rope: {
    id: 'rope',
    stats: ROPE,
    kit: ROPE_ABILITY_KIT,
    draw: drawRope,
    handSparks: false,
  },
  witch: {
    id: 'witch',
    stats: WITCH,
    kit: WITCH_ABILITY_KIT,
    draw: drawWitch,
    handSparks: false,
  },
  shadow: {
    id: 'shadow',
    stats: SHADOW,
    kit: SHADOW_ABILITY_KIT,
    draw: drawShadow,
    handSparks: false,
  },
  mender: {
    id: 'mender',
    stats: MENDER,
    kit: MENDER_ABILITY_KIT,
    draw: drawMender,
    handSparks: false,
  },
};

let selectedHero: HeroId = 'ninja';

export const getSelectedHeroId = (): HeroId => selectedHero;

export const setSelectedHeroId = (id: HeroId): void => {
  selectedHero = id;
};

export const getSelectedHero = (): PlayableHero => PLAYABLE_HEROES[selectedHero];
