import { GAME_HEIGHT, GAME_WIDTH } from '../ui/theme';

/**
 * Demo 1 arena. Phase 1 paints this 1:1 with the camera so PLAY already
 * drops into a combat pit. Phase 2 may enlarge the world and follow the player.
 */
export const ARENA = {
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  wallThickness: 36,
  playerSpawn: { x: 210, y: GAME_HEIGHT / 2 },
  enemySpawn: { x: GAME_WIDTH - 210, y: GAME_HEIGHT / 2 },
} as const;
