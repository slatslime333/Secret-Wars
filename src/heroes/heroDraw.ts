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
