import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { COLORS } from '../ui/theme';
import type { CardinalFacing } from './drawNinja';

export const ROPE_SHEET = 'rope-sheet';
export const ROPE_SHEET_ALPHA = 'rope-sheet-alpha';
export const ROPE_SHEET_BRAVO = 'rope-sheet-bravo';
export const ROPE_FRAME_W = 80;
export const ROPE_FRAME_H = 80;
/** idle, the two drawn run poses, left shot, right shot, punch, grab, grab with both arms. */
export const ROPE_COLS = 8;
export const ROPE_WALK_FRAMES = 2;
const ROPE_COL_SHOT_L = 3;
const ROPE_COL_SHOT_R = 4;
const ROPE_COL_PUNCH = 5;
const ROPE_COL_GRAB = 6;
const ROPE_COL_GRAB_BOTH = 7;
export const ROPE_WORLD_SCALE = 0.92;
export const ROPE_FEET_Y = 16;

export type RopeAction = 'shot' | 'punch' | 'grab';

const ROW: Record<CardinalFacing, number> = {
  south: 0,
  west: 1,
  east: 2,
  north: 3,
};

export type RopeSpritePose = {
  facing: CardinalFacing;
  attacking?: boolean;
  ropeAction?: RopeAction;
  armLiftLeft?: number;
  armLiftRight?: number;
  hitFlash?: boolean;
  rival?: boolean;
  moving?: boolean;
  walkFrame?: number;
  now?: number;
};

export const ropeSheetUrl = (): string => new URL('assets/heroes/rope.png', document.baseURI).href;

export const ropeSheetKey = (team?: TeamId, rival?: boolean): string =>
  team === 'bravo' || (team !== 'alpha' && Boolean(rival)) ? ROPE_SHEET_BRAVO : ROPE_SHEET_ALPHA;

export const preloadRopeSheet = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(ROPE_SHEET)) {
    return;
  }
  scene.load.spritesheet(ROPE_SHEET, ropeSheetUrl(), {
    frameWidth: ROPE_FRAME_W,
    frameHeight: ROPE_FRAME_H,
  });
};

const unpack = (hex: number): [number, number, number] => [
  (hex >> 16) & 255,
  (hex >> 8) & 255,
  hex & 255,
];

/** Orange triangles on the source sheet. Brown wraps stay untouched. */
const isEye = (r: number, g: number, b: number, a: number): boolean =>
  a >= 180 && r > 210 && g > 70 && g < 180 && b < 90 && r > g + 40;

const paintEyes = (data: Uint8ClampedArray, dark: number, bright: number): void => {
  const darkRgb = unpack(dark);
  const brightRgb = unpack(bright);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (!isEye(r, g, b, a)) {
      continue;
    }
    const t = Phaser.Math.Clamp((r + g - 280) / 120, 0, 1);
    data[i] = Math.round(darkRgb[0] + (brightRgb[0] - darkRgb[0]) * t);
    data[i + 1] = Math.round(darkRgb[1] + (brightRgb[1] - darkRgb[1]) * t);
    data[i + 2] = Math.round(darkRgb[2] + (brightRgb[2] - darkRgb[2]) * t);
  }
};

const bakeTeamSheet = (scene: Phaser.Scene, key: string, dark: number, bright: number): void => {
  if (scene.textures.exists(key) || !scene.textures.exists(ROPE_SHEET)) {
    return;
  }
  const source = scene.textures.get(ROPE_SHEET).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
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
    paintEyes(image.data, dark, bright);
    ctx.putImageData(image, 0, 0);
  } catch {
    canvas.refresh();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return;
  }
  canvas.refresh();
  scene.textures.addSpriteSheet('', canvas, {
    frameWidth: ROPE_FRAME_W,
    frameHeight: ROPE_FRAME_H,
  });
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

export const ensureRopeTeamSheets = (scene: Phaser.Scene): void => {
  bakeTeamSheet(scene, ROPE_SHEET_ALPHA, COLORS.cyanDark, COLORS.cyan);
  bakeTeamSheet(scene, ROPE_SHEET_BRAVO, COLORS.red, COLORS.redBright);
};

export const filterRopeSheet = (scene: Phaser.Scene): void => {
  if (!scene.textures.exists(ROPE_SHEET)) {
    return;
  }
  scene.textures.get(ROPE_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST);
  ensureRopeTeamSheets(scene);
};

export const ropeFrameIndex = (pose: RopeSpritePose): number => {
  const row = ROW[pose.facing] ?? 0;
  let col = 0;
  if (pose.attacking) {
    const action = pose.ropeAction ?? 'shot';
    if (action === 'punch') {
      col = ROPE_COL_PUNCH;
    } else if (action === 'grab') {
      const left = pose.armLiftLeft ?? 0;
      const right = pose.armLiftRight ?? 0;
      col = left > 0.7 && right > 0.7 ? ROPE_COL_GRAB_BOTH : ROPE_COL_GRAB;
    } else {
      col = (pose.armLiftRight ?? 0) > (pose.armLiftLeft ?? 0) ? ROPE_COL_SHOT_R : ROPE_COL_SHOT_L;
    }
  } else if (pose.moving) {
    col = 1 + ((pose.walkFrame ?? 0) % ROPE_WALK_FRAMES);
  }
  return row * ROPE_COLS + col;
};

export const applyRopeSprite = (sprite: Phaser.GameObjects.Sprite, pose: RopeSpritePose): void => {
  sprite.setFrame(ropeFrameIndex(pose));
  if (pose.hitFlash) {
    sprite.setTint(0xffe8d0);
  } else {
    sprite.clearTint();
  }
};

export const createRopeSprite = (
  scene: Phaser.Scene,
  x = 0,
  y = ROPE_FEET_Y,
  options: { rival?: boolean; team?: TeamId } = {},
): Phaser.GameObjects.Sprite | undefined => {
  const key = ropeSheetKey(options.team, options.rival);
  const sheet = scene.textures.exists(key) ? key : ROPE_SHEET;
  if (!scene.textures.exists(sheet)) {
    return undefined;
  }
  const sprite = scene.add.sprite(x, y, sheet, 0);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(ROPE_WORLD_SCALE);
  applyRopeSprite(sprite, { facing: options.rival ? 'west' : 'south' });
  return sprite;
};
