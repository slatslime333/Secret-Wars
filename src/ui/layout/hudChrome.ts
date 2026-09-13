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
    staminaY: number;
    xpY: number;
    width: number;
    hpH: number;
    stamH: number;
    xpH: number;
  };
  match: {
    x: number;
    scoreY: number;
    timerY: number;
    phaseY: number;
  };
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
  const { width, height, isMobile, isPortrait, safe, contentInset } = frame;
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
        staminaY: 70,
        xpY: 84,
        width: 224,
        hpH: 10,
        stamH: 8,
        xpH: 6,
      },
      match: { x: width / 2, scoreY: 22, timerY: 46, phaseY: 70 },
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
  const menuW = Math.round(clamp(frame.minTouch * 2.05, isPortrait ? 92 : 84, 112));
  const menuH = Math.round(clamp(frame.minTouch * 0.7, 28, 34));
  const menuX = width - contentInset.right - menuW / 2;
  const menuY = top + menuH / 2 + 2;
  const barsX = contentInset.left;
  const barWidth = Math.round(
    isPortrait
      ? clamp(width * 0.34, 108, 148)
      : clamp(Math.min(width * 0.26, height * 0.42), 120, 168),
  );
  const hpH = isPortrait ? 8 : 8;
  const stamH = 6;
  const xpH = 5;
  const hpY = top + 18;
  const staminaY = hpY + hpH + 5;
  const xpY = staminaY + stamH + 5;
  const scoreY = xpY + xpH + 12;
  const timerY = scoreY + (isPortrait ? 16 : 14);
  const phaseY = timerY + 14;
  const miniW = Math.round(isPortrait ? clamp(width * 0.2, 80, 102) : clamp(Math.min(height * 0.28, width * 0.16), 88, 120));
  const miniH = Math.round(miniW * 0.7);
  const miniY = menuY + menuH / 2 + 8;

  return {
    barY: menuY,
    barH,
    titleX: contentInset.left,
    titleY: menuY,
    titleVisible: false,
    titleSize: 13,
    menuX,
    menuY,
    menuW,
    menuH,
    comboY: phaseY + 18,
    bars: { x: barsX, hpY, staminaY, xpY, width: barWidth, hpH, stamH, xpH },
    match: {
      x: barsX,
      scoreY,
      timerY,
      phaseY,
    },
    minimap: {
      x: width - contentInset.right,
      y: miniY,
      width: miniW,
      height: miniH,
    },
    verbVisible: false,
  };
};
