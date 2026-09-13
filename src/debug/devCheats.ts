/**
 * Battle-only developer toggles. All default off so normal play is clean.
 */
export const DEV_CHEATS = {
  noCooldowns: false,
  godMode: false,
  showRanges: false,
  showAi: false,
  showHitboxes: false,
  showSpawns: false,
  showWaveInfo: false,
  showXpInfo: false,
  showScore: false,
  showDamageStats: false,
  showMapDebug: false,
};

export const resetDevCheats = (): void => {
  DEV_CHEATS.noCooldowns = false;
  DEV_CHEATS.godMode = false;
  DEV_CHEATS.showRanges = false;
  DEV_CHEATS.showAi = false;
  DEV_CHEATS.showHitboxes = false;
  DEV_CHEATS.showSpawns = false;
  DEV_CHEATS.showWaveInfo = false;
  DEV_CHEATS.showXpInfo = false;
  DEV_CHEATS.showScore = false;
  DEV_CHEATS.showDamageStats = false;
  DEV_CHEATS.showMapDebug = false;
};
