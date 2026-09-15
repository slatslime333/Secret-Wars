import type { NinjaBody } from '../../heroes/NinjaBody';
import { isShadowDry } from './kitProfile';
import type { KitProfile, Personality } from './types';

export type FightMomentum = 'winning' | 'even' | 'losing';

type FoeTrace = {
  ref: NinjaBody;
  approaches: number;
  attacks: number;
  closes: number;
  lastCloseAt: number;
  lastAttackAt: number;
  lastSeenAt: number;
  aggression: number;
};

const closingDot = (from: NinjaBody, toX: number, toY: number): number => {
  const vx = from.body?.velocity.x ?? 0;
  const vy = from.body?.velocity.y ?? 0;
  const speed = Math.hypot(vx, vy);
  if (speed < 16) {
    return 0;
  }
  const dx = toX - from.x;
  const dy = toY - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return (vx * dx + vy * dy) / (speed * len);
};

/**
 * Visible-only fight memory. Builds aggression over several interactions
 * and guesses whether spending stamina is worth the exchange.
 */
export class FightSense {
  private readonly traces = new Map<NinjaBody, FoeTrace>();
  private hpAtSample = 1;
  private foeHpAtSample = 1;
  private sampleAt = -9999;
  private connectedUntil = 0;
  private tookHitUntil = 0;
  private blockedUntil = 0;
  private counterUntil = 0;
  private spaceUntil = 0;
  private chainUntil = 0;
  private lastSelfSwingAt = -9999;
  private connects = 0;
  private dashLandUntil = 0;
  momentum: FightMomentum = 'even';

  observe(now: number, self: NinjaBody, target: NinjaBody | undefined): void {
    if (now - this.sampleAt > 280) {
      const hp = self.health / Math.max(1, self.stats.maxHealth);
      const foeHp = target ? target.health / Math.max(1, target.stats.maxHealth) : this.foeHpAtSample;
      const selfDrop = this.hpAtSample - hp;
      const foeDrop = this.foeHpAtSample - foeHp;
      if (foeDrop > selfDrop + 0.04 || (this.connects >= 2 && foeHp < hp - 0.06)) {
        this.momentum = 'winning';
      } else if (selfDrop > foeDrop + 0.05 || hp < foeHp - 0.18) {
        this.momentum = 'losing';
      } else {
        this.momentum = 'even';
      }
      this.hpAtSample = hp;
      this.foeHpAtSample = foeHp;
      this.sampleAt = now;
    }
    if (now - self.lastAttackerAt < 90) {
      this.tookHitUntil = now + 420;
    }
    if (target) {
      this.noteFoe(now, self, target);
    }
    for (const [ref, trace] of this.traces) {
      if (ref.down || now - trace.lastSeenAt > 2800) {
        this.traces.delete(ref);
      }
    }
  }

  noteSelfSwing(now: number, connected: boolean): void {
    this.lastSelfSwingAt = now;
    if (connected) {
      this.connects = Math.min(8, this.connects + 1);
      this.connectedUntil = now + 640;
    } else if (now - this.connectedUntil > 900) {
      this.connects = Math.max(0, this.connects - 1);
    }
  }

  noteBlocked(now: number): void {
    this.blockedUntil = now + 380;
  }

  openCounter(now: number, delayMs: number): void {
    this.counterUntil = now + delayMs;
  }

  openSpace(now: number, durationMs: number): void {
    this.spaceUntil = now + durationMs;
  }

  startChain(now: number, durationMs: number): void {
    this.chainUntil = Math.max(this.chainUntil, now + durationMs);
  }

  noteDashLand(now: number): void {
    this.dashLandUntil = now + 420;
  }

  justEngaged(now: number): boolean {
    return now < this.dashLandUntil;
  }

  counterReady(now: number): boolean {
    return now < this.counterUntil && now > this.counterUntil - 260;
  }

  wantsSpace(now: number): boolean {
    return now < this.spaceUntil;
  }

  chaining(now: number): boolean {
    return now < this.chainUntil;
  }

  aggressionOf(foe: NinjaBody | undefined): number {
    if (!foe) {
      return 0;
    }
    return this.traces.get(foe)?.aggression ?? 0;
  }

  closingOn(self: NinjaBody, foe: NinjaBody): boolean {
    return closingDot(foe, self.x, self.y) > 0.32;
  }

  inStrikeRange(self: NinjaBody, foe: NinjaBody, pad = 1.1): boolean {
    return Math.hypot(foe.x - self.x, foe.y - self.y) <= self.stats.attackRange * pad;
  }

  aimLead(foe: NinjaBody, rng: () => number): { x: number; y: number } {
    const vx = foe.body?.velocity.x ?? 0;
    const vy = foe.body?.velocity.y ?? 0;
    const p = 0.11 + rng() * 0.16;
    if (rng() < 0.1) {
      return { x: foe.x - vx * p * 0.8, y: foe.y - vy * p * 0.8 };
    }
    if (rng() < 0.08) {
      const miss = (rng() - 0.5) * 70;
      return { x: foe.x + vx * p + miss, y: foe.y + vy * p - miss * 0.4 };
    }
    return { x: foe.x + vx * p, y: foe.y + vy * p };
  }

  /** Human-like: start the swing a beat before they enter the wedge. */
  shouldPrefire(now: number, self: NinjaBody, foe: NinjaBody, personality: Personality, rng: () => number): boolean {
    const d = Math.hypot(foe.x - self.x, foe.y - self.y);
    const range = self.stats.attackRange;
    if (d <= range * 1.02) {
      return false;
    }
    if (d > range * 1.42) {
      return false;
    }
    const closing = this.closingOn(self, foe);
    const approach = this.traces.get(foe);
    const repeats = (approach?.approaches ?? 0) >= 2 && now - (approach?.lastCloseAt ?? 0) < 1800;
    if (!closing && !repeats) {
      return false;
    }
    const speed = Math.hypot(foe.body?.velocity.x ?? 0, foe.body?.velocity.y ?? 0);
    const eta = speed > 12 ? (d - range * 0.9) / speed : 1;
    const window = 0.14 + personality.opportunism * 0.1 + rng() * 0.16;
    if (eta < 0 || eta > window) {
      return rng() < 0.08 && closing;
    }
    const notice = 0.38 + personality.reactionQuality * 0.4 + personality.opportunism * 0.12;
    return rng() < notice;
  }

  staminaWorthSwing(
    now: number,
    self: NinjaBody,
    foe: NinjaBody | undefined,
    personality: Personality,
    kit: KitProfile | undefined,
  ): boolean {
    const stam = self.stamina / Math.max(1, self.stats.maxStamina);
    const hp = self.health / Math.max(1, self.stats.maxHealth);
    const foeHp = foe ? foe.health / Math.max(1, foe.stats.maxHealth) : 1;
    const inMelee = foe ? this.inStrikeRange(self, foe, 1.16) : false;
    const finish = foeHp < 0.2 || Boolean(foe?.status.isHitReacting(now) || foe?.status.isBlockStunned(now));
    const engaged = this.justEngaged(now) && inMelee;
    if (foe && isShadowDry(self.heroId, {
      staminaRatio: stam,
      abilityReady: self.kitAbilityReady,
      dashCharges: self.kitDashCharges,
    })) {
      return finish && inMelee && foeHp < 0.12;
    }
    if (stam >= 0.42 || engaged) {
      return true;
    }
    if (inMelee && (this.momentum === 'winning' || this.connects >= 2 || foeHp < 0.38 || engaged)) {
      return stam > 0.06 || finish;
    }
    if (finish && inMelee) {
      return true;
    }
    if (stam < 0.12 && !finish) {
      return false;
    }
    if (stam < 0.22 && this.momentum === 'losing' && hp < 0.4 && !inMelee) {
      return false;
    }
    const pressure = kit?.pressureBias ?? personality.aggression;
    return inMelee ? stam > 0.1 || pressure > 0.7 : stam > 0.28;
  }

  shouldChainLights(
    now: number,
    self: NinjaBody,
    foe: NinjaBody,
    personality: Personality,
    kit: KitProfile | undefined,
    rng: () => number,
  ): boolean {
    if (!this.inStrikeRange(self, foe, 1.14)) {
      return false;
    }
    if (!this.staminaWorthSwing(now, self, foe, personality, kit)) {
      return false;
    }
    if (this.momentum === 'losing' && self.health / Math.max(1, self.stats.maxHealth) < 0.28) {
      return rng() < 0.12;
    }
    const stam = self.stamina / Math.max(1, self.stats.maxStamina);
    if (stam < 0.1 && foe.health / Math.max(1, foe.stats.maxHealth) > 0.28) {
      return false;
    }
    const recovering =
      foe.status.isHitReacting(now) || foe.status.isBlockStunned(now) || now - foe.status.lastAttackAt < 280;
    const low = foe.health / Math.max(1, foe.stats.maxHealth) < 0.36;
    const connected = now < this.connectedUntil || this.connects >= 1 || now - this.lastSelfSwingAt < 320;
    const aggressive = this.aggressionOf(foe) > 0.45;
    const justBlocked = now < this.blockedUntil;
    const justHit = now < this.tookHitUntil;
    const pressure = kit?.pressureBias ?? 0.55;
    const shadow = self.heroId === 'shadow';
    const engaged = this.justEngaged(now);
    let chance =
      0.22 +
      pressure * 0.42 +
      personality.aggression * 0.18 +
      (connected ? 0.22 : 0) +
      (recovering ? 0.18 : 0) +
      (low ? 0.16 : 0) +
      (this.momentum === 'winning' ? 0.16 : 0) +
      (aggressive ? 0.08 : 0) +
      (justBlocked ? 0.1 : 0) +
      (justHit ? -0.12 : 0) +
      (shadow ? 0.18 : 0) +
      (engaged ? 0.28 : 0);
    if (kit?.stance === 'ranged' || kit?.stance === 'support') {
      chance *= 0.45;
    }
    if (this.momentum === 'losing') {
      chance *= 0.55;
    }
    return rng() < Math.min(0.92, chance);
  }

  private noteFoe(now: number, self: NinjaBody, foe: NinjaBody): void {
    let trace = this.traces.get(foe);
    if (!trace) {
      trace = {
        ref: foe,
        approaches: 0,
        attacks: 0,
        closes: 0,
        lastCloseAt: -9999,
        lastAttackAt: -9999,
        lastSeenAt: now,
        aggression: 0,
      };
      this.traces.set(foe, trace);
    }
    trace.lastSeenAt = now;
    const d = Math.hypot(foe.x - self.x, foe.y - self.y);
    const closing = this.closingOn(self, foe);
    if (closing && d < self.stats.attackRange * 2.1 && now - trace.lastCloseAt > 260) {
      trace.approaches += 1;
      trace.closes += 1;
      trace.lastCloseAt = now;
    }
    const swingAt = foe.status.lastAttackAt;
    if (swingAt > 0 && swingAt !== trace.lastAttackAt && now - swingAt < 280) {
      trace.attacks += 1;
      trace.lastAttackAt = swingAt;
    }
    const raw = Math.min(1, (trace.approaches - 1) * 0.18 + (trace.attacks - 1) * 0.22 + (trace.closes > 2 ? 0.12 : 0));
    trace.aggression += (raw - trace.aggression) * 0.28;
    if (now - trace.lastAttackAt > 1600 && now - trace.lastCloseAt > 1600) {
      trace.aggression *= 0.92;
    }
  }
}
