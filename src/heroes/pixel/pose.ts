import type { HeroDrawOptions } from '../heroDraw';
import { HERO_IDLE_FRAME_MS, HERO_WALK_FRAME_MS, type HeroPoseName } from './spec';

export type PixelMotion = {
  moving: boolean;
  now: number;
  down?: boolean;
};

const attackPose = (options: HeroDrawOptions): HeroPoseName => {
  const swing = options.swordAngleOffset ?? 0;
  const lift = Math.max(options.armLiftLeft ?? 0, options.armLiftRight ?? 0, options.staffRaise ?? 0);
  const bat = options.batScale ?? 1;
  if (options.showUzi) {
    return 'atk1';
  }
  if (swing < -0.25 || (lift > 0 && lift < 0.45) || (bat > 1.05 && bat < 1.35)) {
    return 'atk0';
  }
  if (swing > 0.35 || lift >= 0.45 || bat >= 1.35 || (options.staffRaise ?? 0) >= 0.5) {
    return 'atk1';
  }
  return 'atk2';
};

/** Map existing combat/ability state onto a short idle / walk / attack sheet. */
export const poseForDraw = (options: HeroDrawOptions, motion: PixelMotion): HeroPoseName => {
  if (motion.down) {
    return 'down';
  }
  if (options.hitFlash) {
    return 'hurt';
  }
  if (options.attacking) {
    return attackPose(options);
  }
  if (motion.moving) {
    const step = Math.floor(motion.now / HERO_WALK_FRAME_MS) % 4;
    if (step === 0) {
      return 'walk0';
    }
    if (step === 2) {
      return 'walk2';
    }
    return 'walk1';
  }
  return Math.floor(motion.now / HERO_IDLE_FRAME_MS) % 2 === 0 ? 'idle0' : 'idle1';
};
