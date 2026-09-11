/**
 * Mobile orientation helper for Secret Wars.
 *
 * Secret Wars features responsive scaling supporting both portrait and
 * landscape orientations on phones, tablets, foldables (such as Samsung Galaxy
 * Z Fold 5), and desktop screens without letterboxing into a small centered box.
 */

const rotateOverlay = document.getElementById('rotate-device');
const rotateButton = document.querySelector('.rotate-icon');
const continueButton = document.getElementById('rotate-continue');

interface OrientationLockable {
  lock?: (orientation: string) => Promise<void>;
}

function setOverlayVisible(visible: boolean): void {
  if (!rotateOverlay) return;

  if (visible) {
    rotateOverlay.hidden = false;
    rotateOverlay.style.removeProperty('display');
    rotateOverlay.classList.add('is-visible');
    return;
  }

  rotateOverlay.classList.remove('is-visible');
  rotateOverlay.hidden = true;
  rotateOverlay.style.display = 'none';
}

function updateOverlay(): void {
  // Portrait and landscape are now fully supported with responsive layout and
  // full-screen scaling. Do not block the user with a forced rotate overlay.
  setOverlayVisible(false);
}

async function tryLockLandscape(): Promise<void> {
  const screenOrientation = (window.screen as Screen & { orientation?: OrientationLockable }).orientation;

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

  rotateButton?.addEventListener('click', tryLockLandscape);
  continueButton?.addEventListener('click', () => {
    updateOverlay();
  });
}
