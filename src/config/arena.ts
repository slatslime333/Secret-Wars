/**
 * Medium battlefield: frequent contact, room to disengage.
 * Camera follows Ninja; HUD and sticks stay viewport-fixed.
 */
export const ARENA = {
  width: 1600,
  height: 1500,
  wallThickness: 40,
  playerSpawn: { x: 550, y: 750 },
  /** On-screen to the right so the rival Ninja walks in immediately. */
  enemySpawn: { x: 1050, y: 750 },
} as const;
