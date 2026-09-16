import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { COLORS } from '../ui/theme';
import type { CardinalFacing } from './drawNinja';

export const NINJA_SHEET = 'ninja-sheet';
export const NINJA_SHEET_ALPHA = 'ninja-sheet-alpha';
export const NINJA_SHEET_BRAVO = 'ninja-sheet-bravo';
export const NINJA_FRAME_W = 80;
export const NINJA_FRAME_H = 80;
export const NINJA_COLS = 8;
export const NINJA_WORLD_SCALE = 0.92;
export const NINJA_FEET_Y = 16;

const ROW: Record<CardinalFacing, number> = {
  south: 0,
  west: 1,
  east: 2,
  north: 3,
};

export type NinjaSpritePose = {
  facing: CardinalFacing;
  attacking?: boolean;
  swordAngleOffset?: number;
  charge?: number;
  hitFlash?: boolean;
  rival?: boolean;
  moving?: boolean;
  walkFrame?: number;
  now?: number;
};

export const ninjaSheetUrl = (): string => new URL('assets/heroes/ninja.png', document.baseURI).href;

export const ninjaSheetKey = (team?: TeamId, rival?: boolean): string =>
  team === 'bravo' || (team !== 'alpha' && Boolean(rival)) ? NINJA_SHEET_BRAVO : NINJA_SHEET_ALPHA;

export const preloadNinjaSheet = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(NINJA_SHEET)) {
    return;
  }
  scene.load.spritesheet(NINJA_SHEET, ninjaSheetUrl(), {
    frameWidth: NINJA_FRAME_W,
    frameHeight: NINJA_FRAME_H,
  });
};

const unpack = (hex: number): [number, number, number] => [
  (hex >> 16) & 255,
  (hex >> 8) & 255,
  hex & 255,
];

/** Headband, sash, wraps. Stamped eyes are 255,56,48 so they stay red. */
const isStripe = (r: number, g: number, b: number, a: number): boolean =>
  a >= 180 && r > 140 && r < 245 && g < 90 && r - g > 70 && b < 120;

const paintStripes = (data: Uint8ClampedArray, _width: number, _height: number, dark: number, bright: number): void => {
  const darkRgb = unpack(dark);
  const brightRgb = unpack(bright);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (!isStripe(r, g, b, a)) {
      continue;
    }
    const t = Phaser.Math.Clamp((r - 140) / 105, 0, 1);
    data[i] = Math.round(darkRgb[0] + (brightRgb[0] - darkRgb[0]) * t);
    data[i + 1] = Math.round(darkRgb[1] + (brightRgb[1] - darkRgb[1]) * t);
    data[i + 2] = Math.round(darkRgb[2] + (brightRgb[2] - darkRgb[2]) * t);
  }
};

const bakeTeamSheet = (scene: Phaser.Scene, key: string, dark: number, bright: number): void => {
  if (scene.textures.exists(key) || !scene.textures.exists(NINJA_SHEET)) {
    return;
  }
  const source = scene.textures.get(NINJA_SHEET).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
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
    paintStripes(image.data, width, height, dark, bright);
    ctx.putImageData(image, 0, 0);
  } catch {
    canvas.refresh();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return;
  }
  canvas.refresh();
  scene.textures.addSpriteSheet('', canvas, {
    frameWidth: NINJA_FRAME_W,
    frameHeight: NINJA_FRAME_H,
  });
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

export const ensureNinjaTeamSheets = (scene: Phaser.Scene): void => {
  bakeTeamSheet(scene, NINJA_SHEET_ALPHA, COLORS.cyanDark, COLORS.cyan);
  bakeTeamSheet(scene, NINJA_SHEET_BRAVO, COLORS.red, COLORS.redBright);
};

export const filterNinjaSheet = (scene: Phaser.Scene): void => {
  if (!scene.textures.exists(NINJA_SHEET)) {
    return;
  }
  scene.textures.get(NINJA_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST);
  ensureNinjaTeamSheets(scene);
};

export const ninjaFrameIndex = (pose: NinjaSpritePose): number => {
  const row = ROW[pose.facing] ?? 0;
  let col = 0;
  if (pose.attacking) {
    const angle = pose.swordAngleOffset ?? 0;
    col = angle < -0.2 ? 5 : angle < 0.5 ? 6 : 7;
  } else if (pose.moving) {
    col = 1 + ((pose.walkFrame ?? 0) % 4);
  }
  return row * NINJA_COLS + col;
};

export const applyNinjaSprite = (sprite: Phaser.GameObjects.Sprite, pose: NinjaSpritePose): void => {
  sprite.setFrame(ninjaFrameIndex(pose));
  if (pose.hitFlash) {
    sprite.setTint(0xfff4d8);
  } else {
    sprite.clearTint();
  }
};

export const createNinjaSprite = (
  scene: Phaser.Scene,
  x = 0,
  y = NINJA_FEET_Y,
  options: { rival?: boolean; team?: TeamId } = {},
): Phaser.GameObjects.Sprite | undefined => {
  const key = ninjaSheetKey(options.team, options.rival);
  const sheet = scene.textures.exists(key) ? key : NINJA_SHEET;
  if (!scene.textures.exists(sheet)) {
    return undefined;
  }
  const sprite = scene.add.sprite(x, y, sheet, 0);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(NINJA_WORLD_SCALE);
  applyNinjaSprite(sprite, { facing: options.rival ? 'west' : 'south' });
  return sprite;
};
