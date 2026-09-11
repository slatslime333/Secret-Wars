/**
 * Medium battlefield: frequent contact, room to disengage.
 * Camera follows Ninja; HUD and sticks stay viewport-fixed.
 */
export const ARENA = {
  width: 1400,
  height: 860,
  wallThickness: 40,
  playerSpawn: { x: 280, y: 430 },
  /** On-screen to the right so the chaser walks in immediately. */
  enemySpawn: { x: 640, y: 430 },
} as const;
