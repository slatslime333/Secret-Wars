import Phaser from 'phaser';
import type { TeamId } from '../../config/hero';
import { HERO_IDS, type HeroId } from '../roster';
import {
  HERO_FRAME,
  TEAM_BAND,
  TEAM_CHROMA,
  heroPortraitKey,
  heroPortraitSourceKey,
  heroPortraitUrl,
  heroSheetKey,
  heroSheetSourceKey,
  heroSheetUrl,
  isPixelHeroId,
} from './spec';

const nearest = (texture: Phaser.Textures.Texture): void => {
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
};

const sourceImage = (scene: Phaser.Scene, key: string): HTMLImageElement | HTMLCanvasElement | undefined => {
  if (!scene.textures.exists(key)) {
    return undefined;
  }
  return scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
};

const recolorChroma = (
  source: CanvasImageSource,
  width: number,
  height: number,
  rgb: readonly [number, number, number],
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === TEAM_CHROMA.r && data[i + 1] === TEAM_CHROMA.g && data[i + 2] === TEAM_CHROMA.b) {
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

const addSheetFromCanvas = (scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void => {
  if (scene.textures.exists(key) && scene.textures.get(key).frameTotal > 1) {
    return;
  }
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const canvasTex = scene.textures.addCanvas(key, canvas);
  if (!canvasTex) {
    return;
  }
  nearest(canvasTex);
  scene.textures.addSpriteSheet('', canvasTex, {
    frameWidth: HERO_FRAME,
    frameHeight: HERO_FRAME,
  });
  nearest(scene.textures.get(key));
};

const parseSheetFrames = (scene: Phaser.Scene, key: string): void => {
  if (!scene.textures.exists(key)) {
    return;
  }
  const texture = scene.textures.get(key);
  nearest(texture);
  if (texture.frameTotal > 1) {
    return;
  }
  scene.textures.addSpriteSheet('', texture, {
    frameWidth: HERO_FRAME,
    frameHeight: HERO_FRAME,
  });
};

export const preloadHeroPixels = (scene: Phaser.Scene): void => {
  for (const id of HERO_IDS) {
    if (id === 'ninja') {
      scene.load.image(heroSheetSourceKey(id), heroSheetUrl(id));
      scene.load.image(heroPortraitSourceKey(id), heroPortraitUrl(id));
    } else {
      scene.load.image(heroSheetKey(id), heroSheetUrl(id));
      scene.load.image(heroPortraitKey(id), heroPortraitUrl(id));
    }
  }
};

export const prepareHeroPixelTextures = (scene: Phaser.Scene): void => {
  const teams: TeamId[] = ['alpha', 'bravo'];
  const ninjaSheet = sourceImage(scene, heroSheetSourceKey('ninja'));
  if (ninjaSheet) {
    nearest(scene.textures.get(heroSheetSourceKey('ninja')));
    for (const team of teams) {
      addSheetFromCanvas(
        scene,
        heroSheetKey('ninja', team),
        recolorChroma(ninjaSheet, ninjaSheet.width, ninjaSheet.height, TEAM_BAND[team]),
      );
    }
  }
  const ninjaPortrait = sourceImage(scene, heroPortraitSourceKey('ninja'));
  if (ninjaPortrait) {
    nearest(scene.textures.get(heroPortraitSourceKey('ninja')));
    for (const team of teams) {
      const key = heroPortraitKey('ninja', team);
      if (scene.textures.exists(key)) {
        nearest(scene.textures.get(key));
        continue;
      }
      const canvas = recolorChroma(
        ninjaPortrait,
        ninjaPortrait.width,
        ninjaPortrait.height,
        TEAM_BAND[team],
      );
      const texture = scene.textures.addCanvas(key, canvas);
      if (texture) {
        nearest(texture);
      }
    }
  }
  for (const id of HERO_IDS) {
    if (id === 'ninja') {
      continue;
    }
    parseSheetFrames(scene, heroSheetKey(id));
    if (scene.textures.exists(heroPortraitKey(id))) {
      nearest(scene.textures.get(heroPortraitKey(id)));
    }
  }
};

export const heroSheetReady = (scene: Phaser.Scene, id: string, team: TeamId): boolean => {
  if (!isPixelHeroId(id)) {
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
