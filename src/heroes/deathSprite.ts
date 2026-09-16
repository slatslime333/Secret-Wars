import Phaser from 'phaser';
import type { TeamId } from '../config/hero';
import { COLORS } from '../ui/theme';
import type { CardinalFacing } from './drawNinja';

export const DEATH_SHEET = 'death-sheet';
export const DEATH_SHEET_ALPHA = 'death-sheet-alpha';
export const DEATH_SHEET_BRAVO = 'death-sheet-bravo';
export const DEATH_FRAME_W = 80;
export const DEATH_FRAME_H = 80;
export const DEATH_COLS = 10;
export const DEATH_WORLD_SCALE = 0.92;
export const DEATH_FEET_Y = 16;

const ROW: Record<CardinalFacing, number> = {
  south: 0,
  west: 1,
  east: 2,
  north: 3,
};

export type DeathSpritePose = {
  facing: CardinalFacing;
  attacking?: boolean;
  swordAngleOffset?: number;
  batScale?: number;
  showUzi?: boolean;
  armLiftRight?: number;
  hitFlash?: boolean;
  rival?: boolean;
  moving?: boolean;
  walkFrame?: number;
  now?: number;
};

export const deathSheetUrl = (): string => new URL('assets/heroes/death.png', document.baseURI).href;

export const deathSheetKey = (team?: TeamId, rival?: boolean): string =>
  team === 'bravo' || (team !== 'alpha' && Boolean(rival)) ? DEATH_SHEET_BRAVO : DEATH_SHEET_ALPHA;

export const preloadDeathSheet = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(DEATH_SHEET)) {
    return;
  }
  scene.load.spritesheet(DEATH_SHEET, deathSheetUrl(), {
    frameWidth: DEATH_FRAME_W,
    frameHeight: DEATH_FRAME_H,
  });
};

const unpack = (hex: number): [number, number, number] => [
  (hex >> 16) & 255,
  (hex >> 8) & 255,
  hex & 255,
];

/** Stamped triangles are 240,44,48 / 255,92,72. Cloth and bat stay untouched. */
const isEye = (r: number, g: number, b: number, a: number): boolean =>
  a >= 180 && r > 200 && g < 110 && b < 110 && r > g + 80;

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
    const t = Phaser.Math.Clamp((r - 200) / 55, 0, 1);
    data[i] = Math.round(darkRgb[0] + (brightRgb[0] - darkRgb[0]) * t);
    data[i + 1] = Math.round(darkRgb[1] + (brightRgb[1] - darkRgb[1]) * t);
    data[i + 2] = Math.round(darkRgb[2] + (brightRgb[2] - darkRgb[2]) * t);
  }
};

const bakeTeamSheet = (scene: Phaser.Scene, key: string, dark: number, bright: number): void => {
  if (scene.textures.exists(key) || !scene.textures.exists(DEATH_SHEET)) {
    return;
  }
  const source = scene.textures.get(DEATH_SHEET).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
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
    frameWidth: DEATH_FRAME_W,
    frameHeight: DEATH_FRAME_H,
  });
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
};

export const ensureDeathTeamSheets = (scene: Phaser.Scene): void => {
  bakeTeamSheet(scene, DEATH_SHEET_ALPHA, COLORS.cyanDark, COLORS.cyan);
  bakeTeamSheet(scene, DEATH_SHEET_BRAVO, COLORS.red, COLORS.redBright);
};

export const filterDeathSheet = (scene: Phaser.Scene): void => {
  if (!scene.textures.exists(DEATH_SHEET)) {
    return;
  }
  scene.textures.get(DEATH_SHEET).setFilter(Phaser.Textures.FilterMode.NEAREST);
  ensureDeathTeamSheets(scene);
};

export const deathFrameIndex = (pose: DeathSpritePose): number => {
  const row = ROW[pose.facing] ?? 0;
  let col = 0;
  if (pose.attacking) {
    if (pose.showUzi) {
      col = 7;
    } else if ((pose.batScale ?? 1) >= 2.2) {
      col = (pose.armLiftRight ?? 0) > 0.48 ? 8 : 9;
    } else {
      const angle = pose.swordAngleOffset ?? 0;
      col = Math.sin(angle) >= 0 ? 6 : 5;
    }
  } else if (pose.moving) {
    col = 1 + ((pose.walkFrame ?? 0) % 4);
  }
  return row * DEATH_COLS + col;
};

export const applyDeathSprite = (sprite: Phaser.GameObjects.Sprite, pose: DeathSpritePose): void => {
  sprite.setFrame(deathFrameIndex(pose));
  if (pose.hitFlash) {
    sprite.setTint(0xffe0d8);
  } else {
    sprite.clearTint();
  }
};

export const createDeathSprite = (
  scene: Phaser.Scene,
  x = 0,
  y = DEATH_FEET_Y,
  options: { rival?: boolean; team?: TeamId } = {},
): Phaser.GameObjects.Sprite | undefined => {
  const key = deathSheetKey(options.team, options.rival);
  const sheet = scene.textures.exists(key) ? key : DEATH_SHEET;
  if (!scene.textures.exists(sheet)) {
    return undefined;
  }
  const sprite = scene.add.sprite(x, y, sheet, 0);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(DEATH_WORLD_SCALE);
  applyDeathSprite(sprite, { facing: options.rival ? 'west' : 'south' });
  return sprite;
};
