import { audio } from './AudioManager';
import { audioSettings } from './AudioSettings';

audioSettings.bindUiTick(() => {
  audio.play('ui-tick');
});

export { audio } from './AudioManager';
export { audioSettings } from './AudioSettings';
export { SOUND_CATALOG, SPAMMY_ABILITY_HITS } from './catalog';
export {
  playAbilityConnect,
  playDeath,
  playHeroSelect,
  playLightAttack,
  playMeleeConnect,
  playWorld,
  startAbilityAudio,
  stopAbilityAudio,
  moveAbilityAudio,
} from './gameplay';
export type { PlayOptions, SoundId } from './types';
