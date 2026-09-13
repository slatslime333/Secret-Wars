import { PLAYABLE_HEROES, type HeroId, type PlayableHero } from './roster';
import {
  displayedRatingsForHero,
  overallRating,
  powerPoints,
  type CoreRatings,
} from '../config/ratings';

export type HeroSelectCopy = {
  id: HeroId;
  name: string;
  role: string;
  description: string;
  light: string;
  ratings: CoreRatings;
  overall: number;
  power: number;
  ability1: { name: string; text: string };
  ability2: { name: string; text: string };
  ultimate: { name: string; text: string };
};

const ROLE_LABEL: Record<string, string> = {
  disruptor: 'Disruptor',
  support: 'Support',
  frontliner: 'Frontliner',
  assassin: 'Assassin',
  ranged: 'Ranged',
  tank: 'Tank',
  generalist: 'Generalist',
  'crowd-control': 'Crowd Control',
  hybrid: 'Hybrid',
};

const ABILITY_TEXT: Record<string, string> = {
  'ninja-smoke-bomb': 'Throws a smoke cloud that damages and blinds enemies inside it.',
  'ninja-backflip-kick': 'Hold to aim, then dash-kick the target and backflip away.',
  'ninja-tornado': 'Spin in a damaging wind burst. Recharges after 45 seconds.',
  'cole-electric-ball': 'Hold to aim, then fire a ball that explodes on impact.',
  'cole-discharge': 'Release a close electric burst around Cole.',
  'cole-thunderstorm': 'Call lightning strikes onto nearby enemies. Recharges after 45 seconds.',
  'death-gun-barrage': 'Hold to aim, then spray a burst of SMG fire.',
  'death-bat-smash': 'Hold to aim, then sweep the bat through that arc.',
  'death-bat-sweep': 'Sweep the bat in a wide damaging arc. Recharges after 45 seconds.',
};

const HERO_TEXT: Record<HeroId, { description: string; light: string }> = {
  ninja: {
    description: 'Fast disruptor who blinds, kicks, and creates space for the team.',
    light: 'Close 3-hit sword combo with extra reach.',
  },
  cole: {
    description: 'Frontliner who holds space with long punches and electric pressure.',
    light: 'Long-reach punches. Third hit sends a shockwave.',
  },
  death: {
    description: 'Heavy tank who mixes SMG fire with bat slams and sweeps.',
    light: 'Heavy close-range swings.',
  },
};

const slotCopy = (hero: PlayableHero, slot: 'ability1' | 'ability2' | 'ultimate') => {
  const def = hero.kit[slot];
  return {
    name: def.name,
    text: ABILITY_TEXT[def.id] ?? def.name,
  };
};

export const heroSelectCopy = (id: HeroId): HeroSelectCopy => {
  const hero = PLAYABLE_HEROES[id];
  const flavor = HERO_TEXT[id];
  const ratings = displayedRatingsForHero(hero.stats);
  return {
    id,
    name: hero.stats.displayName,
    role: ROLE_LABEL[hero.stats.role] ?? hero.stats.role,
    description: flavor.description,
    light: flavor.light,
    ratings,
    overall: overallRating(ratings),
    power: powerPoints(ratings),
    ability1: slotCopy(hero, 'ability1'),
    ability2: slotCopy(hero, 'ability2'),
    ultimate: slotCopy(hero, 'ultimate'),
  };
};

export const ALL_HERO_SELECT_COPY: HeroSelectCopy[] = (Object.keys(PLAYABLE_HEROES) as HeroId[]).map(
  (id) => heroSelectCopy(id),
);
