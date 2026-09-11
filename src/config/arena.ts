/**
 * Medium battlefield: frequent contact, room to disengage.
 * Camera follows Ninja; HUD and sticks stay viewport-fixed.
 */
export const ARENA = {
  width: 1400,
  height: 860,
  wallThickness: 40,
  playerSpawn: { x: 260, y: 430 },
  enemySpawn: { x: 1140, y: 430 },
} as const;
