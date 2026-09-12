import { audio } from './AudioManager';
import type { PlayOptions, SoundId } from './types';

type AudioBody = {
  x: number;
  y: number;
  heroId: string;
  team: string;
  playerControlled: boolean;
  stats: { role: string };
};

const ABILITY_START: Record<string, SoundId> = {
  'ninja-smoke-bomb': 'ninja-smoke',
  'ninja-backflip-kick': 'ninja-kick-whoosh',
  'cole-electric-ball': 'cole-ball-cast',
  'cole-discharge': 'cole-discharge',
  'death-gun-barrage': 'death-gun-start',
  'death-bat-smash': 'death-smash-windup',
};

const ABILITY_LOOP: Record<string, SoundId> = {
  'ninja-tornado': 'ninja-tornado-loop',
  'cole-thunderstorm': 'cole-storm-loop',
  'death-bat-sweep': 'death-sweep-loop',
};

const HERO_SELECT: Record<string, SoundId> = {
  ninja: 'ui-select-ninja',
  cole: 'ui-select-cole',
  death: 'ui-select-death',
};

const LIGHT_ATTACK: Record<string, SoundId> = {
  ninja: 'ninja-light',
  cole: 'cole-light',
  death: 'death-light',
};

export const abilityLoopKey = (abilityId: string, caster: Pick<AudioBody, 'heroId' | 'team'>): string =>
  `${abilityId}:${caster.heroId}:${caster.team}`;

const at = (body: Pick<AudioBody, 'x' | 'y' | 'playerControlled'>): PlayOptions => ({
  x: body.x,
  y: body.y,
  self: body.playerControlled,
});

export const playHeroSelect = (heroId: string): void => {
  const id = HERO_SELECT[heroId];
  if (id) {
    audio.play(id);
  }
};

export const playLightAttack = (attacker: AudioBody): void => {
  const id = LIGHT_ATTACK[attacker.heroId] ?? 'ninja-light';
  audio.play(id, at(attacker));
};

export const playMeleeConnect = (
  kind: 'hit' | 'blocked' | 'perfect-block' | 'clash' | 'whiff',
  attacker: AudioBody,
  defender: AudioBody,
  heavy: boolean,
): void => {
  const where = at(defender);
  if (kind === 'clash') {
    audio.play('combat-clash', where);
    return;
  }
  if (kind === 'blocked' || kind === 'perfect-block') {
    audio.play('combat-block', where);
    return;
  }
  if (kind !== 'hit') {
    return;
  }
  if (defender.stats.role === 'minion' || attacker.stats.role === 'minion') {
    audio.play('minion-hit', where);
    return;
  }
  audio.play(heavy ? 'combat-hit-heavy' : 'combat-hit', where);
  if (heavy) {
    audio.play('combat-knockback', where);
  }
};

export const playAbilityConnect = (
  kind: 'hit' | 'blocked' | 'perfect-block' | 'clash' | 'whiff',
  attacker: AudioBody,
  defender: AudioBody,
  options: { heavy?: boolean; sourceKind?: string } = {},
): void => {
  const where = at(defender);
  if (kind === 'blocked' || kind === 'perfect-block') {
    audio.play('combat-block', where);
    return;
  }
  if (kind !== 'hit') {
    return;
  }
  if (defender.stats.role === 'minion' || attacker.stats.role === 'minion') {
    audio.play('minion-hit', where);
    return;
  }
  if ((options.sourceKind ?? 'ability') === 'light') {
    audio.play(options.heavy ? 'combat-hit-heavy' : 'combat-hit', where);
  }
};

export const startAbilityAudio = (abilityId: string, caster: AudioBody): string | undefined => {
  const start = ABILITY_START[abilityId];
  if (start) {
    audio.play(start, at(caster));
  }
  const loop = ABILITY_LOOP[abilityId];
  if (!loop) {
    return undefined;
  }
  const key = abilityLoopKey(abilityId, caster);
  audio.loop(loop, key, at(caster));
  return key;
};

export const moveAbilityAudio = (key: string | undefined, caster: Pick<AudioBody, 'x' | 'y'>): void => {
  if (key) {
    audio.moveLoop(key, caster.x, caster.y);
  }
};

export const stopAbilityAudio = (key: string | undefined): void => {
  if (key) {
    audio.stop(key);
  }
};

export const playDeath = (body: AudioBody): void => {
  audio.play(body.stats.role === 'minion' ? 'minion-death' : 'hero-death', at(body));
};

export const playWorld = (id: SoundId, body: Pick<AudioBody, 'x' | 'y' | 'playerControlled'>): void => {
  audio.play(id, at(body));
};
