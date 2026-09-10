/**
 * Mobile orientation helper for Secret Wars.
 *
 * The game is authored as a fixed 16:9 landscape canvas. On touch-first
 * phones/tablets held in portrait the play area is too small, so we show a
 * full-screen prompt asking the player to rotate. The prompt is hidden once
 * the screen becomes landscape.
 *
 * Why use the Screen Orientation API instead of a CSS media query?
 * CSS `(orientation: portrait)` only looks at the current viewport width/height,
 * which can be unreliable on foldables, split-screen, or when the URL/system bars
 * don't update immediately. The Screen Orientation API reports the actual screen
 * orientation and fires a dedicated `change` event, which is more dependable.
 *
 * Foldables make this tricky: the active screen may switch or the reported
 * `screen.orientation` may lag. To stay safe we combine several signals
 * (Screen Orientation API, `window.orientation`, CSS orientation media query,
 * and the visible viewport) and only declare "portrait" when every signal we
 * can read agrees. If any signal says landscape, the overlay is hidden.
 *
 * Tapping the prompt's rotate icon attempts to lock the screen to landscape
 * using the Screen Orientation API. Browsers may reject this (iOS Safari, for
 * example, does not allow web pages to lock orientation), so the player may
 * still need to rotate the device manually.
 */

const rotateOverlay = document.getElementById('rotate-device');
const rotateButton = document.querySelector('.rotate-icon');

// Detect touch-first devices while leaving desktop PCs with a mouse/trackpad alone.
// We use multiple media features because different mobile/foldable browsers report
// them differently (some classify a stylus/keyboard case as the primary input).
const hoverQuery = window.matchMedia('(hover: none)');
const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
const anyCoarsePointerQuery = window.matchMedia('(any-pointer: coarse)');
const portraitQuery = window.matchMedia('(orientation: portrait)');

interface MediaQueryListWithLegacy {
  matches: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  addListener?: (listener: () => void) => void;
}

function addMediaChangeListener(query: MediaQueryListWithLegacy, listener: () => void): void {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener);
  } else if (typeof query.addListener === 'function') {
    query.addListener(listener);
  }
}

interface OrientationLockable {
  type?: string;
  angle?: number;
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function isTouchDevice(): boolean {
  // True when no hovering pointer exists or at least one coarse/touch pointer exists.
  return (
    hoverQuery.matches || coarsePointerQuery.matches || anyCoarsePointerQuery.matches
  );
}

function getScreenOrientationType(): string | undefined {
  return (window.screen as Screen & { orientation?: OrientationLockable }).orientation?.type;
}

function getViewportSize(): { width: number; height: number } {
  // visualViewport is the visible viewport excluding browser UI. If it is not
  // available (older browsers), fall back to the window dimensions.
  const viewport = window.visualViewport;
  if (viewport && viewport.width > 0 && viewport.height > 0) {
    return { width: viewport.width, height: viewport.height };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function isViewportPortrait(): boolean {
  const { width, height } = getViewportSize();
  // Treat square/small differences as landscape-friendly to avoid a stuck overlay.
  return height > width;
}

function isWindowOrientationPortrait(): boolean | undefined {
  // `window.orientation` is deprecated but still widely supported on mobile
  // browsers and can be more reliable than the Screen Orientation API on some
  // foldable/split-screen configurations.
  const orientation = (window as unknown as { orientation?: number }).orientation;
  if (typeof orientation !== 'number') {
    return undefined;
  }
  // 0 and 180 degrees are portrait; 90 and -90 degrees are landscape.
  return Math.abs(orientation) % 180 === 0;
}

function isPortraitOrientation(): boolean {
  // Gather independent signals. The overlay should only appear when every
  // available signal agrees the device/viewport is portrait. This makes the
  // prompt resilient on foldables where one API can lag or report the wrong
  // screen.
  const screenType = getScreenOrientationType();
  const signals: (boolean | undefined)[] = [
    screenType ? screenType.startsWith('portrait') : undefined,
    isWindowOrientationPortrait(),
    portraitQuery.matches,
    isViewportPortrait(),
  ];

  const available = signals.filter((s): s is boolean => typeof s === 'boolean');

  // If we cannot determine orientation at all, don't block the game.
  if (available.length === 0) {
    return false;
  }

  return available.every((s) => s);
}

function updateOverlay(): void {
  if (!rotateOverlay) return;

  if (isPortraitOrientation() && isTouchDevice()) {
    rotateOverlay.classList.add('is-visible');
  } else {
    rotateOverlay.classList.remove('is-visible');
  }
}

async function tryLockLandscape(): Promise<void> {
  const screenOrientation = (window.screen as Screen & { orientation?: OrientationLockable }).orientation;

  if (typeof screenOrientation?.lock === 'function') {
    try {
      await screenOrientation.lock('landscape');
    } catch {
      // Orientation lock may not be supported or allowed by the browser.
      // On some Android browsers the lock call has to originate from a user
      // gesture, which it does because this is called from a click handler.
    }
  }
}

export function initOrientationHandling(): void {
  updateOverlay();

  const screenOrientation = (window.screen as Screen & { orientation?: OrientationLockable }).orientation;

  // Listen for orientation changes from as many sources as possible. Different
  // browsers and devices (especially foldables) fire different events.
  if (screenOrientation?.addEventListener) {
    screenOrientation.addEventListener('change', updateOverlay);
  }

  // `window.orientationchange` is the older, broadly-supported event.
  window.addEventListener('orientationchange', updateOverlay);

  // The CSS orientation media query has its own change event and is useful when
  // the viewport changes even if the device orientation API does not fire.
  addMediaChangeListener(portraitQuery, updateOverlay);

  // Resize + visualViewport resize catch foldable posture changes, URL bar
  // hiding/showing, and other viewport-only size changes.
  window.addEventListener('resize', updateOverlay);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateOverlay);
  }

  // Re-check if the primary input type changes (e.g. keyboard/mouse connected).
  addMediaChangeListener(hoverQuery, updateOverlay);
  addMediaChangeListener(coarsePointerQuery, updateOverlay);
  addMediaChangeListener(anyCoarsePointerQuery, updateOverlay);

  rotateButton?.addEventListener('click', tryLockLandscape);
}
