/**
 * Viewport and primary-input helpers.
 *
 * Touch-first phones and tablets are treated as mobile. Desktop PCs with a
 * mouse or trackpad are not, even when they also have a touchscreen.
 */

export type ViewportSize = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
};

/**
 * True when the primary pointer is a finger and hover is unavailable.
 * `any-pointer: coarse` is intentionally not used: it matches many desktop
 * touchscreens and would treat a PC as a phone.
 */
export function isTouchPrimary(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return (
    window.matchMedia('(hover: none)').matches &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Visible viewport size, preferring visualViewport so mobile URL bars and
 * foldable posture changes are reflected.
 */
export function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 960, height: 540, offsetLeft: 0, offsetTop: 0 };
  }

  const viewport = window.visualViewport;
  if (viewport && viewport.width > 0 && viewport.height > 0) {
    return {
      width: viewport.width,
      height: viewport.height,
      offsetLeft: viewport.offsetLeft,
      offsetTop: viewport.offsetTop,
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetLeft: 0,
    offsetTop: 0,
  };
}
