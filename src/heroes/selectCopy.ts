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
    'Ninja tosses a smoke cloud a step ahead, then blasts backward out of it. Enemies caught in the smoke move slower and attack slower for a few seconds.',
  'ninja-backflip-kick':
    'A dash-kick through the aimed line. Hits launch enemies with powerful knockback and slow them for a couple of seconds. Two charges.',
  'ninja-tornado':
    'Ninja becomes a bouncing whirlwind for a few seconds, cutting through nearby enemies with light knockback and a brief stun.',
  'cole-electric-ball':
    'Cole hurls a ball that explodes on impact. The blast launches the first target with powerful knockback and slows them for a couple of seconds, then chains to nearby enemies with a lighter slow.',
  'cole-discharge':
    'A close electric burst around Cole. Hits with strong knockback and paralyzes enemies for about a second.',
  'cole-thunderstorm':
    'Cole plants himself and calls lightning around him for several seconds. Strikes deal moderate knockback and slow survivors for about a second. Cole himself is heavily slowed while the storm lasts.',
  'death-gun-barrage':
    'Death sprays a burst of SMG fire along his aim. Individual shots have light knockback.',
  'death-bat-smash':
    'A heavy bat sweep through the aimed arc. Contact stuns for just over a second and sends enemies flying with powerful knockback.',
  'death-bat-sweep':
    'Death spins the bat in a wide damaging arc for several seconds. Hits carry strong knockback, and Death moves slower while sweeping.',
  'rope-grab':
    'Fire a long rope along your aim. A hit flings you in for a backflip kick with powerful knockback. Misses cost nothing.',
  'rope-mega-punch':
    'Rope Man jumps into a close uppercut with strong knockback that also slows movement for a couple of seconds.',
  'rope-spray':
    'He spins and sprays ropes in every direction for several seconds. Hits paralyze for a couple of seconds and carry light knockback. Rope Man moves slower while spraying.',
  'witch-tombstone':
    'Witch raises her staff and summons two skeleton bodyguards. They stay close and fight for her. She can have no more than four living skeletons at once.',
  'witch-hex':
    'Witch and one nearby teammate gain a green shield plus faster movement and attack speed for several seconds.',
  'witch-tombstone-ult':
    'Fills the skeleton pack up to four and pulses a purple aura. Nearby enemies move slower and attack slower for several seconds.',
  'shadow-claw':
    'A giant directional claw swipe with powerful knockback. Much larger than a basic swipe.',
  'shadow-dash':
    'Shadow dashes through the aimed line. Enemies are knocked sideways with strong knockback and both move and attack slower for a couple of seconds.',
  'shadow-rage':
    'Shadow locks in place to transform, then fights faster and harder for several seconds — quicker movement and attacks, extra stamina, faster stamina recovery, and a defense boost.',
};

const HERO_TEXT: Record<HeroId, { description: string; light: string }> = {
  ninja: {
    description:
      'A fast melee disruptor. Ninja darts in to harass, then uses smoke and kicks to break a fight and open space for his team.',
    light:
      'A close three-hit sword combo with extra reach. Keep tapping to chain into a heavier finisher.',
  },
  cole: {
    description:
      'A melee frontliner. Cole holds space with long punches, then punishes groups with electricity.',
    light:
      'Long-reach punches at a slower cadence. Each hit slows the target for about a second. The third punch sends a shockwave with stronger knockback up close.',
  },
  death: {
    description:
      'A heavy melee tank. Death crowds the lane with bat swings, then mixes in SMG fire and crushing slams.',
    light:
      'Close-range bat swings in fast pairs, then a short pause. The third hit reaches farther, hits harder, and carries stronger knockback.',
  },
  rope: {
    description:
      'A long-range support. Rope Man pokes from very far away, then yanks into the fight or locks people down with ropes.',
    light:
      'Alternating rope shots from each arm. Low damage, very long range, and moderate knockback.',
  },
  witch: {
    description:
      'A slow ranged tank and support. Witch bombards from far away, raises skeleton bodyguards, and hexes her side of the fight.',
    light:
      'A four-skull barrage. Small hits add up, with light knockback and a movement slow that lasts a couple of seconds.',
  },
  shadow: {
    description:
      'A committed melee bruiser. Shadow claws into the fight, marks wounds, and rages when she can stay in close.',
    light:
      'Fast shadow-claw swipes with light knockback. Each hit leaves a lingering wound that continues to drain their health for a few seconds.',
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
