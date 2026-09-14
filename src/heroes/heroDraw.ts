import type Phaser from 'phaser';
import type { ComboStep } from '../config/combat';
import type { TeamId } from '../config/hero';
import type { CardinalFacing } from './drawNinja';

export type HeroDrawOptions = {
  facing: CardinalFacing;
  attacking?: boolean;
  swordAngleOffset?: number;
  comboStep?: ComboStep;
  hitFlash?: boolean;
  rival?: boolean;
  team?: TeamId;
  armLiftLeft?: number;
  armLiftRight?: number;
  swayX?: number;
  batScale?: number;
  batOnBack?: boolean;
  showUzi?: boolean;
  staffRaise?: number;
  fairyForm?: boolean;
};

export type HeroDrawFn = (graphics: Phaser.GameObjects.Graphics, options: HeroDrawOptions) => void;

/** Solid vertical oval. Matches Cole/Ninja block-face language — no sclera or shine. */
export const drawOvalEye = (
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  scale = 1,
): void => {
  graphics.fillStyle(color);
  graphics.fillEllipse(x, y, 2.8 * scale, 4.6 * scale);
};
