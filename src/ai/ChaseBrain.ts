import { CHASER } from '../config/chaser';
import { BlockController } from '../combat/BlockController';
import { ChaserAttack } from '../combat/ChaserAttack';
import { ChaserBody } from '../heroes/ChaserBody';
import { NinjaBody } from '../heroes/NinjaBody';

/**
 * Walk at Ninja. Stop in melee and swing. No dodge, no block.
 * Stun from a hit cancels the current path so combos can land.
 */
export class ChaseBrain {
  constructor(private readonly attack: ChaserAttack) {}

  update(now: number, chaser: ChaserBody, ninja: NinjaBody, block: BlockController): void {
    if (chaser.down || ninja.down) {
      chaser.stop();
      return;
    }
    chaser.setAim(ninja.x - chaser.x, ninja.y - chaser.y);

    if (chaser.isStunned(now)) {
      this.attack.update(now, chaser, ninja, block);
      return;
    }

    if (!this.attack.winding) {
      const distance = Math.hypot(ninja.x - chaser.x, ninja.y - chaser.y);
      if (distance > CHASER.attackRange * 0.7) {
        chaser.chaseToward(ninja.x, ninja.y);
      } else {
        chaser.stop();
        this.attack.tryStart(now, chaser);
      }
    } else {
      chaser.stop();
    }

    this.attack.update(now, chaser, ninja, block);
  }
}
