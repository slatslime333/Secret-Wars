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

type SizeSample = {
  width: number;
  height: number;
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

export function toLandscapeSize(width: number, height: number): SizeSample {
  return {
    width: Math.max(width, height),
    height: Math.min(width, height),
  };
}

/**
 * Device orientation from the Screen Orientation API / window.orientation.
 * Viewport width/height is not used here: Android Chrome often keeps portrait
 * innerWidth/innerHeight after the phone has already rotated to landscape.
 */
export function isDeviceLandscape(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const type = (window.screen as Screen & { orientation?: { type?: string } }).orientation?.type;
  if (typeof type === 'string') {
    return type.startsWith('landscape');
  }

  const angle = (window as unknown as { orientation?: number }).orientation;
  if (typeof angle === 'number') {
    return Math.abs(angle) % 180 !== 0;
  }

  if (typeof window.matchMedia === 'function' && window.matchMedia('(orientation: landscape)').matches) {
    return true;
  }

  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  return width >= height;
}

function collectViewportSamples(): SizeSample[] {
  const samples: SizeSample[] = [];
  const seen = new Set<string>();
  const add = (width: number, height: number): void => {
    if (!(width > 0 && height > 0)) {
      return;
    }
    const key = `${Math.round(width)}x${Math.round(height)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    samples.push({ width, height });
  };

  const viewport = window.visualViewport;
  if (viewport) {
    add(viewport.width, viewport.height);
  }
  add(window.innerWidth, window.innerHeight);
  add(document.documentElement?.clientWidth ?? 0, document.documentElement?.clientHeight ?? 0);
  add(document.body?.clientWidth ?? 0, document.body?.clientHeight ?? 0);

  return samples;
}

/** Unnormalized visible size. Used by the rotate overlay, not by canvas sizing. */
export function getRawViewportSize(): SizeSample {
  if (typeof window === 'undefined') {
    return { width: 960, height: 540 };
  }

  const viewport = window.visualViewport;
  if (viewport && viewport.width > 0 && viewport.height > 0) {
    return { width: viewport.width, height: viewport.height };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Visible play area in CSS pixels.
 *
 * Mobile is landscape-only. Android often reports a tall viewport after the
 * phone has rotated, which would letterbox a portrait canvas on a wide screen.
 * Touch sessions therefore always return landscape dimensions (the longer side
 * is width).
 */
export function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 960, height: 540, offsetLeft: 0, offsetTop: 0 };
  }

  const samples = collectViewportSamples();
  const fallback = samples[0] ?? { width: 960, height: 540 };

  if (isTouchPrimary()) {
    const alreadyLandscape = samples.filter((sample) => sample.width >= sample.height);
    const pool = alreadyLandscape.length > 0
      ? alreadyLandscape
      : samples.map((sample) => toLandscapeSize(sample.width, sample.height));
    let best = pool[0] ?? toLandscapeSize(fallback.width, fallback.height);
    for (const sample of pool) {
      if (sample.width * sample.height > best.width * best.height) {
        best = sample;
      }
    }
    return { ...best, offsetLeft: 0, offsetTop: 0 };
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
    width: fallback.width,
    height: fallback.height,
    offsetLeft: 0,
    offsetTop: 0,
  };
}
