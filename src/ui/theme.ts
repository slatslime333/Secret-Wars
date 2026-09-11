import { getViewportSize, isTouchPrimary, toLandscapeSize } from '../device';

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
 * Mobile is always landscape: height stays 540 and width stretches so the
 * canvas matches the phone. Desktop may still use a portrait window.
 */
export function getGameSize(
  winWidth?: number,
  winHeight?: number,
): GameSizeInfo {
  const viewport = getViewportSize();
  let w = Math.max(winWidth ?? viewport.width, 320);
  let h = Math.max(winHeight ?? viewport.height, 240);

  if (isTouchPrimary()) {
    const landscape = toLandscapeSize(w, h);
    w = landscape.width;
    h = landscape.height;
  }

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
