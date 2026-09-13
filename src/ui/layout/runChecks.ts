import { layoutHudChrome } from './hudChrome';
import { measureViewport } from './viewport';
import { findLayoutOverlaps, getTouchControlLayout } from '../touchLayout';
import { resolveControls } from '../controlLayout';

type Check = { name: string; ok: boolean; detail: string };

const SIZES: Array<[string, number, number]> = [
  ['iphone-portrait', 390, 844],
  ['iphone-landscape', 844, 390],
  ['tight-landscape', 740, 320],
  ['android-portrait', 360, 740],
];

const notCentered = (x: number, width: number, band = 0.22): boolean => {
  const mid = width / 2;
  return Math.abs(x - mid) > width * band;
};

const checkSize = (label: string, width: number, height: number): Check[] => {
  const layout = getTouchControlLayout(width, height);
  const resolved = resolveControls(width, height, {});
  const chrome = layoutHudChrome(measureViewport(width, height, true));
  const overlaps = findLayoutOverlaps(width, height);
  const rightBand = width * 0.55;
  const leftBand = width * 0.32;
  const controlsRight =
    layout.rightStick.x > rightBand &&
    layout.block.x > rightBand &&
    layout.dash.x > rightBand &&
    layout.ability1.x > rightBand &&
    layout.ability2.x > rightBand &&
    layout.ultimate.x > rightBand &&
    resolved.rightStick.x > rightBand &&
    resolved.ultimate.x > rightBand;
  const moveLeft = layout.leftStick.x < leftBand && resolved.leftStick.x < leftBand;
  const hudLeft = chrome.match.x < width * 0.28 && chrome.bars.x < width * 0.2;
  const menuRight = chrome.menuX > width * 0.7;
  const ultNotCenter = notCentered(layout.ultimate.x, width, 0.18) && notCentered(resolved.ultimate.x, width, 0.18);
  return [
    {
      name: `${label} no control overlap`,
      ok: overlaps.length === 0,
      detail: overlaps.join(',') || 'clean',
    },
    {
      name: `${label} sticks on the sides`,
      ok: moveLeft && layout.rightStick.x > width * 0.68,
      detail: `move=${layout.leftStick.x.toFixed(0)} aim=${layout.rightStick.x.toFixed(0)} w=${width}`,
    },
    {
      name: `${label} buttons stay on the right`,
      ok: controlsRight && ultNotCenter,
      detail: `ult=${layout.ultimate.x.toFixed(0)} a1=${layout.ability1.x.toFixed(0)} block=${layout.block.x.toFixed(0)} dash=${layout.dash.x.toFixed(0)}`,
    },
    {
      name: `${label} hud chrome on the sides`,
      ok: hudLeft && menuRight,
      detail: `matchX=${chrome.match.x.toFixed(0)} barsX=${chrome.bars.x.toFixed(0)} menuX=${chrome.menuX.toFixed(0)}`,
    },
  ];
};

export const runHudLayoutChecks = (): Check[] => SIZES.flatMap(([label, width, height]) => checkSize(label, width, height));

if (import.meta.url.includes('runChecks')) {
  const argv1 = (globalThis as { process?: { argv?: string[] } }).process?.argv?.[1];
  if (argv1?.includes('runChecks')) {
    let failed = 0;
    for (const result of runHudLayoutChecks()) {
      const mark = result.ok ? 'ok' : 'FAIL';
      if (!result.ok) {
        failed += 1;
      }
      console.log(`${mark}  ${result.name}  ${result.detail}`);
    }
    if (failed) {
      throw new Error(`${failed} HUD layout check(s) failed`);
    }
    console.log(`${SIZES.length} viewports passed`);
  }
}
