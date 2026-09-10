/**
 * Mobile orientation helper for Secret Wars.
 *
 * The game is authored as a fixed 16:9 landscape canvas. On touch-first
 * phones/tablets held in portrait the play area is too small, so we show a
 * full-screen prompt asking the player to rotate. The prompt is hidden once
 * the viewport becomes landscape.
 *
 * Tapping the prompt's rotate icon attempts to request fullscreen and lock the
 * screen to landscape using the Screen Orientation API. Browsers may reject
 * this (especially on iOS, which only allows orientation locks in standalone
 * PWAs), so the prompt remains visible until the device is physically rotated.
 */

const rotateOverlay = document.getElementById('rotate-device');
const rotateButton = document.querySelector('.rotate-icon');
const portraitQuery = window.matchMedia('(orientation: portrait)');
// 'hover: none' is the most reliable way to detect touch-first phones/tablets.
// A PC with a mouse/trackpad reports 'hover: hover', so it won't see the prompt.
const touchQuery = window.matchMedia('(hover: none)');

function shouldShowRotatePrompt(): boolean {
  return portraitQuery.matches && touchQuery.matches;
}

function updateOverlay(): void {
  if (!rotateOverlay) return;

  if (shouldShowRotatePrompt()) {
    rotateOverlay.classList.add('is-visible');
  } else {
    rotateOverlay.classList.remove('is-visible');
  }
}

interface OrientationLockable {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}

async function tryLockLandscape(): Promise<void> {
  const screenOrientation = (window.screen as Screen & { orientation?: OrientationLockable }).orientation;

  // Try to lock the screen to landscape. This is supported on some Android
  // browsers from a user gesture; iOS Safari does not allow web pages to lock
  // orientation, so the player still needs to rotate the device manually.
  if (typeof screenOrientation?.lock === 'function') {
    try {
      await screenOrientation.lock('landscape');
    } catch {
      // Orientation lock may not be supported or allowed by the browser.
    }
  }
}

export function initOrientationHandling(): void {
  updateOverlay();

  // matchMedia change events are more reliable than 'orientationchange' for
  // reacting to the viewport aspect ratio becoming landscape or portrait.
  portraitQuery.addEventListener('change', updateOverlay);
  touchQuery.addEventListener('change', updateOverlay);
  window.addEventListener('resize', updateOverlay);

  rotateButton?.addEventListener('click', tryLockLandscape);
}
