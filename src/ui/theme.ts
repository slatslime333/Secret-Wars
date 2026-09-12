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
 * Canvas size is the visible viewport. The game fills the screen instead of
 * fitting a 960x540 (or similar) rectangle inside it.
 */
export function getGameSize(
  winWidth?: number,
  winHeight?: number,
): GameSizeInfo {
  const viewport = getViewportSize();
  const width = Math.max(Math.round(winWidth ?? viewport.width), 320);
  const height = Math.max(Math.round(winHeight ?? viewport.height), 240);
  return {
    width,
    height,
    isPortrait: width < height,
    aspect: width / height,
  };
}

export type TouchControlLayout = {
  isPortrait: boolean;
  radius: number;
  buttonRadius: number;
  abilityRadius: number;
  ultimateRadius: number;
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  block: { x: number; y: number };
  dash: { x: number; y: number };
  ability1: { x: number; y: number };
  ability2: { x: number; y: number };
  ultimate: { x: number; y: number };
};

/** Thumb-reachable stick and button anchors for the current screen. */
export function getTouchControlLayout(width: number, height: number): TouchControlLayout {
  const isPortrait = width < height;
  const short = Math.min(width, height);
  const radius = Math.round(clamp(short * 0.125, 52, 76));
  const buttonRadius = 30;
  const abilityRadius = 34;
  const ultimateRadius = 40;
  const sideInset = Math.round(Math.max(radius + 32, short * 0.18));
  const bottomInset = Math.round(
    isPortrait ? Math.max(radius + 42, short * 0.13) : Math.max(radius + 32, short * 0.2),
  );
  const buttonLift = isPortrait ? bottomInset + Math.round(radius + 36) : Math.round(short * 0.42);
  const leftStick = { x: sideInset, y: height - bottomInset };
  const rightStick = { x: width - sideInset, y: height - bottomInset };
  const block = {
    x: width - (isPortrait ? sideInset + 84 : sideInset + 100),
    y: height - buttonLift,
  };
  const dash = {
    x: width - (isPortrait ? Math.max(56, sideInset - 24) : sideInset),
    y: height - buttonLift,
  };

  return {
    isPortrait,
    radius,
    buttonRadius,
    abilityRadius,
    ultimateRadius,
    leftStick,
    rightStick,
    block,
    dash,
    ability1: {
      x: Math.max(abilityRadius + 10, block.x - buttonRadius - abilityRadius - 12),
      y: block.y + 8,
    },
    ability2: {
      x: Math.min(block.x + 8, rightStick.x - radius * 0.2),
      y: Math.round((block.y + rightStick.y) * 0.52),
    },
    ultimate: {
      x: Math.round((leftStick.x + rightStick.x) / 2),
      y: height - Math.max(bottomInset, ultimateRadius + 18),
    },
  };
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

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
