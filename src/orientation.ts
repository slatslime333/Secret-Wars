/**
 * Mobile orientation helper for Secret Wars.
 *
 * The game is authored for landscape play. On touch-first phones and tablets
 * held in portrait the HUD and dual-stick layout do not fit, so a full-screen
 * prompt asks the player to rotate. Desktop PCs are exempt: they have enough
 * screen real estate even in a tall window.
 *
 * Foldables make orientation tricky. Several signals are combined (Screen
 * Orientation API, `window.orientation`, CSS orientation, and the visible
 * viewport) and the overlay only appears when every available signal agrees
 * the device is portrait. If any signal says landscape, the overlay hides so
 * the game can fill the screen.
 *
 * Tapping the prompt tries to lock landscape via the Screen Orientation API.
 * Browsers may reject this (iOS Safari does not allow web pages to lock
 * orientation), so the player may still need to rotate the device by hand.
 */

import { getRawViewportSize, isTouchPrimary } from './device';

const rotateOverlay = document.getElementById('rotate-device');
const rotateButton = document.querySelector('.rotate-icon');
const continueButton = document.getElementById('rotate-continue');

const hoverQuery = window.matchMedia('(hover: none)');
const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
const portraitQuery = window.matchMedia('(orientation: portrait)');

let overlayDismissed = false;

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

function getScreenOrientationType(): string | undefined {
  return (window.screen as Screen & { orientation?: OrientationLockable }).orientation?.type;
}

function isViewportPortrait(): boolean {
  const { width, height } = getRawViewportSize();
  return height > width;
}

function isWindowOrientationPortrait(): boolean | undefined {
  const orientation = (window as unknown as { orientation?: number }).orientation;
  if (typeof orientation !== 'number') {
    return undefined;
  }
  return Math.abs(orientation) % 180 === 0;
}

function isPortraitOrientation(): boolean {
  const screenType = getScreenOrientationType();
  const signals: (boolean | undefined)[] = [
    screenType ? screenType.startsWith('portrait') : undefined,
    isWindowOrientationPortrait(),
    portraitQuery.matches,
    isViewportPortrait(),
  ];

  const available = signals.filter((s): s is boolean => typeof s === 'boolean');
  if (available.length === 0) {
    return false;
  }

  return available.every((s) => s);
}

function updateOverlay(): void {
  if (overlayDismissed) {
    setOverlayVisible(false);
    return;
  }

  setOverlayVisible(isPortraitOrientation() && isTouchPrimary());
}

async function tryLockLandscape(): Promise<void> {
  if (!isTouchPrimary()) {
    return;
  }

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

function onFirstTouchGesture(): void {
  void tryLockLandscape();
  document.removeEventListener('pointerdown', onFirstTouchGesture);
}

export function initOrientationHandling(): void {
  updateOverlay();

  const screenOrientation = (window.screen as Screen & { orientation?: OrientationLockable }).orientation;

  if (screenOrientation?.addEventListener) {
    screenOrientation.addEventListener('change', updateOverlay);
  }

  window.addEventListener('orientationchange', updateOverlay);
  addMediaChangeListener(portraitQuery, updateOverlay);
  window.addEventListener('resize', updateOverlay);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateOverlay);
  }

  addMediaChangeListener(hoverQuery, updateOverlay);
  addMediaChangeListener(coarsePointerQuery, updateOverlay);

  rotateOverlay?.addEventListener('click', () => {
    void tryLockLandscape();
  });
  rotateButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    void tryLockLandscape();
  });
  continueButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    overlayDismissed = true;
    void tryLockLandscape();
    updateOverlay();
  });

  if (isTouchPrimary()) {
    document.addEventListener('pointerdown', onFirstTouchGesture);
  }
}
