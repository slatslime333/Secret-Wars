import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { COLORS } from '../ui/theme';
import type { CardinalFacing } from './drawNinja';

export const MENDER_SHEET = 'mender-sheet';
export const MENDER_SHEET_ALPHA = 'mender-sheet-alpha';
export const MENDER_SHEET_BRAVO = 'mender-sheet-bravo';
export const MENDER_FRAME_W = 80;
export const MENDER_FRAME_H = 80;
export const MENDER_COLS = 8;
export const MENDER_WORLD_SCALE = 0.92;
export const MENDER_FEET_Y = 16;

const ROW: Record<CardinalFacing, number> = {
  south: 0,
  west: 1,
  east: 2,
  north: 3,
};

export type MenderSpritePose = {
  facing: CardinalFacing;
  attacking?: boolean;
  charge?: number;
  hitFlash?: boolean;
  rival?: boolean;
  moving?: boolean;
  walkFrame?: number;
  now?: number;
};

export const menderSheetUrl = (): string => new URL('assets/heroes/mender.png', document.baseURI).href;

export const menderSheetKey = (team?: TeamId, rival?: boolean): string =>
  team === 'bravo' || (team !== 'alpha' && Boolean(rival)) ? MENDER_SHEET_BRAVO : MENDER_SHEET_ALPHA;

export const preloadMenderSheet = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(MENDER_SHEET)) {
    return;
  }
  scene.load.spritesheet(MENDER_SHEET, menderSheetUrl(), {
    frameWidth: MENDER_FRAME_W,
    frameHeight: MENDER_FRAME_H,
  });
};

const unpack = (hex: number): [number, number, number] => [
  (hex >> 16) & 255,
  (hex >> 8) & 255,
  hex & 255,
];

/** Chest sash is stamped magenta so team bake does not hit blonde hair or the suit. */
const isSash = (r: number, g: number, b: number, a: number): boolean =>
  a >= 180 && r > 160 && g < 110 && r - g > 70 && b > 60 && b < r - 20;

const paintSash = (data: Uint8ClampedArray, _width: number, _height: number, dark: number, bright: number): void => {
  const darkRgb = unpack(dark);
  const brightRgb = unpack(bright);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (!isSash(r, g, b, a)) {
      continue;
    }
    const t = Phaser.Math.Clamp((r - 160) / 80, 0, 1);
    data[i] = Math.round(darkRgb[0] + (brightRgb[0] - darkRgb[0]) * t);
    data[i + 1] = Math.round(darkRgb[1] + (brightRgb[1] - darkRgb[1]) * t);
    data[i + 2] = Math.round(darkRgb[2] + (brightRgb[2] - darkRgb[2]) * t);
  }
};

const bakeTeamSheet = (scene: Phaser.Scene, key: string, dark: number, bright: number): void => {
  if (scene.textures.exists(key) || !scene.textures.exists(MENDER_SHEET)) {
    return;
  }
  const source = scene.textures.get(MENDER_SHEET).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const width = Number((source as HTMLImageElement).naturalWidth || source.width);
  const height = Number((source as HTMLImageElement).naturalHeight || source.height);
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) {
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  try {
    const image = ctx.getImageData(0, 0, width, height);
    paintSash(image.data, width, height, dark, bright);
    ctx.putImageData(image, 0, 0);
  } catch {
    canvas.refresh();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return;
  }
  canvas.refresh();
  scene.textures.addSpriteSheet('', canvas, {
    frameWidth: MENDER_FRAME_W,
    frameHeight: MENDER_FRAME_H,
  });
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

export const ensureMenderTeamSheets = (scene: Phaser.Scene): void => {
  bakeTeamSheet(scene, MENDER_SHEET_ALPHA, COLORS.cyanDark, COLORS.cyan);
  bakeTeamSheet(scene, MENDER_SHEET_BRAVO, COLORS.red, COLORS.redBright);
};

export const filterMenderSheet = (scene: Phaser.Scene): void => {
  if (!scene.textures.exists(MENDER_SHEET)) {
    return;
  }
  scene.textures.get(MENDER_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST);
  ensureMenderTeamSheets(scene);
};

export const menderFrameIndex = (pose: MenderSpritePose): number => {
  const row = ROW[pose.facing] ?? 0;
  let col = 0;
  if (pose.attacking) {
    const charge = pose.charge ?? 0;
    col = charge < 0.34 ? 5 : charge < 0.72 ? 6 : 7;
  } else if (pose.moving) {
    col = 1 + ((pose.walkFrame ?? 0) % 4);
  }
  return row * MENDER_COLS + col;
};

export const applyMenderSprite = (sprite: Phaser.GameObjects.Sprite, pose: MenderSpritePose): void => {
  sprite.setFrame(menderFrameIndex(pose));
  if (pose.hitFlash) {
    sprite.setTint(0xfff4d8);
  } else {
    sprite.clearTint();
  }
};

export const createMenderSprite = (
  scene: Phaser.Scene,
  x = 0,
  y = MENDER_FEET_Y,
  options: { rival?: boolean; team?: TeamId } = {},
): Phaser.GameObjects.Sprite | undefined => {
  const key = menderSheetKey(options.team, options.rival);
  const sheet = scene.textures.exists(key) ? key : MENDER_SHEET;
  if (!scene.textures.exists(sheet)) {
    return undefined;
  }
  const sprite = scene.add.sprite(x, y, sheet, 0);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(MENDER_WORLD_SCALE);
  applyMenderSprite(sprite, { facing: options.rival ? 'west' : 'south' });
  return sprite;
};
