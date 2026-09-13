import Phaser from 'phaser';
import { ARENA } from '../../config/arena';
import { cameraPrefs } from '../../config/cameraPrefs';
import { getViewportSize, isTouchPrimary } from '../../device';

/** iPad-class short side. Phones stay phones even in landscape. */
export const TABLET_SHORT_EDGE = 600;
/** Locked follow — player stays centered even in a corner. */
export const CAMERA_FOLLOW_LERP = 1;

export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * Authoritative viewport/layout frame. HUD, camera, touch pads, and menus
 * should read this instead of measuring the screen on their own.
 *
 * Desktop keeps a 1:1 camera and the existing chrome. Mobile landscape zooms
 * out a little; mobile portrait zooms out more. Values are clamped so extreme
 * phones do not produce microscopic sprites or giant controls.
 */
export type ViewportFrame = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  aspect: number;
  isMobile: boolean;
  isTablet: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  safe: Insets;
  /** Padding for menus and panels (includes safe area). */
  contentInset: Insets;
  /** Keep virtual controls out of the top HUD and device chrome. */
  controlInset: Insets;
  uiScale: number;
  minTouch: number;
  pad: number;
  gap: number;
  font: {
    title: number;
    body: number;
    small: number;
  };
  cameraZoom: number;
  modalMaxHeight: number;
  contentMaxWidth: number;
};

const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

let safeProbe: HTMLDivElement | undefined;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** CSS env() safe-area insets in CSS pixels. */
export const readSafeAreaInsets = (): Insets => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { ...ZERO };
  }
  if (!safeProbe) {
    safeProbe = document.createElement('div');
    safeProbe.setAttribute('aria-hidden', 'true');
    safeProbe.style.cssText =
      'position:fixed;pointer-events:none;visibility:hidden;inset:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
    document.body.appendChild(safeProbe);
  }
  const style = getComputedStyle(safeProbe);
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
};

const addInsets = (base: Insets, extra: Insets): Insets => ({
  top: base.top + extra.top,
  right: base.right + extra.right,
  bottom: base.bottom + extra.bottom,
  left: base.left + extra.left,
});

/**
 * Camera zoom from the usable viewport. Zoom < 1 shows more battlefield.
 * Desktop stays at 1. Portrait needs more world width; landscape needs more
 * world height when the mobile browser chrome is showing.
 */
export const cameraZoomFor = (width: number, height: number, isMobile: boolean): number => {
  if (!isMobile) {
    return 1;
  }
  const portrait = height > width;
  const desired = portrait ? clamp(width / 1080, 0.48, 0.7) : clamp(height / 780, 0.64, 0.88);
  const minFit = Math.max(width / ARENA.width, height / ARENA.height);
  // Never zoom in past 1:1. A taller-than-arena phone should show extra
  // empty space rather than enlarging the world and shoving the HUD off-screen.
  return clamp(Math.max(desired, minFit), 0.01, 1);
};

export const measureViewport = (
  width?: number,
  height?: number,
  isMobile = isTouchPrimary(),
): ViewportFrame => {
  const raw = getViewportSize();
  const w = Math.max(320, Math.round(width ?? raw.width));
  const h = Math.max(240, Math.round(height ?? raw.height));
  const isPortrait = h > w;
  const short = Math.min(w, h);
  const isTablet = isMobile && short >= TABLET_SHORT_EDGE;
  const safe = readSafeAreaInsets();
  const pad = Math.round(clamp(short * 0.035, isMobile ? 10 : 16, 28));
  const minTouch = Math.round(
    isTablet
      ? clamp(short * 0.085, 56, 74)
      : isMobile
        ? clamp(short * (isPortrait ? 0.112 : 0.118), isPortrait ? 50 : 46, isPortrait ? 64 : 58)
        : clamp(short * 0.09, 44, 56),
  );
  const uiScale = isMobile ? clamp(Math.min(w / 960, h / 540), 0.72, 1.15) : 1;
  const contentInset = addInsets(safe, { top: pad, right: pad, bottom: pad, left: pad });
  const hudReserve = !isMobile
    ? 48
    : isTablet
      ? isPortrait
        ? 118
        : 96
      : isPortrait
        ? 96
        : 78;
  // Portrait lifts sticks above the bottom-center HP cluster. Landscape HP
  // sits in the middle third, so sticks can stay in the bottom corners.
  const hudBottom = !isMobile
    ? 12
    : isTablet
      ? isPortrait
        ? 176
        : 48
      : isPortrait
        ? 158
        : 32;
  const controlInset: Insets = {
    top: Math.max(contentInset.top, safe.top + hudReserve),
    right: Math.max(contentInset.right, safe.right + 12),
    bottom: Math.max(contentInset.bottom, safe.bottom + hudBottom),
    left: Math.max(contentInset.left, safe.left + 12),
  };

  return {
    width: w,
    height: h,
    offsetLeft: raw.offsetLeft,
    offsetTop: raw.offsetTop,
    aspect: w / h,
    isMobile,
    isTablet,
    isPortrait,
    isLandscape: !isPortrait,
    safe,
    contentInset,
    controlInset,
    uiScale,
    minTouch,
    pad,
    gap: Math.round(clamp(short * 0.02, 8, 16)),
    font: {
      title: Math.round(clamp(16 * uiScale, 14, 28)),
      body: Math.round(clamp(13 * uiScale, 12, 16)),
      small: Math.round(clamp(11 * uiScale, 10, 13)),
    },
    cameraZoom: cameraZoomFor(w, h, isMobile),
    modalMaxHeight: Math.max(220, h - contentInset.top - contentInset.bottom),
    contentMaxWidth: Math.min(w - contentInset.left - contentInset.right, isPortrait ? w : 920),
  };
};

export const applyGameplayCamera = (
  camera: Phaser.Cameras.Scene2D.Camera,
  width: number,
  height: number,
): void => {
  const frame = measureViewport(width, height);
    camera.setSize(width, height);
    cameraPrefs.load();
    camera.setZoom(clamp(frame.cameraZoom * cameraPrefs.zoomMultiplier(), 0.28, 1.35));
  camera.removeBounds();
  camera.setBackgroundColor(ARENA.wallColor);
  camera.setDeadzone(0, 0);
};

/** Keep the followed fighter in the screen center, including past arena walls. */
export const lockCameraFollow = (
  camera: Phaser.Cameras.Scene2D.Camera,
  target: Phaser.GameObjects.GameObject,
): void => {
  camera.removeBounds();
  camera.setBackgroundColor(ARENA.wallColor);
  camera.startFollow(target, true, CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_LERP);
  camera.setDeadzone(0, 0);
};

export const contentRect = (
  frame: ViewportFrame,
): { x: number; y: number; width: number; height: number } => ({
  x: frame.contentInset.left,
  y: frame.contentInset.top,
  width: frame.width - frame.contentInset.left - frame.contentInset.right,
  height: frame.height - frame.contentInset.top - frame.contentInset.bottom,
});
