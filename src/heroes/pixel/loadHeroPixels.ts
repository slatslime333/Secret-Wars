import Phaser from 'phaser';
import type { TeamId } from '../../config/hero';
import { HERO_IDS, type HeroId } from '../roster';
import {
  TEAM_BAND,
  TEAM_CHROMA,
  heroFramePx,
  heroPortraitKey,
  heroPortraitSourceKey,
  heroPortraitUrl,
  heroSheetKey,
  heroSheetSourceKey,
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

const applyBandanaChroma = (
  scene: Phaser.Scene,
  srcKey: string,
  destKey: string,
  rgb: readonly [number, number, number],
): void => {
  if (scene.textures.exists(destKey) || !scene.textures.exists(srcKey)) {
    return;
  }
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvasTex = scene.textures.createCanvas(destKey, src.width, src.height);
  if (!canvasTex) {
    return;
  }
  const ctx = canvasTex.getContext();
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, src.width, src.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] === TEAM_CHROMA.r && px[i + 1] === TEAM_CHROMA.g && px[i + 2] === TEAM_CHROMA.b && px[i + 3] > 0) {
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
    }
  }
  ctx.putImageData(data, 0, 0);
  canvasTex.refresh();
};

export const preloadHeroPixels = (scene: Phaser.Scene): void => {
  for (const id of HERO_IDS) {
    if (id === 'ninja') {
      scene.load.image(heroSheetSourceKey('ninja'), heroSheetUrl('ninja'));
      scene.load.image(heroPortraitSourceKey('ninja'), heroPortraitUrl('ninja'));
    } else {
      scene.load.image(heroSheetKey(id), heroSheetUrl(id));
      scene.load.image(heroPortraitKey(id), heroPortraitUrl(id));
    }
  }
};

export const prepareHeroPixelTextures = (scene: Phaser.Scene): void => {
  applyBandanaChroma(scene, heroSheetSourceKey('ninja'), heroSheetKey('ninja', 'alpha'), TEAM_BAND.alpha);
  applyBandanaChroma(scene, heroSheetSourceKey('ninja'), heroSheetKey('ninja', 'bravo'), TEAM_BAND.bravo);
  applyBandanaChroma(scene, heroPortraitSourceKey('ninja'), heroPortraitKey('ninja', 'alpha'), TEAM_BAND.alpha);
  applyBandanaChroma(scene, heroPortraitSourceKey('ninja'), heroPortraitKey('ninja', 'bravo'), TEAM_BAND.bravo);
  parseSheetFrames(scene, heroSheetKey('ninja', 'alpha'), heroFramePx('ninja'));
  parseSheetFrames(scene, heroSheetKey('ninja', 'bravo'), heroFramePx('ninja'));
  for (const id of HERO_IDS) {
    if (id !== 'ninja') {
      parseSheetFrames(scene, heroSheetKey(id), heroFramePx(id));
    }
    const portrait = id === 'ninja' ? heroPortraitKey('ninja', 'alpha') : heroPortraitKey(id);
    if (scene.textures.exists(portrait)) {
      nearest(scene.textures.get(portrait));
    }
    if (id === 'ninja' && scene.textures.exists(heroPortraitKey('ninja', 'bravo'))) {
      nearest(scene.textures.get(heroPortraitKey('ninja', 'bravo')));
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
