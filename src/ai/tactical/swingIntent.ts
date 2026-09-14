import type { FightSense } from './fightSense';
import type { KitProfile, Personality, TacticalAction } from './types';
import type { NinjaBody } from '../../heroes/NinjaBody';
import { isShadowDry } from './kitProfile';

export type SwingButtons = {
  held: boolean;
  pressed: boolean;
};

type ObjectiveHint = { kind: string; x: number; y: number; radius: number };

/**
 * Shared light-attack commit for match CPUs and Play Test.
 * Hold = repeating lights. Taps are for punish / counter windows.
 */
export class SwingIntent {
  private tapQueued = false;
  private holdUntil = 0;
  private pauseUntil = 0;
  private hitsIntoBlock = 0;

  decide(args: {
    now: number;
    body: NinjaBody;
    target: NinjaBody | undefined;
    objective?: ObjectiveHint;
    action: TacticalAction;
    wantsAttack: boolean;
    personality: Personality;
    kit: KitProfile | undefined;
    sense: FightSense;
    blocking: boolean;
    rng: () => number;
  }): void {
    const { now, body, target, objective, action, personality, kit, sense, blocking, rng } = args;
    if (blocking || !body.canAttack(now) || now < this.pauseUntil) {
      return;
    }
    const smash = objectiveInHitRange(body, objective, action);
    if (!target) {
      if (!smash || now < this.holdUntil) {
        return;
      }
      this.tapQueued = rng() > 0.45;
      this.holdUntil = now + (this.tapQueued ? 80 : 120 + rng() * 80);
      return;
    }

    const d = Math.hypot(target.x - body.x, target.y - body.y);
    const range = body.stats.attackRange;
    const prefire = sense.shouldPrefire(now, body, target, personality, rng);
    const inMelee = d <= range * 1.12;
    const reachMul = prefire ? 1.22 + rng() * 0.18 : 1.08;
    const reachable = d <= range * reachMul;
    if (!reachable && !smash) {
      return;
    }
    if (!reachable && smash && now >= this.holdUntil) {
      this.tapQueued = rng() > 0.45;
      this.holdUntil = now + (this.tapQueued ? 80 : 120);
      return;
    }
    if (now < this.holdUntil) {
      return;
    }

    const dry = isShadowDry(body.heroId, {
      staminaRatio: body.stamina / Math.max(1, body.stats.maxStamina),
      abilityReady: body.kitAbilityReady,
      dashCharges: body.kitDashCharges,
    });
    const committed =
      args.wantsAttack ||
      (inMelee &&
        !dry &&
        (action === 'wait_for_opening' ||
          action === 'hold_position' ||
          action === 'reposition' ||
          action === 'contest_objective'));
    if (!committed && !smash) {
      return;
    }
    if (!sense.staminaWorthSwing(now, body, target, personality, kit) && !sense.counterReady(now)) {
      this.pauseUntil = now + 70 + rng() * 90;
      return;
    }

    if (target.blocking) {
      this.hitsIntoBlock += 1;
      const notice = 0.28 + personality.reactionQuality * 0.28 + personality.caution * 0.12;
      if (this.hitsIntoBlock >= 2 && rng() < notice) {
        this.pauseUntil = now + 120 + rng() * 180;
        this.holdUntil = this.pauseUntil;
        return;
      }
    } else {
      this.hitsIntoBlock = 0;
    }

    if (sense.counterReady(now) || target.status.isBlockStunned(now) || target.status.isHitReacting(now)) {
      this.tapQueued = rng() < 0.62;
      this.holdUntil = now + (this.tapQueued ? 70 : 160 + rng() * 80);
      sense.noteSelfSwing(now, true);
      return;
    }

    if (action === 'wait_for_opening' && !inMelee && !prefire && !isOpening(now, body, target, rng)) {
      return;
    }

    const hesitate =
      0.035 +
      personality.caution * 0.05 +
      (target.blocking ? 0.1 : 0) +
      (kit?.stance === 'support' ? 0.04 : 0);
    const meleeMul = inMelee ? 0.22 : 1;
    if (!prefire && rng() < hesitate * meleeMul) {
      this.pauseUntil = now + 50 + rng() * 90;
      return;
    }

    const chain = sense.shouldChainLights(now, body, target, personality, kit, rng);
    if (chain) {
      this.tapQueued = false;
      const burst = 260 + rng() * 220 + (kit?.pressureBias ?? 0.5) * 240 + (body.heroId === 'shadow' ? 120 : 0);
      this.holdUntil = now + burst;
      sense.startChain(now, burst);
      sense.noteSelfSwing(now, d <= range * 1.05);
      return;
    }

    this.tapQueued = rng() > 0.52 + personality.aggression * 0.16 + (kit?.pressureBias ?? 0.5) * 0.1;
    this.holdUntil = now + (this.tapQueued ? 80 : 120 + rng() * 100 + personality.patience * 24);
    sense.noteSelfSwing(now, d <= range * 1.05);
  }

  buttons(
    now: number,
    inRange: boolean,
    canAttack: boolean,
    committed: boolean,
  ): SwingButtons {
    const held = now < this.holdUntil && inRange && canAttack && committed && !this.tapQueued;
    const pressed = this.tapQueued && canAttack && committed;
    this.tapQueued = false;
    return { held, pressed };
  }
}

const objectiveInHitRange = (
  body: NinjaBody,
  objective: ObjectiveHint | undefined,
  action: TacticalAction,
): boolean => {
  if (!objective || action !== 'contest_objective') {
    return false;
  }
  if (objective.kind !== 'golden_piggy' && objective.kind !== 'executioner') {
    return false;
  }
  return Math.hypot(body.x - objective.x, body.y - objective.y) <= body.stats.attackRange + objective.radius + 10;
};

const isOpening = (now: number, self: NinjaBody, target: NinjaBody, rng: () => number): boolean => {
  if (target.status.isBlockStunned(now) || target.status.isHitReacting(now)) {
    return true;
  }
  const sinceSwing = now - target.status.lastAttackAt;
  if (sinceSwing > 140 && sinceSwing < 420) {
    return rng() < 0.62;
  }
  if (target.stamina < 12 && Math.hypot(self.x - target.x, self.y - target.y) <= self.stats.attackRange * 1.15) {
    return rng() < 0.5;
  }
  return rng() < 0.14;
};
