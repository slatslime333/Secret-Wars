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

export function getGameSize(
  winWidth?: number,
  winHeight?: number,
): GameSizeInfo {
  const w = Math.max(
    winWidth ?? (typeof window !== 'undefined' ? window.innerWidth : DEFAULT_WIDTH),
    320,
  );
  const h = Math.max(
    winHeight ?? (typeof window !== 'undefined' ? window.innerHeight : DEFAULT_HEIGHT),
    240,
  );
  const aspect = w / h;
  const isPortrait = aspect < 1;

  if (!isPortrait) {
    // Landscape: maintain 540 base height, scale width to match device aspect ratio.
    const height = DEFAULT_HEIGHT;
    const effectiveAspect = Math.min(aspect, 2.8);
    const width = Math.round(height * effectiveAspect);
    return { width, height, isPortrait, aspect };
  } else {
    // Portrait: maintain 540 base width, scale height to match device aspect ratio.
    const width = DEFAULT_HEIGHT;
    const effectiveAspect = Math.max(aspect, 1 / 2.8);
    const height = Math.round(width / effectiveAspect);
    return { width, height, isPortrait, aspect };
  }
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
