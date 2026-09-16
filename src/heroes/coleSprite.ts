import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { COLORS } from '../ui/theme';
import type { CardinalFacing } from './drawNinja';

export const COLE_SHEET = 'cole-sheet';
export const COLE_SHEET_ALPHA = 'cole-sheet-alpha';
export const COLE_SHEET_BRAVO = 'cole-sheet-bravo';
export const COLE_FRAME_W = 80;
export const COLE_FRAME_H = 80;
export const COLE_COLS = 8;
export const COLE_WORLD_SCALE = 0.92;
export const COLE_FEET_Y = 16;

const ROW: Record<CardinalFacing, number> = {
  south: 0,
  west: 1,
  east: 2,
  north: 3,
};

export type ColeSpritePose = {
  facing: CardinalFacing;
  attacking?: boolean;
  charge?: number;
  hitFlash?: boolean;
  rival?: boolean;
  moving?: boolean;
  walkFrame?: number;
  now?: number;
};

export const coleSheetUrl = (): string => new URL('assets/heroes/cole.png', document.baseURI).href;

export const coleSheetKey = (team?: TeamId, rival?: boolean): string =>
  team === 'bravo' || (team !== 'alpha' && Boolean(rival)) ? COLE_SHEET_BRAVO : COLE_SHEET_ALPHA;

export const preloadColeSheet = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(COLE_SHEET)) {
    return;
  }
  scene.load.spritesheet(COLE_SHEET, coleSheetUrl(), {
    frameWidth: COLE_FRAME_W,
    frameHeight: COLE_FRAME_H,
  });
};

const unpack = (hex: number): [number, number, number] => [
  (hex >> 16) & 255,
  (hex >> 8) & 255,
  hex & 255,
];

/** Baked bolts are cyan-family; jacket/skin are warm, so this does not hit the body. */
const isSpark = (r: number, g: number, b: number, a: number): boolean =>
  a >= 180 && b > 110 && g > 70 && b > r + 8 && g + b > r + 80;

const paintSparks = (data: Uint8ClampedArray, _width: number, _height: number, dark: number, bright: number): void => {
  const darkRgb = unpack(dark);
  const brightRgb = unpack(bright);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (!isSpark(r, g, b, a)) {
      continue;
    }
    const t = Phaser.Math.Clamp((g + b - 140) / 280, 0, 1);
    data[i] = Math.round(darkRgb[0] + (brightRgb[0] - darkRgb[0]) * t);
    data[i + 1] = Math.round(darkRgb[1] + (brightRgb[1] - darkRgb[1]) * t);
    data[i + 2] = Math.round(darkRgb[2] + (brightRgb[2] - darkRgb[2]) * t);
  }
};

const bakeTeamSheet = (scene: Phaser.Scene, key: string, dark: number, bright: number): void => {
  if (scene.textures.exists(key) || !scene.textures.exists(COLE_SHEET)) {
    return;
  }
  const source = scene.textures.get(COLE_SHEET).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
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
    paintSparks(image.data, width, height, dark, bright);
    ctx.putImageData(image, 0, 0);
  } catch {
    canvas.refresh();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return;
  }
  canvas.refresh();
  scene.textures.addSpriteSheet('', canvas, {
    frameWidth: COLE_FRAME_W,
    frameHeight: COLE_FRAME_H,
  });
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

export const ensureColeTeamSheets = (scene: Phaser.Scene): void => {
  bakeTeamSheet(scene, COLE_SHEET_ALPHA, COLORS.cyanDark, COLORS.cyan);
  bakeTeamSheet(scene, COLE_SHEET_BRAVO, COLORS.red, COLORS.redBright);
};

export const filterColeSheet = (scene: Phaser.Scene): void => {
  if (!scene.textures.exists(COLE_SHEET)) {
    return;
  }
  scene.textures.get(COLE_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST);
  ensureColeTeamSheets(scene);
};

export const coleFrameIndex = (pose: ColeSpritePose): number => {
  const row = ROW[pose.facing] ?? 0;
  let col = 0;
  if (pose.attacking) {
    const charge = pose.charge ?? 0;
    col = charge < 0.34 ? 5 : charge < 0.72 ? 6 : 7;
  } else if (pose.moving) {
    col = 1 + ((pose.walkFrame ?? 0) % 4);
  }
  return row * COLE_COLS + col;
};

export const applyColeSprite = (sprite: Phaser.GameObjects.Sprite, pose: ColeSpritePose): void => {
  sprite.setFrame(coleFrameIndex(pose));
  if (pose.hitFlash) {
    sprite.setTint(0xfff4d8);
  } else {
    sprite.clearTint();
  }
};

export const createColeSprite = (
  scene: Phaser.Scene,
  x = 0,
  y = COLE_FEET_Y,
  options: { rival?: boolean; team?: TeamId } = {},
): Phaser.GameObjects.Sprite | undefined => {
  const key = coleSheetKey(options.team, options.rival);
  const sheet = scene.textures.exists(key) ? key : COLE_SHEET;
  if (!scene.textures.exists(sheet)) {
    return undefined;
  }
  const sprite = scene.add.sprite(x, y, sheet, 0);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(COLE_WORLD_SCALE);
  applyColeSprite(sprite, { facing: options.rival ? 'west' : 'south' });
  return sprite;
};
