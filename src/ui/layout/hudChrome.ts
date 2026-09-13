import { PC_COMBAT_HUD } from '../pcCombatHud';
import { clamp, type ViewportFrame } from './viewport';

export type HudChromeLayout = {
  barY: number;
  barH: number;
  titleX: number;
  titleY: number;
  titleVisible: boolean;
  titleSize: number;
  menuX: number;
  menuY: number;
  menuW: number;
  menuH: number;
  comboY: number;
  bars: {
    x: number;
    hpY: number;
    shieldY: number;
    staminaY: number;
    xpY: number;
    width: number;
    hpH: number;
    shieldH: number;
    stamH: number;
    xpH: number;
  };
  match: {
    x: number;
    scoreY: number;
    timerY: number;
    phaseY: number;
    scoreSize: number;
    timerSize: number;
    phaseSize: number;
    align: 'left' | 'center';
  };
  xpSize: number;
  minimap: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  verbVisible: boolean;
};

/**
 * Purpose-built HUD slots. Desktop keeps the existing top chrome + bottom
 * combat cluster. Mobile uses a compact top strip so the battlefield stays
 * visible in both portrait and landscape.
 */
export const layoutHudChrome = (frame: ViewportFrame): HudChromeLayout => {
  const { width, height, isMobile, isTablet, isPortrait, safe, contentInset } = frame;
  if (!isMobile) {
    return {
      barY: 22,
      barH: 44,
      titleX: 22,
      titleY: 22,
      titleVisible: true,
      titleSize: 15,
      menuX: width - 108,
      menuY: 22,
      menuW: 150,
      menuH: 40,
      comboY: 88,
      bars: {
        x: 36,
        hpY: 56,
        shieldY: 70,
        staminaY: 84,
        xpY: 100,
        width: 224,
        hpH: 10,
        shieldH: 8,
        stamH: 8,
        xpH: 6,
      },
      match: { x: width / 2, scoreY: 22, timerY: 46, phaseY: 70, scoreSize: 16, timerSize: 22, phaseSize: 11, align: 'left' },
      xpSize: 11,
      minimap: {
        x: width - 12,
        y: 52,
        width: PC_COMBAT_HUD.minimapWidth,
        height: PC_COMBAT_HUD.minimapHeight,
      },
      verbVisible: true,
    };
  }

  const top = Math.max(safe.top, 6);
  const barH = 0;
  const enlargeChrome = isPortrait || isTablet;
  const menuW = Math.round(
    clamp(frame.minTouch * (enlargeChrome ? 2.15 : 2.05), enlargeChrome ? 104 : 84, isTablet ? 136 : enlargeChrome ? 124 : 112),
  );
  const menuH = Math.round(clamp(frame.minTouch * (enlargeChrome ? 0.78 : 0.7), enlargeChrome ? 34 : 28, isTablet ? 42 : enlargeChrome ? 38 : 34));
  const menuX = width - contentInset.right - menuW / 2;
  const menuY = top + menuH / 2 + 2;
  const barWidth = Math.round(
    isTablet
      ? clamp(isPortrait ? width * 0.24 : Math.min(width * 0.2, height * 0.34), 132, 176)
      : isPortrait
        ? clamp(width * 0.32, 108, 128)
        : clamp(Math.min(width * 0.18, height * 0.3), 108, 128),
  );
  const hpH = isTablet ? 10 : 7;
  const shieldH = isTablet ? 6 : 4;
  const stamH = isTablet ? 6 : 4;
  const xpH = isTablet ? 5 : 3;
  const gap = isTablet ? 4 : 3;
  const barsX = Math.round((width - barWidth) / 2);
  const floor = height - Math.max(safe.bottom, 8) - 6;
  const labelGap = isTablet ? 11 : 8;
  const xpY = floor - labelGap - xpH / 2;
  const staminaY = xpY - xpH / 2 - gap - stamH / 2;
  const shieldY = staminaY - stamH / 2 - gap - shieldH / 2;
  const hpY = shieldY - shieldH / 2 - gap - hpH / 2;
  const scoreY = hpY - hpH / 2 - (isTablet ? 12 : 9);
  const timerY = scoreY - (isTablet ? 13 : 11);
  const phaseY = timerY - (isTablet ? 12 : 10);
  const miniW = Math.round(
    isTablet
      ? clamp(isPortrait ? width * 0.24 : Math.min(height * 0.34, width * 0.2), 140, 196)
      : isPortrait
        ? clamp(width * 0.28, 108, 148)
        : clamp(Math.min(height * 0.28, width * 0.16), 88, 120),
  );
  const miniH = Math.round(miniW * 0.7);
  const miniY = menuY + menuH / 2 + 8;

  return {
    barY: menuY,
    barH,
    titleX: contentInset.left,
    titleY: menuY,
    titleVisible: false,
    titleSize: enlargeChrome ? 15 : 13,
    menuX,
    menuY,
    menuW,
    menuH,
    comboY: top + (enlargeChrome ? 36 : 28),
    bars: { x: barsX, hpY, shieldY, staminaY, xpY, width: barWidth, hpH, shieldH, stamH, xpH },
    match: {
      x: width / 2,
      scoreY,
      timerY,
      phaseY,
      scoreSize: isTablet ? 13 : 11,
      timerSize: isTablet ? 14 : 12,
      phaseSize: isTablet ? 10 : 9,
      align: 'center',
    },
    xpSize: isTablet ? 11 : 10,
    minimap: {
      x: width - contentInset.right,
      y: miniY,
      width: miniW,
      height: miniH,
    },
    verbVisible: false,
  };
};
