import Phaser from 'phaser';
import { ActionButton } from '../ActionButton';
import { COLORS, FONTS, hex } from '../theme';
import type { ViewportFrame } from './viewport';

export type MenuFooterButton = {
  label: string;
  shortLabel?: string;
  primary?: boolean;
  onPress: () => void;
};

export const menuFooterReserve = (frame: ViewportFrame): number =>
  Math.max(52, Math.round(frame.minTouch * 0.72) + 18);

/** Fit BACK / RANDOMIZE / WATCH on a phone without overlapping or clipping. */
export const layoutMenuFooter = (
  scene: Phaser.Scene,
  frame: ViewportFrame,
  buttons: MenuFooterButton[],
): ActionButton[] => {
  const inset = frame.contentInset;
  const innerW = Math.max(160, frame.width - inset.left - inset.right);
  const count = Math.max(1, buttons.length);
  const gap = Math.max(6, Math.min(10, frame.gap));
  const height = Math.min(44, Math.max(36, Math.round(frame.minTouch * 0.72)));
  const width =
    count === 1
      ? Math.min(140, innerW)
      : Math.max(72, Math.min(150, Math.floor((innerW - gap * (count - 1)) / count)));
  const total = count * width + (count - 1) * gap;
  const startX =
    count === 1 ? inset.left + width / 2 : inset.left + (innerW - total) / 2 + width / 2;
  const y = frame.height - inset.bottom - height / 2;
  const narrow = width < 110;
  return buttons.map(
    (btn, i) =>
      new ActionButton(scene, startX + i * (width + gap), y, {
        label: narrow && btn.shortLabel ? btn.shortLabel : btn.label,
        width,
        height,
        compact: true,
        primary: btn.primary,
        fontSize: width < 96 ? '11px' : width < 120 ? '13px' : '14px',
        letterSpacing: width < 110 ? 0 : 1,
        onPress: btn.onPress,
      }),
  );
};

export const fittedMenuSubtitle = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  copy: string,
  maxWidth: number,
  portrait: boolean,
): Phaser.GameObjects.Text =>
  scene.add
    .text(x, y, copy, {
      fontFamily: FONTS.body,
      fontSize: portrait ? '10px' : '12px',
      fontStyle: 'bold',
      color: hex(COLORS.muted),
      letterSpacing: portrait ? 0 : 1,
      align: 'center',
      wordWrap: { width: Math.max(140, Math.floor(maxWidth)), useAdvancedWrap: true },
    })
    .setOrigin(0.5, 0);
