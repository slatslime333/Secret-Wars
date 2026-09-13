export const AUDIO = {
  storageKey: 'secret-wars-settings',
  defaultMusicVolume: 0.7,
  defaultSfxVolume: 0.8,
  /** Peak music loudness at a full slider. Keep this under 1 so the bed stays behind combat. */
  musicPeakGain: 0.75,
  musicSrc: 'assets/audio/music.mp3',
  uiTickHz: 880,
  uiTickSeconds: 0.05,
} as const;
