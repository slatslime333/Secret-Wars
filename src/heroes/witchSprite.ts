import Phaser from 'phaser';
import type { CardinalFacing } from './drawNinja';

export const WITCH_SHEET = 'witch-sheet';
export const WITCH_FRAME_W = 80;
export const WITCH_FRAME_H = 80;
export const WITCH_COLS = 8;
export const WITCH_WORLD_SCALE = 0.92;
export const WITCH_FEET_Y = 16;

const ROW: Record<CardinalFacing, number> = {
  south: 0,
  west: 1,
  east: 2,
  north: 3,
};

export type WitchSpritePose = {
  facing: CardinalFacing;
  attacking?: boolean;
  staffRaise?: number;
  hitFlash?: boolean;
  rival?: boolean;
  moving?: boolean;
  now?: number;
};

export const witchSheetUrl = (): string => new URL('assets/heroes/witch.png', document.baseURI).href;

export const preloadWitchSheet = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(WITCH_SHEET)) {
    return;
  }
  scene.load.spritesheet(WITCH_SHEET, witchSheetUrl(), {
    frameWidth: WITCH_FRAME_W,
    frameHeight: WITCH_FRAME_H,
  });
};

export const filterWitchSheet = (scene: Phaser.Scene): void => {
  if (!scene.textures.exists(WITCH_SHEET)) {
    return;
  }
  scene.textures.get(WITCH_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

export const witchFrameIndex = (pose: WitchSpritePose): number => {
  const row = ROW[pose.facing] ?? 0;
  let col = 0;
  if (pose.attacking) {
    const raise = pose.staffRaise ?? 0;
    col = raise < 0.34 ? 5 : raise < 0.72 ? 6 : 7;
  } else if (pose.moving) {
    col = 1 + (Math.floor((pose.now ?? 0) / 120) % 4);
  }
  return row * WITCH_COLS + col;
};

export const applyWitchSprite = (sprite: Phaser.GameObjects.Sprite, pose: WitchSpritePose): void => {
  sprite.setFrame(witchFrameIndex(pose));
  if (pose.hitFlash) {
    sprite.setTint(0xffe8ff);
  } else if (pose.rival) {
    sprite.setTint(0xc080d8);
  } else {
    sprite.clearTint();
  }
};

export const createWitchSprite = (scene: Phaser.Scene, x = 0, y = WITCH_FEET_Y): Phaser.GameObjects.Sprite | undefined => {
  if (!scene.textures.exists(WITCH_SHEET)) {
    return undefined;
  }
  const sprite = scene.add.sprite(x, y, WITCH_SHEET, 0);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(WITCH_WORLD_SCALE);
  applyWitchSprite(sprite, { facing: 'south' });
  return sprite;
};
