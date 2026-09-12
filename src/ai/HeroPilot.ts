import Phaser from 'phaser';
import { ARENA } from '../config/arena';
import { battlefieldOf } from '../map';
import type { HeroRuntime } from '../match/HeroRuntime';
import type { NinjaBody } from '../heroes/NinjaBody';
import type { BlockController } from '../combat/BlockController';

/**
 * Lightweight stand-in so allied and enemy heroes walk and fight.
 * Not the future CPU AI — just enough presence for a living battlefield.
 */
export class HeroPilot {
  private nextThinkAt = 0;
  private tapQueued = false;
  private holdUntil = 0;
  private readonly move = new Phaser.Math.Vector2();

  update(
    now: number,
    delta: number,
    unit: HeroRuntime,
    foes: NinjaBody[],
    scene: Phaser.Scene,
    foeBlock?: BlockController,
  ): void {
    if (!unit.alive) {
      unit.body.stop();
      return;
    }

    const body = unit.body;
    body.tickAmmo(now);
    if (!unit.block.isActive(now)) {
      body.regenStamina(delta, now);
    }
    unit.block.tick(delta, now, body);
    unit.block.sync(now, body);
    unit.dash.apply(now, body);

    const target = nearest(body, foes);
    if (target) {
      body.setAim(target.x - body.x, target.y - body.y);
    } else {
      body.setAim(body.team === 'alpha' ? 1 : -1, 0);
    }

    if (body.status.shouldLockMovement(now) || unit.block.isActive(now) || unit.dash.isActive(now)) {
      if (!body.status.isHitReacting(now) && !body.status.isLunging(now) && !unit.dash.isActive(now)) {
        body.stop();
      }
      unit.attacks.update(now, false, false, body, foes, foeBlock);
      return;
    }

    if (now >= this.nextThinkAt) {
      this.nextThinkAt = now + 280 + ((now + unit.body.x) % 220);
      if (target && distance(body, target) <= body.stats.attackRange * 1.08 && body.canAttack(now)) {
        this.tapQueued = (now + unit.body.y) % 5 > 1;
        this.holdUntil = now + 140;
      }
    }

    this.walk(body, target, scene);

    const inRange = target ? distance(body, target) <= body.stats.attackRange * 1.08 : false;
    const held = now < this.holdUntil && inRange && body.canAttack(now);
    const pressed = this.tapQueued && body.canAttack(now);
    this.tapQueued = false;
    if (!body.down && !unit.block.isActive(now) && !unit.dash.isActive(now) && !body.status.cannotAttack(now)) {
      unit.attacks.update(now, held, pressed, body, foes, foeBlock);
    } else {
      unit.attacks.update(now, false, false, body, foes, foeBlock);
    }
  }

  private walk(body: NinjaBody, target: NinjaBody | undefined, scene: Phaser.Scene): void {
    const preferred = body.stats.attackRange * 0.74;
    let dx: number;
    let dy: number;
    if (target && distance(body, target) < 260) {
      dx = target.x - body.x;
      dy = target.y - body.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < preferred - 20) {
        body.stop();
        return;
      }
      dx /= dist;
      dy /= dist;
    } else {
      const destX = body.team === 'alpha' ? ARENA.width - 320 : 320;
      dx = destX - body.x;
      dy = ARENA.laneY[laneOf(body)] - body.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }
    const steered = battlefieldOf(scene)?.query.steer(body.x, body.y, dx, dy) ?? { x: dx, y: dy };
    if (steered.x === 0 && steered.y === 0) {
      body.stop();
      return;
    }
    this.move.set(steered.x, steered.y);
    body.applyMove(this.move);
  }
}

const laneOf = (body: NinjaBody): 'top' | 'mid' | 'bottom' => {
  const y = body.y;
  if (y < 500) {
    return 'top';
  }
  if (y > 1000) {
    return 'bottom';
  }
  return 'mid';
};

const distance = (a: NinjaBody, b: NinjaBody): number => Math.hypot(a.x - b.x, a.y - b.y);

const nearest = (self: NinjaBody, foes: NinjaBody[]): NinjaBody | undefined => {
  let best: NinjaBody | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const foe of foes) {
    if (foe.down || !foe.isPresent) {
      continue;
    }
    const dist = distance(self, foe);
    if (dist < bestDist) {
      best = foe;
      bestDist = dist;
    }
  }
  return best;
};
