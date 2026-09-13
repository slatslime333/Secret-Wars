import Phaser from 'phaser';
import { Battlefield, rememberPlayTestSeed, resolvePlayTestSeed } from '../map';

/**
 * Legacy entry. New scenes should call Battlefield.install directly.
 * Kept so older call sites still get the calm generated ground.
 */
export const createGrassyArena = (scene: Phaser.Scene): void => {
  if ((scene as { battlefield?: unknown }).battlefield) {
    return;
  }
  const battlefield = Battlefield.install(scene, { seed: resolvePlayTestSeed(), log: true });
  rememberPlayTestSeed(battlefield.result.seed);
};
