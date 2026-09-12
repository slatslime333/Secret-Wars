/**
 * Battle-only developer toggles. All default off so normal play is clean.
 */
export const DEV_CHEATS = {
  noCooldowns: false,
  godMode: false,
  infiniteAmmo: false,
  showRanges: false,
  showAi: false,
  showHitboxes: false,
};

export const resetDevCheats = (): void => {
  DEV_CHEATS.noCooldowns = false;
  DEV_CHEATS.godMode = false;
  DEV_CHEATS.infiniteAmmo = false;
  DEV_CHEATS.showRanges = false;
  DEV_CHEATS.showAi = false;
  DEV_CHEATS.showHitboxes = false;
};
