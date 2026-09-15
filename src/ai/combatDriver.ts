import Phaser from 'phaser';
import type { BlockController } from '../combat/BlockController';
import type { DashController } from '../combat/DashController';
import { startDeathDashSweep } from '../heroes/abilities/death/dashSweep';
import type { AbilityController } from '../heroes/abilities/AbilityController';
import type { AbilityContext, AbilitySlot } from '../heroes/abilities/types';
import { SLOT_ORDER, canStartAbility } from '../heroes/abilities/types';
import type { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import type { NinjaBody } from '../heroes/NinjaBody';
import { scoreKitSlot } from './tactical/kitTactics';
import { isShadowDry } from './tactical/kitProfile';
import { FightSense } from './tactical/fightSense';
import type { TacticalMind } from './tactical/mind';
import { dodgeDirFor, scanProjectileThreat } from './tactical/shots';
import { pickBestSupportAlly, purposesOf } from './tactical/supportSense';
import { hellBatAim } from './tactical/demonSense';
import { DEMON_HELL_BAT } from '../heroes/abilities/demon/tunables';
import { evaluateOffensiveDash } from './tactical/dashOffense';

const SLOTS: AbilitySlot[] = SLOT_ORDER;

export type CombatDriverResult = {
  blocking: boolean;
  usedAbility: boolean;
};

type PendingReact = {
  at: number;
  kind: 'block' | 'dash' | 'strafe';
  x: number;
  y: number;
};

type PatternMemory = {
  foeId: number;
  lights: number;
  lastLightAt: number;
  dirX: number;
  dirY: number;
  dirHits: number;
  dashes: number;
  lastDashAt: number;
};

const emptyPattern = (): PatternMemory => ({
  foeId: -1,
  lights: 0,
  lastLightAt: -9999,
  dirX: 0,
  dirY: 0,
  dirHits: 0,
  dashes: 0,
  lastDashAt: -9999,
});

/**
 * Shared CPU reflexes: imperfect dodge/block, kit-aware ability fire, counters.
 * Does not see hidden player intent — only visible swings, facing, and range.
 */
export class CombatDriver {
  private blockUntil = 0;
  private nextDashAt = 0;
  private nextAbilityAt = 0;
  private nextShieldAt = 0;
  private lastSwingSeen = -9999;
  private pending?: PendingReact;
  private readonly strafe = new Phaser.Math.Vector2();
  private strafeUntil = 0;
  private deathDashIndex = 0;
  private readonly dashDir = new Phaser.Math.Vector2();
  readonly reactions = { block: 0, dash: 0, strafe: 0 };
  private pattern = emptyPattern();
  readonly sense = new FightSense();
  private dashWasActive = false;
  private dashLanded = false;
  private nextOffensiveDashAt = 0;

  tick(args: {
    now: number;
    body: NinjaBody;
    mind: TacticalMind;
    block: BlockController;
    dash: DashController;
    abilities?: AbilityController;
    abilityCtx?: AbilityContext;
    world?: AbilityWorld;
    scene: Phaser.Scene;
    foes: NinjaBody[];
    rng: () => number;
  }): CombatDriverResult {
    const { now, body, mind, block, dash, abilities, abilityCtx, world, scene, foes, rng } = args;
    const p = mind.personality;
    let usedAbility = false;
    this.sense.observe(now, body, mind.target);
    const dashing = dash.isActive(now);
    if (this.dashWasActive && !dashing) {
      this.sense.noteDashLand(now);
      this.dashLanded = true;
    }
    this.dashWasActive = dashing;

    if (abilities && abilityCtx) {
      abilities.update(abilityCtx);
      const busy = abilities.isBusy();
      if (busy && body.heroId === 'demon' && body.demonForm === 'bat') {
        const bat = abilities.slotState('ability2', now);
        if (bat.def.id === 'demon-hell-bat' && bat.ready) {
          const inBurst = foes.some(
            (foe) =>
              !foe.down &&
              foe.isPresent &&
              Math.hypot(foe.x - body.x, foe.y - body.y) <= DEMON_HELL_BAT.radius + foe.stats.bodyRadius,
          );
          if (inBurst && abilities.tryActivate('ability2', abilityCtx)) {
            usedAbility = true;
          }
        }
      }
      if (
        !busy &&
        !abilities.control.abilities &&
        now >= this.nextAbilityAt &&
        mind.wantsAbilities() &&
        canStartAbility(abilityCtx)
      ) {
        usedAbility = this.tryAbility(now, body, mind, abilities, abilityCtx, rng);
      }
      if (busy && abilities.control.dash) {
        block.setHeld(now, body, false);
        return { blocking: false, usedAbility: usedAbility || busy };
      }
    }

    if (mind.wantsEscape() && now >= this.nextDashAt && dash.chargeCount > 0 && !abilities?.control.dash) {
      const goal = mind.goal;
      const foe = mind.target;
      this.dashDir.set((goal?.x ?? mind.homeX) - body.x, (goal?.y ?? mind.homeY) - body.y);
      if (foe && rng() < 0.42 + p.flankTendency * 0.2) {
        const dx = body.x - foe.x;
        const dy = body.y - foe.y;
        const side = rng() < 0.5 ? 1 : -1;
        this.dashDir.set(dx * 0.55 + -dy * side, dy * 0.55 + dx * side);
      }
      if (this.dashDir.lengthSq() > 4 && dash.tryStart(now, this.dashDir, body.aim, body)) {
        this.noteDeathDash(now, body, dash, world, scene, foes);
        this.blockUntil = 0;
        this.nextDashAt = now + 480 + p.thinkJitterMs;
        this.nextOffensiveDashAt = now + 640;
        mind.noteCombat('dash-out');
        block.setHeld(now, body, false);
        return { blocking: false, usedAbility };
      }
    }

    if (
      !mind.wantsEscape() &&
      now >= this.nextDashAt &&
      now >= this.nextOffensiveDashAt &&
      dash.chargeCount > 0 &&
      !dash.isActive(now) &&
      !abilities?.control.dash
    ) {
      const plan = evaluateOffensiveDash(mind.situationView(), mind.action, dash.chargeCount, rng);
      if (plan) {
        this.dashDir.set(plan.x, plan.y);
        if (this.dashDir.lengthSq() > 4 && dash.tryStart(now, this.dashDir, body.aim, body)) {
          this.noteDeathDash(now, body, dash, world, scene, foes);
          this.blockUntil = 0;
          this.nextDashAt = now + 720 + rng() * 280 + p.thinkJitterMs;
          this.nextOffensiveDashAt = now + 880 + rng() * 220;
          mind.noteCombat(`dash-${plan.kind}`);
          block.setHeld(now, body, false);
          return { blocking: false, usedAbility };
        }
      }
    }

    this.noticeSwing(now, body, mind, dash, foes, rng);
    this.noticeShot(now, body, mind, dash, rng);
    this.noticeApproach(now, body, mind, rng);
    this.resolvePending(now, body, mind, dash, world, scene, foes, rng);
    this.finishGuard(now, body, mind, rng);

    const holding = now < this.blockUntil && body.canRaiseBlock() && !dash.isActive(now) && !abilities?.control.block;
    if (!holding) {
      this.blockUntil = 0;
    }
    if (this.sense.counterReady(now)) {
      this.blockUntil = 0;
      block.setHeld(now, body, false);
      return { blocking: false, usedAbility };
    }
    block.setHeld(now, body, holding);
    return { blocking: holding, usedAbility };
  }

  strafeDir(now: number): Phaser.Math.Vector2 | undefined {
    return now < this.strafeUntil ? this.strafe : undefined;
  }

  consumeDashLand(): boolean {
    const landed = this.dashLanded;
    this.dashLanded = false;
    return landed;
  }

  private tryAbility(
    now: number,
    body: NinjaBody,
    mind: TacticalMind,
    abilities: AbilityController,
    ctx: AbilityContext,
    rng: () => number,
  ): boolean {
    const situation = mind.situationView();
    if (!situation) {
      return false;
    }
    if (isShadowDry(situation.self.heroId, situation.self) && situation.self.staminaRatio < 0.22) {
      return false;
    }
    if (ctx.caster.status.isEnemyActionLocked(now)) {
      return false;
    }
    const p = situation.personality;
    if (rng() < p.abilityConservation * 0.1) {
      this.nextAbilityAt = now + 240 + rng() * 180;
      return false;
    }
    let bestSlot: AbilitySlot | undefined;
    let bestScore = 18;
    let skippedUlt = false;
    for (const slot of SLOTS) {
      const state = abilities.slotState(slot, now);
      if (!state.ready || state.consumed) {
        continue;
      }
      const score = scoreKitSlot(state.def, situation, slot) + rng() * 6;
      if (slot === 'ultimate' && score < 26 + situation.personality.abilityConservation * 18) {
        skippedUlt = true;
        continue;
      }
      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }
    if (!bestSlot) {
      if (skippedUlt) {
        mind.noteUltSaved(true);
      }
      this.nextAbilityAt = now + 220 + rng() * 180;
      return false;
    }
    if (bestSlot === 'ultimate') {
      mind.noteUltSaved(false);
    }
    const def = abilities.slotState(bestSlot, now).def;
    const purposes = purposesOf(def);
    const prevAim = ctx.aimOverride;
    if (purposes.length > 0) {
      const ally = pickBestSupportAlly(situation, def.tactics?.range ?? 220, purposes, situation.supportFocusId ?? -1);
      if (ally) {
        ctx.aimOverride = { x: ally.x - body.x, y: ally.y - body.y };
      }
    }
    if (def.id === 'demon-hell-bat') {
      const aim = hellBatAim(situation.self, situation.enemies);
      if (aim) {
        ctx.aimOverride = aim;
      }
    }
    const fired = abilities.tryActivate(bestSlot, ctx);
    ctx.aimOverride = prevAim;
    this.nextAbilityAt = now + (fired ? 640 + rng() * 420 : 180);
    return fired;
  }

  private noticeShot(
    now: number,
    body: NinjaBody,
    mind: TacticalMind,
    dash: DashController,
    rng: () => number,
  ): void {
    if (this.pending || now < this.strafeUntil) {
      return;
    }
    const threat = scanProjectileThreat(mind.situationView().self, mind.personality, body.stats.bodyRadius);
    if (!threat?.willHit) {
      return;
    }
    const p = mind.personality;
    const hp = body.health / Math.max(1, body.stats.maxHealth);
    const notice = 0.32 + p.reactionQuality * 0.48 + p.caution * 0.12 + (hp < 0.35 ? 0.15 : 0);
    if (rng() > notice) {
      return;
    }
    if (p.aggression > 0.72 && hp > 0.55 && rng() < 0.38) {
      return;
    }
    const delay = 45 + (1 - p.reactionQuality) * 150 + rng() * (50 + (1 - p.reactionQuality) * 90);
    const side = rng() < 0.5 ? 1 : -1;
    const dir = dodgeDirFor(mind.situationView().self, threat, side);
    let kind: PendingReact['kind'] = 'strafe';
    if (hp < 0.28 && dash.chargeCount > 0 && rng() < 0.45) {
      kind = 'dash';
    }
    this.reactions[kind] += 1;
    this.pending = { at: now + delay, kind, x: dir.x, y: dir.y };
  }

  private noticeSwing(
    now: number,
    body: NinjaBody,
    mind: TacticalMind,
    dash: DashController,
    foes: NinjaBody[],
    rng: () => number,
  ): void {
    if (this.pending) {
      return;
    }
    let threat: NinjaBody | undefined;
    let threatDist = 1e9;
    const consider = (foe: NinjaBody | undefined): void => {
      if (!foe || foe.down) {
        return;
      }
      const dx = body.x - foe.x;
      const dy = body.y - foe.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > foe.stats.attackRange * 1.4) {
        return;
      }
      const facing = (foe.aim.x * dx + foe.aim.y * dy) / d;
      if (facing < 0.12) {
        return;
      }
      if (d < threatDist) {
        threat = foe;
        threatDist = d;
      }
    };
    consider(mind.target);
    for (const foe of foes) {
      consider(foe);
    }
    if (!threat) {
      return;
    }
    const swingAt = threat.status.lastAttackAt;
    if (swingAt <= 0 || swingAt === this.lastSwingSeen || now - swingAt > 260) {
      return;
    }
    const dx = body.x - threat.x;
    const dy = body.y - threat.y;
    const d = Math.hypot(dx, dy) || 1;
    this.lastSwingSeen = swingAt;
    this.noteLight(now, threat);
    const p = mind.personality;
    const delay = 55 + (1 - p.reactionQuality) * 150 + rng() * (60 + (1 - p.reactionQuality) * 90) + p.caution * 20;
    const disruptor = body.stats.role === 'disruptor' || body.stats.role === 'support';
    const canBlock = body.canRaiseBlock();
    const familiar = this.lightFamiliarity();
    const dirFamiliar = this.dirFamiliarity(threat);
    const hp = body.health / Math.max(1, body.stats.maxHealth);
    const aggression = this.sense.aggressionOf(threat);
    const notice = 0.48 + p.reactionQuality * 0.36 + familiar * 0.14 + aggression * 0.08;
    if (rng() > notice) {
      return;
    }
    const dodgeChance =
      (0.16 + p.caution * 0.14 + (disruptor ? 0.12 : 0)) *
      (this.reactions.dash + this.reactions.strafe > this.reactions.block * 2 ? 0.55 : 1);
    const blockChance = Math.min(
      0.82,
      0.28 +
        p.blockTendency * 0.32 +
        familiar * 0.18 +
        dirFamiliar * 0.12 +
        p.caution * 0.1 +
        aggression * 0.16 +
        (hp < 0.36 ? 0.12 : 0) +
        (this.sense.momentum === 'losing' ? 0.12 : 0),
    );
    const roll = rng();
    let kind: PendingReact['kind'] = 'block';
    if (roll < dodgeChance * 0.35 && dash.chargeCount > 0) {
      kind = 'dash';
    } else if (roll < dodgeChance) {
      kind = 'strafe';
    } else if (roll < dodgeChance + blockChance && canBlock) {
      kind = 'block';
    } else {
      return;
    }
    const side = rng() < 0.5 ? 1 : -1;
    this.reactions[kind] += 1;
    this.pending = {
      at: now + delay,
      kind,
      x: (-dy / d) * side,
      y: (dx / d) * side,
    };
  }

  private resolvePending(
    now: number,
    body: NinjaBody,
    mind: TacticalMind,
    dash: DashController,
    world: AbilityWorld | undefined,
    scene: Phaser.Scene,
    foes: NinjaBody[],
    rng: () => number,
  ): void {
    if (!this.pending || now < this.pending.at) {
      return;
    }
    const pending = this.pending;
    this.pending = undefined;
    if (pending.kind === 'block') {
      if (body.canRaiseBlock()) {
        this.blockUntil = now + 280 + rng() * 260 + mind.personality.caution * 80;
        this.sense.noteBlocked(now);
      }
      return;
    }
    if (pending.kind === 'dash' && now >= this.nextDashAt && dash.chargeCount > 0) {
      this.dashDir.set(pending.x, pending.y);
      if (this.dashDir.lengthSq() < 0.2) {
        this.dashDir.set(-body.aim.x, -body.aim.y);
      }
      if (dash.tryStart(now, this.dashDir, body.aim, body)) {
        this.noteDeathDash(now, body, dash, world, scene, foes);
        this.nextDashAt = now + 520 + rng() * 200;
        this.blockUntil = 0;
      }
      return;
    }
    this.strafe.set(pending.x, pending.y);
    this.strafeUntil = now + 180 + rng() * 90;
  }

  /** Raise before the swing when approach + aggression make an attack likely. */
  private noticeApproach(now: number, body: NinjaBody, mind: TacticalMind, rng: () => number): void {
    if (this.pending || now < this.nextShieldAt || now < this.blockUntil) {
      return;
    }
    const foe = mind.target;
    if (!foe || foe.down || !body.canRaiseBlock()) {
      return;
    }
    const d = Math.hypot(foe.x - body.x, foe.y - body.y);
    const theirRange = foe.stats.attackRange;
    const closing = this.sense.closingOn(body, foe);
    const aggression = this.sense.aggressionOf(foe);
    const hp = body.health / Math.max(1, body.stats.maxHealth);
    const stam = body.stamina / Math.max(1, body.stats.maxStamina);
    const p = mind.personality;
    const kit = mind.situationView().kit;
    const front = kit?.stance === 'melee' || body.stats.role === 'tank' || body.stats.role === 'frontliner';
    const ranged = kit?.stance === 'ranged' || kit?.stance === 'support';
    const inDanger =
      (closing && d < theirRange * 1.35) ||
      (aggression > 0.42 && d < theirRange * 1.5) ||
      (this.sense.momentum === 'losing' && d < theirRange * 1.6) ||
      (hp < 0.34 && closing);
    if (!inDanger) {
      return;
    }
    if (this.sense.chaining(now) && this.sense.momentum === 'winning' && hp > 0.4) {
      return;
    }
    const chance =
      0.18 +
      p.blockTendency * 0.28 +
      aggression * 0.22 +
      p.caution * 0.12 +
      (this.sense.momentum === 'losing' ? 0.16 : 0) +
      (stam < 0.22 ? 0.1 : 0) +
      (front ? 0.08 : 0) +
      (ranged ? 0.06 : 0);
    if (rng() > Math.min(0.72, chance)) {
      this.nextShieldAt = now + 90 + rng() * 140;
      return;
    }
    const delay = 40 + (1 - p.reactionQuality) * 140 + rng() * 120;
    this.reactions.block += 1;
    this.nextShieldAt = now + 220 + rng() * 180;
    this.pending = { at: now + delay, kind: 'block', x: 0, y: 0 };
  }

  private finishGuard(now: number, body: NinjaBody, mind: TacticalMind, rng: () => number): void {
    if (now >= this.blockUntil) {
      return;
    }
    const foe = mind.target;
    const p = mind.personality;
    const kit = mind.situationView().kit;
    const front = kit?.stance === 'melee' || body.stats.role === 'frontliner' || body.stats.role === 'tank';
    const ranged = kit?.stance === 'ranged' || kit?.stance === 'support';
    const hp = body.health / Math.max(1, body.stats.maxHealth);
    if (foe && now - foe.status.lastAttackAt < 220 && body.blocking) {
      this.sense.noteBlocked(now);
      const counterChance =
        0.28 + p.aggression * 0.28 + (front ? 0.16 : 0) - p.caution * 0.08 + (this.sense.momentum === 'winning' ? 0.1 : 0);
      if (rng() < counterChance && this.sense.inStrikeRange(body, foe, 1.2)) {
        const delay = 70 + rng() * 200 + (1 - p.reactionQuality) * 80;
        this.sense.openCounter(now, delay);
        this.nextShieldAt = now + 180 + rng() * 160;
        return;
      }
    }
    const stillHot = foe
      ? this.sense.aggressionOf(foe) > 0.5 && this.sense.closingOn(body, foe)
      : false;
    if ((this.sense.momentum === 'losing' || hp < 0.32 || (ranged && stillHot)) && stillHot) {
      this.sense.openSpace(now, 280 + rng() * 180);
      const dx = foe ? body.x - foe.x : -body.aim.x;
      const dy = foe ? body.y - foe.y : -body.aim.y;
      const len = Math.hypot(dx, dy) || 1;
      this.strafe.set(dx / len, dy / len);
      this.strafeUntil = now + 240 + rng() * 140;
    }
    if (!stillHot && now - (foe?.status.lastAttackAt ?? 0) > 260 && rng() < 0.35 + p.decisionConfidence * 0.2) {
      this.blockUntil = Math.min(this.blockUntil, now + 40);
      this.nextShieldAt = now + 140 + rng() * 220;
    }
  }

  private noteLight(now: number, foe: NinjaBody): void {
    if (foe !== this.patternFoe(now)) {
      this.pattern = emptyPattern();
      this.pattern.foeId = 1;
      this.patternFoeRef = foe;
    }
    this.pattern.lights += 1;
    this.pattern.lastLightAt = now;
    const aligned = this.pattern.dirX * foe.aim.x + this.pattern.dirY * foe.aim.y;
    if (aligned > 0.68) {
      this.pattern.dirHits += 1;
    } else {
      this.pattern.dirHits = 1;
      this.pattern.dirX = foe.aim.x;
      this.pattern.dirY = foe.aim.y;
    }
    const speed = Math.hypot(foe.body?.velocity.x ?? 0, foe.body?.velocity.y ?? 0);
    if (speed > 300) {
      this.pattern.dashes += 1;
      this.pattern.lastDashAt = now;
    }
  }

  private patternFoeRef?: NinjaBody;

  private patternFoe(now: number): NinjaBody | undefined {
    if (now - this.pattern.lastLightAt > 2800) {
      return undefined;
    }
    return this.patternFoeRef;
  }

  private lightFamiliarity(): number {
    return Math.max(0, Math.min(1, (this.pattern.lights - 2) / 5));
  }

  private dirFamiliarity(foe: NinjaBody): number {
    const aligned = this.pattern.dirX * foe.aim.x + this.pattern.dirY * foe.aim.y;
    if (aligned < 0.55) {
      return 0;
    }
    return Math.max(0, Math.min(1, (this.pattern.dirHits - 2) / 4));
  }

  private noteDeathDash(
    now: number,
    body: NinjaBody,
    dash: DashController,
    world: AbilityWorld | undefined,
    scene: Phaser.Scene,
    foes: NinjaBody[],
  ): void {
    if (body.heroId !== 'death' || !world) {
      return;
    }
    startDeathDashSweep(scene, world, body, now, this.deathDashIndex, dash.direction, foes);
    this.deathDashIndex += 1;
  }
}
