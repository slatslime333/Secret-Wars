import type { TeamId } from '../../config/hero';
import type { CardinalFacing } from '../drawNinja';
import { HERO_IDS, type HeroId } from '../roster';

/** Matches `scripts/renderHeroPixels.py`. */
export const HERO_FRAME = 64;
export const HERO_SHEET_COLS = [
  'idle0',
  'idle1',
  'walk0',
  'walk1',
  'walk2',
  'atk0',
  'atk1',
  'atk2',
  'hurt',
  'down',
] as const;
export const HERO_SHEET_ROWS = ['south', 'north', 'east', 'west'] as const;

export type HeroPoseName = (typeof HERO_SHEET_COLS)[number];

/** ~34px on-screen height so fighters stay the same world size as the old graphics. */
export const HERO_PIXEL_SCALE = 0.85;
export const HERO_PIXEL_ORIGIN = { x: 0.5, y: 0.61 };

export const HERO_WALK_FRAME_MS = 140;
export const HERO_IDLE_FRAME_MS = 480;
export const HERO_WALK_SPEED_SQ = 320;

export const TEAM_CHROMA = { r: 255, g: 0, b: 255 } as const;
export const TEAM_BAND: Record<TeamId, readonly [number, number, number]> = {
  alpha: [0x49, 0xdc, 0xe1],
  bravo: [0xf0, 0x3b, 0x45],
};

export const isPixelHeroId = (id: string): id is HeroId =>
  (HERO_IDS as readonly string[]).includes(id);

export const heroSheetUrl = (id: HeroId): string => `assets/characters/${id}/sheet.png`;
export const heroPortraitUrl = (id: HeroId): string => `assets/portraits/${id}.png`;

export const heroSheetSourceKey = (id: HeroId): string => `hero-sheet-src-${id}`;
export const heroPortraitSourceKey = (id: HeroId): string => `hero-portrait-src-${id}`;

export const heroSheetKey = (id: HeroId, team: TeamId = 'alpha'): string =>
  id === 'ninja' ? `hero-sheet-ninja-${team}` : `hero-sheet-${id}`;

export const heroPortraitKey = (id: HeroId, team: TeamId = 'alpha'): string =>
  id === 'ninja' ? `hero-portrait-ninja-${team}` : `hero-portrait-${id}`;

export const heroFrameIndex = (facing: CardinalFacing, pose: HeroPoseName): number => {
  const col = HERO_SHEET_COLS.indexOf(pose);
  const row = HERO_SHEET_ROWS.indexOf(facing);
  return row * HERO_SHEET_COLS.length + col;
};
