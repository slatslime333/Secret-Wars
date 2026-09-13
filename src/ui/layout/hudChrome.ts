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
      match: { scoreY: 22, timerY: 46, phaseY: 70 },
      minimap: {
        x: width - 12,
        y: 52,
        width: PC_COMBAT_HUD.minimapWidth,
        height: PC_COMBAT_HUD.minimapHeight,
      },
      verbVisible: true,
    };
  }

  const top = Math.max(safe.top, 4);
  const barH = isPortrait ? 0 : 36;
  const menuW = Math.round(clamp(frame.minTouch * 2.15, isPortrait ? 96 : 88, 118));
  const menuH = Math.round(clamp(frame.minTouch * 0.72, 30, 36));
  const menuX = width - contentInset.right - menuW / 2;
  const menuY = top + (isPortrait ? menuH / 2 + 4 : barH / 2);
  const menuBottom = menuY + menuH / 2 + 10;
  const barsX = contentInset.left;
  const barsY = isPortrait ? menuBottom + 4 : top + barH + 8;
  const barWidth = Math.round(
    isPortrait ? clamp(width * 0.4, 112, 156) : clamp(Math.min(width * 0.3, height * 0.55), 148, 210),
  );
  const hpH = isPortrait ? 8 : 9;
  const stamH = isPortrait ? 6 : 7;
  const xpH = 5;
  const hpY = barsY;
  const staminaY = hpY + hpH + 6;
  const xpY = staminaY + stamH + 6;
  const miniW = Math.round(isPortrait ? clamp(width * 0.26, 88, 116) : clamp(height * 0.32, 108, 148));
  const miniH = Math.round(miniW * (isPortrait ? 0.7 : 0.74));

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
    comboY: isPortrait ? barsY + 2 : menuY + barH / 2 + 14,
    bars: { x: barsX, hpY, staminaY, xpY, width: barWidth, hpH, stamH, xpH },
    match: {
      scoreY: isPortrait ? top + 10 : menuY - 8,
      timerY: isPortrait ? top + 26 : menuY + 9,
      phaseY: isPortrait ? menuBottom : top + barH + 2,
    },
    minimap: {
      x: width - contentInset.right,
      y: isPortrait ? xpY + 16 : top + barH + 6,
      width: miniW,
      height: miniH,
    },
    verbVisible: false,
  };
};
