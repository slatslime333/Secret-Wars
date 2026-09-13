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
  'ninja-smoke-bomb':
    'Tosses a smoke cloud a step ahead. Enemies inside move slower and attack slower for a few seconds. Ninja blasts backward out of the cloud as it appears.',
  'ninja-backflip-kick':
    'Aim, then dash-kick through the line. Hits launch enemies with powerful knockback and slow them for a couple of seconds. Two charges.',
  'ninja-tornado':
    'Ninja becomes a bouncing whirlwind for a few seconds, cutting through nearby enemies with light knockback and a brief stun.',
  'cole-electric-ball':
    'Aim, then fire a ball that explodes on impact. The blast launches the first target with powerful knockback and slows them for a couple of seconds, then chains to nearby enemies with a lighter slow.',
  'cole-discharge':
    'A close electric burst around Cole. Hits with strong knockback and paralyzes enemies for about a second.',
  'cole-thunderstorm':
    'Cole plants himself and calls lightning around him for several seconds. Strikes deal moderate knockback and slow survivors for about a second. Cole himself is heavily slowed while the storm lasts.',
  'death-gun-barrage':
    'Aim along the laser, then spray a burst of SMG fire. Individual shots have light knockback.',
  'death-bat-smash':
    'Aim, then sweep the bat through that arc. Contact stuns for just over a second and sends enemies flying with powerful knockback.',
  'death-bat-sweep':
    'Death spins the bat in a wide damaging arc for several seconds. Hits carry strong knockback, and Death moves slower while sweeping.',
  'rope-grab':
    'Aim, then fire a long rope. A hit flings you in for a backflip kick with powerful knockback. Misses cost nothing.',
  'rope-mega-punch':
    'Jump into a close uppercut with strong knockback that also slows movement for a couple of seconds.',
  'rope-spray':
    'Spin and spray ropes in every direction for several seconds. Hits paralyze for a couple of seconds and carry light knockback. Rope Man moves slower while spraying.',
  'witch-tombstone':
    'Raise the staff and summon two skeleton bodyguards. They stay close and fight for her. No more than four living skeletons at once.',
  'witch-hex':
    'Buff Witch and one nearby teammate with a green shield plus faster movement and attack speed for several seconds.',
  'witch-tombstone-ult':
    'Fill the skeleton pack up to four and pulse a purple aura. Nearby enemies move slower and attack slower for several seconds.',
  'shadow-claw':
    'A giant directional claw swipe with powerful knockback. Much larger than a basic swipe, but not a full-screen reach.',
  'shadow-dash':
    'Dash through the aimed line. Enemies are knocked sideways with strong knockback and both move and attack slower for a couple of seconds.',
  'shadow-rage':
    'Lock in place to transform, then fight faster and harder for several seconds — quicker movement and attacks, extra stamina, faster stamina recovery, and a defense boost.',
};

const HERO_TEXT: Record<HeroId, { description: string; light: string }> = {
  ninja: {
    description:
      'A fast close-range disruptor. Ninja darts in to harass, drops smoke to break a fight, and kicks through the line to create space for teammates.',
    light:
      'Three-hit sword combo with extra reach. Keep tapping to chain into a heavier finisher.',
  },
  cole: {
    description:
      'A frontliner who holds space with long punches, then punishes clumps with electricity.',
    light:
      'Long-reach punches at a slower cadence. Hits slow the target for about a second. The third punch sends a shockwave with stronger knockback up close.',
  },
  death: {
    description:
      'A heavy tank who crowds the lane with bat swings, then mixes in SMG fire and bone-cracking slams.',
    light:
      'Close-range bat swings in fast pairs, then a short pause. The third hit reaches farther, hits harder, and carries stronger knockback.',
  },
  rope: {
    description:
      'Mobile support who pokes from very long range, then yanks into the fight or locks people down with ropes.',
    light:
      'Alternating rope shots from each arm. Low damage, very long range, and moderate knockback.',
  },
  witch: {
    description:
      'A slow ranged tank and support. She bombards from far away, raises skeleton bodyguards, and hexes her side of the fight.',
    light:
      'Four-skull barrage. Small hits add up, with light knockback and a movement slow that lasts a couple of seconds.',
  },
  shadow: {
    description:
      'A committed melee bruiser. She claws into the fight, marks wounds, and rages when she can stay in close.',
    light:
      'Fast shadow-claw swipes with light knockback. Each hit leaves a lingering wound that drains health for a few seconds.',
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
