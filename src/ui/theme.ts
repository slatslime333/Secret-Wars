import { getViewportSize } from '../device';

export const DEFAULT_WIDTH = 960;
export const DEFAULT_HEIGHT = 540;
export const GAME_WIDTH = DEFAULT_WIDTH;
export const GAME_HEIGHT = DEFAULT_HEIGHT;

export type GameSizeInfo = {
  width: number;
  height: number;
  isPortrait: boolean;
  aspect: number;
};

/**
 * Logical canvas size matching the visible viewport aspect ratio.
 *
 * Landscape keeps a 540-tall design and stretches width so phones, tablets,
 * and foldables (including ultra-wide cover screens) fill the display with
 * no letterboxing. Portrait is only used on desktop windows; mobile portrait
 * is blocked by the rotate overlay.
 */
export function getGameSize(
  winWidth?: number,
  winHeight?: number,
): GameSizeInfo {
  const viewport = getViewportSize();
  const w = Math.max(winWidth ?? viewport.width, 320);
  const h = Math.max(winHeight ?? viewport.height, 240);
  const aspect = w / h;
  const isPortrait = aspect < 1;

  if (!isPortrait) {
    const height = DEFAULT_HEIGHT;
    const width = Math.round(height * aspect);
    return { width, height, isPortrait, aspect };
  }

  const width = DEFAULT_HEIGHT;
  const height = Math.round(width / aspect);
  return { width, height, isPortrait, aspect };
}

export const COLORS = {
  ink: 0x070a12,
  inkSoft: 0x111827,
  panel: 0x172235,
  paper: 0xf6f1de,
  muted: 0x8fa1ac,
  cyan: 0x49dce1,
  cyanDark: 0x147d8a,
  red: 0xa71d31,
  redBright: 0xf03b45,
  orange: 0xff7a1a,
  yellow: 0xffc928,
} as const;

export const FONTS = {
  display: '"Arial Black", Impact, sans-serif',
  body: 'Arial, sans-serif',
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
