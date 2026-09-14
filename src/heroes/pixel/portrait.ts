import Phaser from 'phaser';
import type { TeamId } from '../../config/hero';
import { PLAYABLE_HEROES, type HeroId } from '../roster';
import { resolvedPortraitKey } from './loadHeroPixels';

export const addHeroPortrait = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  heroId: HeroId,
  options: { team?: TeamId; scale?: number; facing?: 'east' | 'west' } = {},
): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics => {
  const team = options.team ?? 'alpha';
  const key = resolvedPortraitKey(scene, heroId, team);
  if (key) {
    return scene.add
      .image(x, y, key)
      .setOrigin(0.5, 0.55)
      .setScale(options.scale ?? 0.42);
  }
  const art = scene.add.graphics();
  art.setPosition(x, y);
  art.setScale(options.scale ?? 1);
  PLAYABLE_HEROES[heroId].draw(art, {
    facing: options.facing ?? (team === 'bravo' ? 'west' : 'east'),
    team,
  });
  return art;
};
