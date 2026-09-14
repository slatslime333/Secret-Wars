import Phaser from 'phaser';
import type { TeamId } from '../../config/hero';
import { HERO_IDS, type HeroId } from '../roster';
import {
  heroFramePx,
  heroPortraitKey,
  heroPortraitSourceKey,
  heroPortraitUrl,
  heroSheetKey,
  heroSheetUrl,
  usesHeroPixels,
} from './spec';

const nearest = (texture: Phaser.Textures.Texture): void => {
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
};

const parseSheetFrames = (scene: Phaser.Scene, key: string, framePx: number): void => {
  if (!scene.textures.exists(key)) {
    return;
  }
  const texture = scene.textures.get(key);
  nearest(texture);
  if (texture.frameTotal > 1) {
    return;
  }
  scene.textures.addSpriteSheet('', texture, {
    frameWidth: framePx,
    frameHeight: framePx,
  });
};

export const preloadHeroPixels = (scene: Phaser.Scene): void => {
  for (const id of HERO_IDS) {
    scene.load.image(heroPortraitKey(id), heroPortraitUrl(id));
  }
  scene.load.image(heroSheetKey('witch'), heroSheetUrl('witch'));
};

export const prepareHeroPixelTextures = (scene: Phaser.Scene): void => {
  parseSheetFrames(scene, heroSheetKey('witch'), heroFramePx('witch'));
  for (const id of HERO_IDS) {
    if (scene.textures.exists(heroPortraitKey(id))) {
      nearest(scene.textures.get(heroPortraitKey(id)));
    }
  }
};

export const heroSheetReady = (scene: Phaser.Scene, id: string, team: TeamId): boolean => {
  if (!usesHeroPixels(id)) {
    return false;
  }
  const key = heroSheetKey(id, team);
  return scene.textures.exists(key) && scene.textures.get(key).frameTotal > 1;
};

export const resolvedPortraitKey = (
  scene: Phaser.Scene,
  id: HeroId,
  team: TeamId = 'alpha',
): string | undefined => {
  const teamKey = heroPortraitKey(id, team);
  if (scene.textures.exists(teamKey)) {
    return teamKey;
  }
  const src = heroPortraitSourceKey(id);
  if (scene.textures.exists(src)) {
    return src;
  }
  return undefined;
};
