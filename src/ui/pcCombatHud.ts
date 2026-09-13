import { isTouchPrimary } from '../device';

/** PC combat chrome: bigger bars + abilities sit in the bottom-middle. */
export const PC_COMBAT_HUD = {
  barWidth: 440,
  hpHeight: 22,
  shieldHeight: 12,
  staminaHeight: 15,
  xpHeight: 9,
  abilityRadius: 40,
  abilityGap: 112,
  bottomMargin: 22,
  barToAbility: 26,
  minimapWidth: 256,
  minimapHeight: 188,
} as const;

export type PcCombatLayout = {
  width: number;
  height: number;
  barLeft: number;
  barWidth: number;
  hpHeight: number;
  shieldHeight: number;
  staminaHeight: number;
  hpY: number;
  shieldY: number;
  staminaY: number;
  xpY: number;
  abilityY: number;
  abilityXs: [number, number, number];
  abilityRadius: number;
  abilityScale: number;
  hpTextX: number;
  hpTextY: number;
};

export const isPcCombatHud = (): boolean => !isTouchPrimary();

export const layoutPcCombatHud = (width: number, height: number): PcCombatLayout => {
  const hud = PC_COMBAT_HUD;
  const abilityY = height - hud.bottomMargin - hud.abilityRadius;
  const xpY = abilityY - hud.abilityRadius - hud.barToAbility;
  const staminaY = xpY - 18;
  const shieldY = staminaY - 18;
  const hpY = shieldY - 26;
  const barLeft = Math.round(width / 2 - hud.barWidth / 2);
  const mid = width / 2;
  return {
    width,
    height,
    barLeft,
    barWidth: hud.barWidth,
    hpHeight: hud.hpHeight,
    shieldHeight: hud.shieldHeight,
    staminaHeight: hud.staminaHeight,
    hpY,
    shieldY,
    staminaY,
    xpY,
    abilityY,
    abilityXs: [mid - hud.abilityGap, mid, mid + hud.abilityGap],
    abilityRadius: hud.abilityRadius,
    abilityScale: hud.abilityRadius / 18,
    hpTextX: barLeft + hud.barWidth + 12,
    hpTextY: hpY,
  };
};
