import type Phaser from 'phaser';
import type { ComboStep } from '../config/combat';
import type { CardinalFacing } from './drawNinja';

export type HeroDrawOptions = {
  facing: CardinalFacing;
  attacking?: boolean;
  swordAngleOffset?: number;
  comboStep?: ComboStep;
  hitFlash?: boolean;
  rival?: boolean;
  armLiftLeft?: number;
  armLiftRight?: number;
  swayX?: number;
};

export type HeroDrawFn = (graphics: Phaser.GameObjects.Graphics, options: HeroDrawOptions) => void;
