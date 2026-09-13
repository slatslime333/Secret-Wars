import { isTouchPrimary } from '../device';

/** PC combat chrome: bigger bars + abilities sit in the bottom-middle. */
export const PC_COMBAT_HUD = {
  barWidth: 380,
  hpHeight: 18,
  staminaHeight: 13,
  xpHeight: 8,
  abilityRadius: 32,
  abilityGap: 92,
  bottomMargin: 20,
  barToAbility: 22,
  minimapWidth: 214,
  minimapHeight: 156,
} as const;

export type PcCombatLayout = {
  width: number;
  height: number;
  barLeft: number;
  barWidth: number;
  hpY: number;
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
  const staminaY = xpY - 16;
  const hpY = staminaY - 20;
  const barLeft = Math.round(width / 2 - hud.barWidth / 2);
  const mid = width / 2;
  return {
    width,
    height,
    barLeft,
    barWidth: hud.barWidth,
    hpY,
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
