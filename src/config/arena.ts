import type { TeamId } from './hero';

/**
 * Medium battlefield: frequent contact, room to disengage.
 * Camera follows the player; HUD and sticks stay viewport-fixed.
 *
 * Team pads sit at opposite ends so 1v1 and future 3v3 share one layout.
 * Minion pads sit just inward — wave spawning can reuse them later.
 */
export const TEAM_SPAWNS: Record<TeamId, { x: number; y: number; facingX: number }> = {
  alpha: { x: 168, y: 750, facingX: 1 },
  bravo: { x: 1432, y: 750, facingX: -1 },
};

export const MINION_SPAWNS: Record<TeamId, { x: number; y: number; facingX: number }> = {
  alpha: { x: 280, y: 750, facingX: 1 },
  bravo: { x: 1320, y: 750, facingX: -1 },
};

export const ARENA = {
  width: 1600,
  height: 1500,
  wallThickness: 40,
  teamSpawns: TEAM_SPAWNS,
  minionSpawns: MINION_SPAWNS,
  playerSpawn: TEAM_SPAWNS.alpha,
  enemySpawn: TEAM_SPAWNS.bravo,
} as const;
