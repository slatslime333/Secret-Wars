import { PLAYABLE_HEROES, type HeroId, type PlayableHero } from './roster';
import {
  displayedRatingsForHero,
  overallRating,
  powerPoints,
  type CoreRatings,
} from '../config/ratings';
import { COMBAT } from '../config/combat';
import { NINJA } from '../config/ninja';
import { COLE } from '../config/cole';
import { DEATH } from '../config/death';
import { ROPE } from '../config/rope';
import { WITCH } from '../config/witch';
import { SHADOW } from '../config/shadow';
import { MENDER } from '../config/mender';
import { DEMON } from '../config/demon';
import { NINJA_KICK, NINJA_SMOKE, NINJA_TORNADO } from './abilities/ninja/tunables';
import { COLE_ATTACK, COLE_BALL, COLE_DISCHARGE, COLE_STORM } from './abilities/cole/tunables';
import { DEATH_ATTACK, DEATH_GUN, DEATH_SMASH, DEATH_SWEEP } from './abilities/death/tunables';
import { ROPE_GRAB, ROPE_PUNCH, ROPE_SHOT, ROPE_SPRAY } from './abilities/rope/tunables';
import {
  WITCH_HEX,
  WITCH_SKULL,
  WITCH_SKELETON,
  WITCH_TOMBSTONE,
  WITCH_ULT,
  witchHexAllyRange,
} from './abilities/witch/tunables';
import { SHADOW_CLAW, SHADOW_DASH, SHADOW_MARK, SHADOW_RAGE } from './abilities/shadow/tunables';
import { MENDER_ANGEL, MENDER_PULSE, MENDER_SOUL, MENDER_WIND } from './abilities/mender/tunables';
import { DEMON_BURN, DEMON_HELLFIRE, DEMON_HELL_BAT, DEMON_RAGE } from './abilities/demon/tunables';

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

const hit = (value: number): number => Math.max(1, Math.round(value));

const seconds = (ms: number): string => {
  const s = ms / 1000;
  if (Number.isInteger(s)) {
    return s === 1 ? '1 second' : `${s} seconds`;
  }
  const rounded = Math.round(s * 100) / 100;
  return `${rounded} seconds`;
};

const slower = (mul: number): string => `${Math.round((1 - mul) * 100)}% slower`;
const faster = (mul: number): string => `${Math.round((mul - 1) * 100)}% faster`;
const more = (mul: number): string => `${Math.round((mul - 1) * 100)}% more`;
const cooldownSlower = (mul: number): string => `${Math.round((mul - 1) * 100)}% slower`;

const ninjaHit = (step: 1 | 2 | 3): number => hit(NINJA.attackDamage * COMBAT.combo[step].damageMultiplier);
const coleHit = (step: 1 | 2 | 3): number => hit(COLE.attackDamage * COMBAT.combo[step].damageMultiplier);
const deathHit = (step: 1 | 2 | 3): number => {
  const combo = step === 3 ? COMBAT.combo[3].damageMultiplier : COMBAT.combo[1].damageMultiplier;
  const extra = step === 3 ? DEATH_ATTACK.hit3DamageMul : step === 2 ? 1.05 : 1;
  return hit(DEATH.attackDamage * combo * extra);
};
const shadowHit = (step: 1 | 2 | 3): number => hit(SHADOW.attackDamage * COMBAT.combo[step].damageMultiplier);
const witchSkull = hit(WITCH.attackDamage * WITCH_SKULL.damageMul);
const hexShield = Math.round(WITCH.maxHealth * WITCH_HEX.shieldHealthMul);
const markPct = Math.round(SHADOW_MARK.healthPerSecond * 10000) / 100;
const rageStamina = Math.round(SHADOW.maxStamina * SHADOW_RAGE.staminaPoolMul);

const ABILITY_TEXT: Record<string, string> = {
  'ninja-smoke-bomb':
    `Ninja tosses a smoke cloud a step ahead, then blasts backward out of it. Enemies in the cloud move ${slower(NINJA_SMOKE.moveMul)} and attack ${slower(NINJA_SMOKE.attackSpeedMul)} for ${seconds(NINJA_SMOKE.durationMs)}.`,
  'ninja-backflip-kick':
    `A dash-kick through the aimed line. Hits deal ${hit(NINJA_KICK.damage)} damage, launch with heavy knockback, and slow movement by 50% for ${seconds(NINJA_KICK.hitSlowMs)}. One charge.`,
  'ninja-tornado':
    `Ninja becomes a bouncing whirlwind for ${seconds(NINJA_TORNADO.durationMs)}. Nearby enemies take ${hit(NINJA_TORNADO.damage)} damage per slash, a brief ${seconds(NINJA_TORNADO.stunMs)} stun, and light knockback.`,
  'cole-electric-ball':
    `Cole hurls a ball that explodes for ${hit(COLE_BALL.damage)} damage. The first target is launched and slowed ${slower(COLE_BALL.slowMul)} for ${seconds(COLE_BALL.slowMs)}. The blast chains to up to ${COLE_BALL.maxTargets - 1} nearby enemies for ${hit(COLE_BALL.chainDamage)} damage and a ${seconds(COLE_BALL.chainSlowMs)} slow.`,
  'cole-discharge':
    `A close electric burst around Cole. Hits deal ${hit(COLE_DISCHARGE.damage)} damage with strong knockback and paralyze enemies for ${seconds(COLE_DISCHARGE.paralyzeMs)}.`,
  'cole-thunderstorm':
    `Cole plants himself and calls lightning for ${seconds(COLE_STORM.durationMs)}. Each strike deals ${hit(COLE_STORM.damage)} damage and slows survivors ${slower(COLE_STORM.slowMul)} for ${seconds(COLE_STORM.slowMs)}. Cole himself is ${slower(COLE_STORM.moveMul)} while the storm lasts.`,
  'death-gun-barrage':
    `Death sprays ${DEATH_GUN.bullets} SMG shots along his aim. Each shot deals ${hit(DEATH_GUN.damage)} damage with light knockback.`,
  'death-bat-smash':
    `A heavy bat sweep through the aimed arc. Contact deals ${hit(DEATH_SMASH.damage)} damage, stuns for ${seconds(DEATH_SMASH.stunMs)}, and knocks enemies backward with a heavy shove.`,
  'death-bat-sweep':
    `Death spins the bat in a wide damaging arc for ${seconds(DEATH_SWEEP.durationMs)}. Hits deal ${hit(DEATH_SWEEP.damage)} damage with strong knockback, and Death moves ${slower(DEATH_SWEEP.moveMul)} while sweeping.`,
  'rope-grab':
    `Fire a long rope along your aim. A hit flings you in for a backflip kick that deals ${hit(ROPE_GRAB.damage)} damage, launches with powerful knockback, and slows movement by 50% for ${seconds(ROPE_GRAB.hitSlowMs)}. Misses cost nothing.`,
  'rope-mega-punch':
    `Rope Man jumps into a 360 close burst that deals ${hit(ROPE_PUNCH.damage)} damage with strong knockback and slows movement ${slower(ROPE_PUNCH.slowMul)} for ${seconds(ROPE_PUNCH.slowMs)}.`,
  'rope-spray':
    `He spins and sprays ropes in every direction for ${seconds(ROPE_SPRAY.durationMs)}, firing ${ROPE_SPRAY.shotsPerPulse} shots every ${seconds(ROPE_SPRAY.intervalMs)}. Hits deal ${hit(ROPE_SPRAY.damage)} damage, paralyze for ${seconds(ROPE_SPRAY.paralyzeMs)}, and carry light knockback. Rope Man moves ${slower(ROPE_SPRAY.moveMul)} while spraying.`,
  'witch-tombstone':
    `Witch raises her staff and summons ${WITCH_TOMBSTONE.summonCount} skeleton bodyguards (${WITCH_SKELETON.maxHealth} HP, ${hit(WITCH_SKELETON.attackDamage)} damage). They roam up to ${WITCH_TOMBSTONE.leashRadius}px to fight for her and swing quickly. She can have no more than ${WITCH_TOMBSTONE.cap} living skeletons at once.`,
  'witch-hex':
    `Witch and one teammate within ${witchHexAllyRange()}px gain a ${hexShield} HP shield, ${faster(WITCH_HEX.moveMul)} movement, and ${faster(WITCH_HEX.attackSpeedMul)} attack speed for ${seconds(WITCH_HEX.durationMs)}.`,
  'witch-tombstone-ult':
    `Fills the skeleton pack toward its ${WITCH_TOMBSTONE.cap}-cap (${WITCH_ULT.summonCount} more skeletons) and pulses a purple aura for ${seconds(WITCH_ULT.auraMs)}. Nearby enemies move ${slower(WITCH_ULT.moveMul)} and attack ${cooldownSlower(WITCH_ULT.attackSlowMul)} for ${seconds(WITCH_ULT.debuffMs)}.`,
  'shadow-claw':
    `A giant directional claw swipe that deals ${hit(SHADOW_CLAW.damage)} damage with powerful knockback. Much larger than a basic swipe.`,
  'shadow-dash':
    `Shadow dashes through the aimed line, dealing ${hit(SHADOW_DASH.damage)} damage. Enemies are knocked sideways, move ${slower(SHADOW_DASH.slowMul)}, and attack ${cooldownSlower(SHADOW_DASH.attackSlowMul)} for ${seconds(SHADOW_DASH.slowMs)}.`,
  'shadow-rage':
    `Shadow locks in place for ${seconds(SHADOW_RAGE.castMs)} to transform, then fights harder for ${seconds(SHADOW_RAGE.durationMs)}: ${faster(SHADOW_RAGE.moveMul)} movement, ${faster(SHADOW_RAGE.attackSpeedMul)} attacks, +${rageStamina} max stamina, ${faster(SHADOW_RAGE.staminaRegenMul)} stamina recovery, and ${more(SHADOW_RAGE.defenseMul)} defense.`,
  'mender-guardian-angel':
    `Mender fires a Cole-style energy ball at an ally. The shield lasts ${seconds(MENDER_ANGEL.durationMs)} and converts incoming damage into a Discharge-like knockback burst, ${Math.round(MENDER_ANGEL.healRatio * 100)}% of absorbed damage as healing, and stamina. The ${seconds(MENDER_ANGEL.cooldownMs)} cooldown starts when the shield ends.`,
  'mender-soul-dash':
    `Dash to an ally (same range as Backflip Kick), become a fairy, and grant ${Math.round(MENDER_SOUL.healMaxHp * 100)}% max HP plus ${faster(MENDER_SOUL.moveMul)} movement, ${faster(MENDER_SOUL.attackSpeedMul)} attack speed, and ${faster(MENDER_SOUL.staminaRegenMul)} stamina recovery for ${seconds(MENDER_SOUL.buffMs)}. Mender takes no combat damage until she ejects. Press again to backflip out. The cooldown starts on exit.`,
  'mender-second-wind':
    `Plant a large yellow field for ${seconds(MENDER_WIND.durationMs)}. Allies inside slowly regenerate health and recover stamina faster. Mender takes reduced damage while she holds the circle. Enemies inside are slowed ${slower(MENDER_WIND.enemySlowMul)}.`,
  'demon-hellfire':
    `Throw the candle up to Backflip Kick range. It bursts into a pentagram of fire 35% smaller than Smoke Bomb for ${seconds(DEMON_HELLFIRE.durationMs)}. The blast deals ${hit(DEMON_HELLFIRE.explodeDamage)} damage, then the field ticks while enemies stay inside and applies Burn (${DEMON_BURN.hellfireDamage} every 0.5s for ${seconds(DEMON_BURN.hellfireDurationMs)}, no stack).`,
  'demon-hell-bat':
    `Launch forward and become a fire bat with ${faster(DEMON_HELL_BAT.moveMul)} movement and ${more(DEMON_HELL_BAT.defenseMul)} defense. Forced flight — you steer but cannot stop. Recast or wait ${seconds(DEMON_HELL_BAT.maxDurationMs)} to explode for ${hit(DEMON_HELL_BAT.damage)} damage in a Smoke Bomb radius, knocks everyone back, and slows move and attack speed 25% for ${seconds(DEMON_HELL_BAT.slowMs)}. The blast throws Demon backward. The cooldown starts when you explode.`,
  'demon-rage':
    `Demon Rage fills by converting 20% of damage dealt to heroes as Little Demon — minions do not count, and it takes 35% more to fill. At 100% he automatically transforms: 1 second locked, then ${seconds(DEMON_RAGE.durationMs)} as Big Demon. Other abilities are locked while transformed. Demon Rage does not build while transformed and resets to 0 after.`,
};

const HERO_TEXT: Record<HeroId, { description: string; light: string }> = {
  ninja: {
    description:
      'A fast melee disruptor. Ninja darts in to harass, then uses smoke and kicks to break a fight and open space for his team.',
    light:
      `A close two-hit sword combo. Hits deal ${ninjaHit(1)}, then ${ninjaHit(2)}. Keep tapping to chain the pair.`,
  },
  cole: {
    description:
      'A melee frontliner. Cole holds space with long punches, then punishes groups with electricity.',
    light:
      `Long-reach punches at a slower cadence. Hits deal ${coleHit(1)}, then ${coleHit(2)}, and slow the target ${slower(COLE_ATTACK.targetSlowMul)} for ${seconds(COLE_ATTACK.targetSlowMs)}.`,
  },
  death: {
    description:
      'A heavy melee tank. Death crowds the lane with bat swings, then mixes in SMG fire and crushing slams.',
    light:
      `Close-range bat swings in fast pairs, then a ${seconds(DEATH_ATTACK.pairDelayMs)} pause. Hits deal ${deathHit(1)}, then ${deathHit(2)}. Tapping cannot skip the pause.`,
  },
  rope: {
    description:
      'A long-range support. Rope Man pokes from very far away, then yanks into the fight or locks people down with ropes.',
    light:
      `Alternating rope shots from each arm. Each shot deals ${hit(ROPE.attackDamage)} damage at very long range, drains stamina, and stacks a ${Math.round(ROPE_SHOT.cripplePerHit * 100)}% movement and attack-speed slow (up to ${Math.round(ROPE_SHOT.crippleCap * 100)}%) for ${seconds(ROPE_SHOT.crippleMs)}.`,
  },
  witch: {
    description:
      'A slow ranged tank and support. Witch bombards from far away, raises skeleton bodyguards, and hexes her side of the fight.',
    light:
      `Fires ${WITCH_SKULL.count} skulls in rapid succession. Each skull deals ${witchSkull} damage and lightly knocks enemies back. Hits slow enemies ${slower(WITCH_SKULL.hitSlowMul)} for ${seconds(WITCH_SKULL.hitSlowMs)}.`,
  },
  shadow: {
    description:
      'A committed melee bruiser. Shadow claws into the fight, marks wounds, and rages when she can stay in close.',
    light:
      `Fast shadow-claw swipes dealing ${shadowHit(1)} damage with light knockback. Each hit leaves a wound that drains ${markPct}% of their max health each second for ${seconds(SHADOW_MARK.durationMs)}.`,
  },
  mender: {
    description:
      'A fragile ranged support. Mender pokes with dual uzis, then spends her kit protecting teammates instead of finishing fights herself.',
    light:
      `Pulse: alternating cyan SMG shots. Enemy hits deal ${hit(MENDER.attackDamage)} damage with light knockback and a brief slow. Ally hits restore ${MENDER_PULSE.healHealth} health and ${MENDER_PULSE.healStamina} stamina. Mender splits fire between poking and topping off teammates.`,
  },
  demon: {
    description:
      'A fragile ranged harasser who builds Demon Rage, then becomes a melee frontliner for 11 seconds.',
    light:
      `Candle Flame: a long-range fireball for ${hit(DEMON.attackDamage)} damage with low hitstun. Applies Burn (${DEMON_BURN.candleDamage} every 0.5s for ${seconds(DEMON_BURN.candleDurationMs)}, no stack). Built to poke and fill Demon Rage, not to burst.`,
  },
};

const cooldownLine = (ms: number): string => `Cooldown: ${seconds(ms)}.`;

const slotCopy = (hero: PlayableHero, slot: 'ability1' | 'ability2' | 'ultimate') => {
  const def = hero.kit[slot];
  const body = ABILITY_TEXT[def.id] ?? def.name;
  return {
    name: def.name,
    text: `${body} ${cooldownLine(def.cooldownMs)}`,
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
