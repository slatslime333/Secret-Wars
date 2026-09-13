export type AudioBus = 'ui' | 'combat' | 'ability' | 'hero' | 'minion';

export type AudioPriority = 'high' | 'medium' | 'low';

export type SoundId =
  | 'ui-tick'
  | 'ui-hover'
  | 'ui-click'
  | 'ui-confirm'
  | 'ui-back'
  | 'ui-select-ninja'
  | 'ui-select-cole'
  | 'ui-select-death'
  | 'ui-select-rope'
  | 'ui-match-start'
  | 'ui-xp'
  | 'ui-level-up'
  | 'ui-victory'
  | 'ui-defeat'
  | 'ui-draw'
  | 'ability-ready'
  | 'ninja-light'
  | 'cole-light'
  | 'death-light'
  | 'rope-light'
  | 'ninja-smoke'
  | 'ninja-kick-whoosh'
  | 'ninja-kick-impact'
  | 'ninja-tornado-loop'
  | 'ninja-tornado-slash'
  | 'cole-ball-cast'
  | 'cole-ball-impact'
  | 'cole-ball-chain'
  | 'cole-discharge'
  | 'cole-storm-loop'
  | 'cole-storm-warn'
  | 'cole-storm-strike'
  | 'death-gun-start'
  | 'death-gun-shot'
  | 'death-smash-windup'
  | 'death-smash-impact'
  | 'death-sweep-loop'
  | 'death-sweep-hit'
  | 'rope-dash-fire'
  | 'rope-dash-snap'
  | 'rope-dash-zip'
  | 'rope-dash-whoosh'
  | 'rope-grab-fire'
  | 'rope-grab-catch'
  | 'rope-grab-zip'
  | 'rope-grab-impact'
  | 'rope-punch-jump'
  | 'rope-punch-impact'
  | 'rope-spray-whip'
  | 'rope-spray-loop'
  | 'rope-wrap'
  | 'combat-hit'
  | 'combat-hit-heavy'
  | 'combat-block'
  | 'combat-clash'
  | 'combat-ability-hit'
  | 'combat-knockback'
  | 'hero-death'
  | 'minion-attack'
  | 'minion-hit'
  | 'minion-death';

export type SoundDef = {
  id: SoundId;
  bus: AudioBus;
  priority: AudioPriority;
  volume: number;
  cooldownMs: number;
  spatial: boolean;
  loop?: boolean;
  group?: string;
  /** Documented replacement path. Current playback is a Web Audio placeholder. */
  asset: string;
};

export type PlayOptions = {
  x?: number;
  y?: number;
  self?: boolean;
  variation?: number;
};
