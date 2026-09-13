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
  'ranged-tank': 'Ranged Tank / Support',
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
  'ninja-backflip-kick': 'Click to aim, then left-click to dash-kick. Two charges, each with a cooldown.',
  'ninja-tornado': 'Spin in a damaging wind burst. Recharges after 45 seconds.',
  'cole-electric-ball': 'Click to aim with the mouse, then left-click to fire a ball that explodes on impact.',
  'cole-discharge': 'Release a close electric burst around Cole.',
  'cole-thunderstorm': 'Call lightning strikes onto nearby enemies. Recharges after 45 seconds.',
  'death-gun-barrage': 'Click to aim along the laser, then left-click to spray a burst of SMG fire.',
  'death-bat-smash': 'Click to aim, then left-click to sweep the bat through that arc.',
  'death-bat-sweep': 'Sweep the bat in a wide damaging arc. Recharges after 45 seconds.',
  'rope-grab': 'Click to aim, then fire a long rope. A hit flings you in for a backflip kick. Misses cost nothing.',
  'rope-mega-punch': 'Jump into a close uppercut with strong knockback and a movement slow.',
  'rope-spray': 'Spin and spray ropes in random directions. Hits paralyze. Recharges after 45 seconds.',
  'witch-tombstone': 'Raise your staff and summon two skeleton bodyguards. Blocked at four living skeletons.',
  'witch-hex': 'Buff yourself and one nearby teammate with a green shield plus speed and attack speed.',
  'witch-tombstone-ult': 'Summon skeletons up to the cap of four and pulse a slowing purple aura. Recharges after 45 seconds.',
  'shadow-claw': 'A giant directional shadow claw with strong knockback. Much larger than a basic swipe.',
  'shadow-dash': 'Dash through the aimed line. Enemies are knocked sideways and slowed.',
  'shadow-rage': 'Lock in place, then fight faster and harder for 7 seconds. Recharges after 45 seconds.',
};

const HERO_TEXT: Record<HeroId, { description: string; light: string }> = {
  ninja: {
    description: 'Fast disruptor who blinds, kicks, and creates space for the team.',
    light: 'Close 3-hit sword combo with extra reach.',
  },
  cole: {
    description: 'Frontliner who holds space with long punches and electric pressure.',
    light: 'Long-reach punches with a slower cadence. Third hit sends a shockwave.',
  },
  death: {
    description: 'Heavy tank who mixes SMG fire with bat slams and sweeps.',
    light: 'Heavy close-range swings.',
  },
  rope: {
    description: 'Mobile support who pokes from long range and disrupts movement with ropes.',
    light: 'Alternating rope shots every 0.4 seconds. Low damage, very long range.',
  },
  witch: {
    description: 'Slow ranged tank/support who bombards with skulls, summons skeletons, and hexes the fight.',
    light: 'Four-skull barrage every 0.5 seconds. Small hits add up. 20% slow on connect.',
  },
  shadow: {
    description: 'Committed melee bruiser who claws into the fight, marks wounds, and rages up close.',
    light: 'Fast shadow-claw swipes every 0.5 seconds. Low knockback. Leaves a lingering claw mark.',
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
