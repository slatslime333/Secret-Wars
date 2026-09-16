import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { COLORS } from '../ui/theme';
import type { CardinalFacing } from './drawNinja';

export const WITCH_SHEET = 'witch-sheet';
export const WITCH_SHEET_ALPHA = 'witch-sheet-alpha';
export const WITCH_SHEET_BRAVO = 'witch-sheet-bravo';
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

/** Magenta brim sits this far below the hat tip; boots/orb are lower. */
const HAT_BAND_FROM_TIP = 6;
const HAT_BAND_SPAN = 15;

export type WitchSpritePose = {
  facing: CardinalFacing;
  attacking?: boolean;
  staffRaise?: number;
  hitFlash?: boolean;
  rival?: boolean;
  moving?: boolean;
  walkFrame?: number;
  now?: number;
};

export const witchSheetUrl = (): string => new URL('assets/heroes/witch.png', document.baseURI).href;

export const witchSheetKey = (team?: TeamId, rival?: boolean): string =>
  team === 'bravo' || (team !== 'alpha' && Boolean(rival)) ? WITCH_SHEET_BRAVO : WITCH_SHEET_ALPHA;

export const preloadWitchSheet = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(WITCH_SHEET)) {
    return;
  }
  scene.load.spritesheet(WITCH_SHEET, witchSheetUrl(), {
    frameWidth: WITCH_FRAME_W,
    frameHeight: WITCH_FRAME_H,
  });
};

const unpack = (hex: number): [number, number, number] => [
  (hex >> 16) & 255,
  (hex >> 8) & 255,
  hex & 255,
];

const isHatBand = (r: number, g: number, b: number, a: number): boolean =>
  a >= 200 && r > 150 && g < 105 && r - g > 70 && b < r - 20 && b > 70;

const paintHatBand = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  dark: number,
  bright: number,
): void => {
  const darkRgb = unpack(dark);
  const brightRgb = unpack(bright);
  const rows = Math.floor(height / WITCH_FRAME_H);
  const cols = Math.floor(width / WITCH_FRAME_W);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const ox = col * WITCH_FRAME_W;
      const oy = row * WITCH_FRAME_H;
      let hatTop = -1;
      for (let fy = 0; fy < WITCH_FRAME_H && hatTop < 0; fy += 1) {
        for (let fx = 0; fx < WITCH_FRAME_W; fx += 1) {
          const i = ((oy + fy) * width + (ox + fx)) * 4;
          if (data[i + 3] >= 180 && data[i] + data[i + 1] + data[i + 2] > 30) {
            hatTop = fy;
            break;
          }
        }
      }
      if (hatTop < 0) {
        continue;
      }
      const y0 = hatTop + HAT_BAND_FROM_TIP;
      const y1 = y0 + HAT_BAND_SPAN;
      for (let fy = y0; fy <= y1; fy += 1) {
        if (fy < 0 || fy >= WITCH_FRAME_H) {
          continue;
        }
        for (let fx = 0; fx < WITCH_FRAME_W; fx += 1) {
          const i = ((oy + fy) * width + (ox + fx)) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (!isHatBand(r, g, b, a)) {
            continue;
          }
          const t = Phaser.Math.Clamp((r - 150) / 105, 0, 1);
          data[i] = Math.round(darkRgb[0] + (brightRgb[0] - darkRgb[0]) * t);
          data[i + 1] = Math.round(darkRgb[1] + (brightRgb[1] - darkRgb[1]) * t);
          data[i + 2] = Math.round(darkRgb[2] + (brightRgb[2] - darkRgb[2]) * t);
        }
      }
    }
  }
};

const bakeTeamSheet = (scene: Phaser.Scene, key: string, dark: number, bright: number): void => {
  if (scene.textures.exists(key) || !scene.textures.exists(WITCH_SHEET)) {
    return;
  }
  const source = scene.textures.get(WITCH_SHEET).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
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
    paintHatBand(image.data, width, height, dark, bright);
    ctx.putImageData(image, 0, 0);
  } catch {
    canvas.refresh();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return;
  }
  canvas.refresh();
  scene.textures.addSpriteSheet('', canvas, {
    frameWidth: WITCH_FRAME_W,
    frameHeight: WITCH_FRAME_H,
  });
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

export const ensureWitchTeamSheets = (scene: Phaser.Scene): void => {
  bakeTeamSheet(scene, WITCH_SHEET_ALPHA, COLORS.cyanDark, COLORS.cyan);
  bakeTeamSheet(scene, WITCH_SHEET_BRAVO, COLORS.red, COLORS.redBright);
};

export const filterWitchSheet = (scene: Phaser.Scene): void => {
  if (!scene.textures.exists(WITCH_SHEET)) {
    return;
  }
  scene.textures.get(WITCH_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST);
  ensureWitchTeamSheets(scene);
};

export const witchFrameIndex = (pose: WitchSpritePose): number => {
  const row = ROW[pose.facing] ?? 0;
  let col = 0;
  if (pose.attacking) {
    const raise = pose.staffRaise ?? 0;
    col = raise < 0.34 ? 5 : raise < 0.72 ? 6 : 7;
  } else if (pose.moving) {
    col = 1 + ((pose.walkFrame ?? 0) % 4);
  }
  return row * WITCH_COLS + col;
};

export const applyWitchSprite = (sprite: Phaser.GameObjects.Sprite, pose: WitchSpritePose): void => {
  sprite.setFrame(witchFrameIndex(pose));
  if (pose.hitFlash) {
    sprite.setTint(0xffe8ff);
  } else {
    sprite.clearTint();
  }
};

export const createWitchSprite = (
  scene: Phaser.Scene,
  x = 0,
  y = WITCH_FEET_Y,
  options: { rival?: boolean; team?: TeamId } = {},
): Phaser.GameObjects.Sprite | undefined => {
  const key = witchSheetKey(options.team, options.rival);
  const sheet = scene.textures.exists(key) ? key : WITCH_SHEET;
  if (!scene.textures.exists(sheet)) {
    return undefined;
  }
  const sprite = scene.add.sprite(x, y, sheet, 0);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(WITCH_WORLD_SCALE);
  applyWitchSprite(sprite, { facing: options.rival ? 'west' : 'south' });
  return sprite;
};
