import { audio } from './AudioManager';
import type { ComboStep } from '../config/combat';
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
  'rope-grab': 'rope-grab-fire',
  'rope-mega-punch': 'rope-punch-jump',
  'shadow-claw': 'shadow-claw-charge',
  'shadow-dash': 'shadow-dash-whoosh',
  'shadow-rage': 'shadow-rage-cast',
  'mender-guardian-angel': 'cole-ball-cast',
  'mender-soul-dash': 'shadow-dash-whoosh',
  'mender-second-wind': 'witch-ult-cast',
  'demon-hellfire': 'cole-ball-cast',
  'demon-hell-bat': 'shadow-dash-whoosh',
  'demon-rage': 'shadow-rage-cast',
};

const ABILITY_LOOP: Record<string, SoundId> = {
  'ninja-tornado': 'ninja-tornado-loop',
  'cole-thunderstorm': 'cole-storm-loop',
  'death-bat-sweep': 'death-sweep-loop',
  'rope-spray': 'rope-spray-loop',
  'shadow-rage': 'shadow-rage-loop',
};

const HERO_SELECT: Record<string, SoundId> = {
  ninja: 'ui-select-ninja',
  cole: 'ui-select-cole',
  death: 'ui-select-death',
  rope: 'ui-select-rope',
  witch: 'ui-select-witch',
  shadow: 'ui-select-shadow',
  mender: 'ui-select-witch',
  demon: 'ui-select-cole',
};

const LIGHT_ATTACK: Record<string, SoundId> = {
  ninja: 'ninja-light',
  cole: 'cole-light',
  death: 'death-light',
  rope: 'rope-light',
  witch: 'witch-light',
  shadow: 'shadow-light',
  mender: 'death-gun-shot',
  demon: 'cole-light',
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
  step: ComboStep,
): void => {
  const where = at(defender);
  if (kind === 'clash') {
    audio.play('combat-clash', where);
    return;
  }
  if (kind === 'perfect-block') {
    audio.play('combat-perfect', where);
    return;
  }
  if (kind === 'blocked') {
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
  const sound = step === 3 ? 'combat-hit-finisher' : step === 2 ? 'combat-hit-heavy' : 'combat-hit';
  audio.play(sound, where);
  if (step === 3) {
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
  if (kind === 'perfect-block') {
    audio.play('combat-perfect', where);
    return;
  }
  if (kind === 'blocked') {
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
    return;
  }
  audio.play(options.heavy ? 'combat-hit-finisher' : 'combat-ability-hit', where);
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
