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

/**
 * Keep ~540 world units on the short axis so a Fold cover (or any short,
 * ultra-wide screen) shows a wider FOV instead of a zoomed-in character.
 */
export function getViewZoom(width: number, height: number): number {
  return clamp(Math.min(width, height) / DEFAULT_HEIGHT, 0.38, 2.2);
}

/** HUD / stick scale. Shrinks on short or ultra-wide displays. */
export function getUiScale(width: number, height: number): number {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const shortScale = short / DEFAULT_HEIGHT;
  const widePenalty = long / short > 2 ? 0.88 : 1;
  return clamp(shortScale * widePenalty, 0.42, 1.08);
}

export type TouchControlLayout = {
  isPortrait: boolean;
  uiScale: number;
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

/** Thumb-reachable stick and button anchors that shrink on short screens. */
export function getTouchControlLayout(width: number, height: number): TouchControlLayout {
  const isPortrait = width < height;
  const uiScale = getUiScale(width, height);
  const short = Math.min(width, height);
  const radius = Math.round(clamp(Math.min(64 * uiScale, short * 0.11), 30, 70));
  const buttonRadius = Math.round(clamp(radius * 0.7, 18, 32));
  const sideInset = Math.round(clamp(radius + 22 * uiScale, 40, short * 0.2));
  const bottomInset = Math.round(
    isPortrait ? clamp(radius + 36 * uiScale, 48, short * 0.14) : clamp(radius + 24 * uiScale, 44, short * 0.2),
  );
  const buttonLift = isPortrait
    ? bottomInset + Math.round(radius + 28 * uiScale)
    : Math.round(clamp(short * 0.38, buttonRadius + 36, short * 0.46));
  const abilityRadius = Math.round(clamp(buttonRadius * 1.18, 24, 38));
  const ultimateRadius = Math.round(clamp(buttonRadius * 1.42, 28, 44));
  const leftStick = { x: sideInset, y: height - bottomInset };
  const rightStick = { x: width - sideInset, y: height - bottomInset };
  const block = {
    x: width - (isPortrait ? sideInset + buttonRadius * 2.4 : sideInset + buttonRadius * 2.8),
    y: height - buttonLift,
  };
  const dash = {
    x: width - (isPortrait ? Math.max(buttonRadius + 16, sideInset - buttonRadius) : sideInset),
    y: height - buttonLift,
  };

  return {
    isPortrait,
    uiScale,
    radius,
    buttonRadius,
    abilityRadius,
    ultimateRadius,
    leftStick,
    rightStick,
    block,
    dash,
    ability1: {
      x: Math.max(abilityRadius + 8, block.x - buttonRadius - abilityRadius - Math.round(10 * uiScale)),
      y: block.y + Math.round(8 * uiScale),
    },
    ability2: {
      x: Math.min(block.x + Math.round(buttonRadius * 0.2), rightStick.x - radius * 0.15),
      y: Math.round((block.y + rightStick.y) * 0.52),
    },
    ultimate: {
      x: Math.round((leftStick.x + rightStick.x) / 2),
      y: height - Math.round(clamp(bottomInset + ultimateRadius * 0.15, ultimateRadius + 14, short * 0.24)),
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
