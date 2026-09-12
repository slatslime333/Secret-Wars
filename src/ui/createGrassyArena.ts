import Phaser from 'phaser';
import { Battlefield, freshMatchSeed } from '../map';

/**
 * Legacy entry. New scenes should call Battlefield.install directly.
 * Kept so older call sites still get the calm generated ground.
 */
export const createGrassyArena = (scene: Phaser.Scene): void => {
  if ((scene as { battlefield?: unknown }).battlefield) {
    return;
  }
  Battlefield.install(scene, { seed: freshMatchSeed(), log: true });
};
