import Phaser from 'phaser';
import type { BlockController } from '../combat/BlockController';
import type { DashController } from '../combat/DashController';
import { startDeathDashSweep } from '../heroes/abilities/death/dashSweep';
import type { AbilityController } from '../heroes/abilities/AbilityController';
import type { AbilityContext, AbilitySlot } from '../heroes/abilities/types';
import { SLOT_ORDER, canStartAbility } from '../heroes/abilities/types';
import type { AbilityWorld } from '../heroes/abilities/AbilityWorld';
import type { NinjaBody } from '../heroes/NinjaBody';
import { evaluateUltimate, scoreKitSlot } from './tactical/kitTactics';
import { isShadowDry } from './tactical/kitProfile';
import { combatIdentityOf } from './tactical/combatIdentity';
import {
  blankPose,
  habitBand,
  pickPose,
  type FightFlag,
  type FightSample,
  type PoseRead,
} from './tactical/combatPose';
import { FightSense } from './tactical/fightSense';
import type { TacticalMind } from './tactical/mind';
import { dodgeDirFor, scanProjectileThreat } from './tactical/shots';
import { pickBestSupportAlly, purposesOf } from './tactical/supportSense';
import { hellBatAim } from './tactical/demonSense';
import { DEMON_HELL_BAT } from '../heroes/abilities/demon/tunables';
import { COMBAT } from '../config/combat';
import { battlefieldOf } from '../map';
import { evaluateOffensiveDash } from './tactical/dashOffense';
import type { StuckTracker } from './tactical/stuck';

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
  private readonly pose: PoseRead = blankPose();
  private readonly flags: FightFlag[] = [];
  private readonly sample: FightSample = {
    dist: 999,
    selfRange: 80,
    foeRange: 80,
    closing: 0,
    foeAttacking: false,
    foeStartup: false,
    foeActive: false,
    foeRecoveryMs: 0,
    foeHitReactMs: 0,
    foeBlocking: false,
    foeShield: 1,
    foeStamina: 1,
    foeDash: 2,
    foeRecentDash: false,
    foeRecentAbility: false,
    foeWhiff: false,
    foeRecentHit: false,
    foeHp: 1,
    foeAlliesNear: 0,
    foePressured: false,
    selfHp: 1,
    selfStamina: 1,
    selfBlocking: false,
    selfDash: 2,
    selfAbilityReady: true,
    selfRecovering: false,
    alliesNear: 0,
    enemiesNear: 0,
    allyDanger: false,
    allyCritical: false,
    knock: 'none',
  };
  private nextPoseAt = 0;
  private nextHabitAt = 0;
  private lastWhiffSwing = -1;
  private approachSeen = false;
  private approachSeenAt = -9999;
  private lastFinisherAt = -1;
  private lastShieldCheck = -1;
  private foeAbilityWas = true;
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
    stuck?: StuckTracker;
  }): CombatDriverResult {
    const { now, body, mind, block, dash, abilities, abilityCtx, world, scene, foes, rng, stuck } = args;
    const p = mind.personality;
    let usedAbility = false;
    this.sense.observe(now, body, mind.target);
    this.refreshPose(now, body, mind, foes, rng);
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
      stuck?.recovering &&
      now >= this.nextDashAt &&
      dash.chargeCount > 0 &&
      !dash.isActive(now) &&
      !abilities?.control.dash
    ) {
      const escape = stuck.dashEscape(now);
      if (escape) {
        const kit = mind.situationView().kit;
        let chance = 0.14 + p.riskTolerance * 0.12;
        if (kit?.stance === 'melee' || kit?.stance === 'skirmish') {
          chance += 0.2;
        }
        if (kit?.stance === 'ranged') {
          chance -= 0.04;
        }
        if (kit?.stance === 'support') {
          chance -= 0.08;
        }
        if (String(body.stats.role) === 'tank') {
          chance -= 0.03;
        }
        if (dash.chargeCount <= 1) {
          chance *= 0.52;
        }
        const query = battlefieldOf(scene)?.query;
        const landX = body.x + escape.x * COMBAT.dashDistance;
        const landY = body.y + escape.y * COMBAT.dashDistance;
        if (query?.blocksMovement(landX, landY, 14)) {
          chance = 0;
        }
        if (rng() < chance) {
          this.dashDir.set(escape.x, escape.y);
          if (this.dashDir.lengthSq() > 4 && dash.tryStart(now, this.dashDir, body.aim, body)) {
            this.noteDeathDash(now, body, dash, world, scene, foes);
            stuck.markDashed(now);
            this.blockUntil = 0;
            this.nextDashAt = now + 720 + p.thinkJitterMs;
            this.nextOffensiveDashAt = now + 900;
            mind.noteCombat('dash-unstuck');
            block.setHeld(now, body, false);
            return { blocking: false, usedAbility };
          }
        }
      }
    }

    const poseName = this.pose.pose;
    const punishDash =
      mind.target &&
      Math.hypot(mind.target.x - body.x, mind.target.y - body.y) > body.stats.attackRange * 0.92 &&
      (this.pose.shield === 'dash-around' ||
        ((poseName === 'PUNISH' || poseName === 'FINISH') && this.pose.punishTake));
    if (
      punishDash &&
      now >= this.nextDashAt &&
      dash.chargeCount > 0 &&
      !dash.isActive(now) &&
      !abilities?.control.dash &&
      mind.target
    ) {
      const foe = mind.target;
      const side = this.pose.shield === 'dash-around' ? (rng() < 0.5 ? 1 : -1) : 0;
      this.dashDir.set(foe.x - body.x + -(foe.y - body.y) * side * 0.45, foe.y - body.y + (foe.x - body.x) * side * 0.45);
      if (this.dashDir.lengthSq() > 4 && dash.tryStart(now, this.dashDir, body.aim, body)) {
        this.noteDeathDash(now, body, dash, world, scene, foes);
        this.blockUntil = 0;
        this.nextDashAt = now + 640 + rng() * 180;
        this.nextOffensiveDashAt = now + 800;
        mind.noteCombat(this.pose.shield === 'dash-around' ? 'dash-around' : 'dash-punish');
        block.setHeld(now, body, false);
        return { blocking: false, usedAbility };
      }
    }

    if (
      poseName !== 'DISENGAGE' &&
      poseName !== 'BAIT' &&
      poseName !== 'RESET' &&
      poseName !== 'DEFEND' &&
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
    const ultState = abilities.slotState('ultimate', now);
    const ultReady = ultState.ready && !ultState.consumed;
    const pendingUlt = ultReady ? evaluateUltimate(ultState.def, situation) : undefined;
    if (rng() < p.abilityConservation * 0.1 && pendingUlt?.decision !== 'use') {
      this.nextAbilityAt = now + 240 + rng() * 180;
      if (pendingUlt) {
        mind.noteUltDecision(pendingUlt.decision, pendingUlt.reason, pendingUlt.current, pendingUlt.future);
      }
      return false;
    }
    let bestSlot: AbilitySlot | undefined;
    let bestScore = 18;
    let skippedUlt = false;
    let ultRead = pendingUlt;
    for (const slot of SLOTS) {
      const state = abilities.slotState(slot, now);
      if (!state.ready || state.consumed) {
        continue;
      }
      const score = scoreKitSlot(state.def, situation, slot) + (slot === 'ultimate' ? rng() * 3 : rng() * 6);
      if (slot === 'ultimate') {
        ultRead = evaluateUltimate(state.def, situation);
        const bar = 22 + situation.personality.abilityConservation * 12;
        if (ultRead.decision !== 'use' || score < bar) {
          skippedUlt = true;
          mind.noteUltDecision(ultRead.decision, ultRead.reason, ultRead.current, ultRead.future);
          continue;
        }
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
      if (ultRead) {
        mind.noteUltDecision('use', ultRead.reason, ultRead.current, ultRead.future);
      }
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

  private refreshPose(
    now: number,
    body: NinjaBody,
    mind: TacticalMind,
    foes: NinjaBody[],
    rng: () => number,
  ): void {
    const foe = mind.target;
    const situation = mind.situationView();
    let foeAllies = 0;
    if (foe) {
      for (const other of foes) {
        if (other !== foe && !other.down && Math.hypot(other.x - foe.x, other.y - foe.y) < 170) {
          foeAllies += 1;
        }
      }
      this.watchWhiff(now, body, foe, situation);
    }
    this.sense.noteKnock(now, body, foe, foeAllies);
    if (foe && now >= this.nextHabitAt) {
      this.watchHabits(now, body, foe);
      this.nextHabitAt = now + 220;
    }
    if (foe) {
      this.watchAlternate(now, body, mind, foes, situation);
    }
    const whiffNow = Boolean(foe && this.sense.whiffOpen(now, foe));
    if (now < this.nextPoseAt && !whiffNow) {
      return;
    }
    this.nextPoseAt = now + 90;
    if (!foe) {
      this.pose.pose = 'APPROACH';
      this.pose.swing = 'hold';
      this.pose.reason = 'no target';
      mind.notePose(this.pose, '');
      return;
    }
    this.fillSample(now, body, foe, situation, foeAllies);
    const identity = combatIdentityOf(body.heroId, body.demonForm);
    const habits = this.sense.habitRead(now, foe);
    pickPose({
      now,
      sample: this.sample,
      personality: mind.personality,
      identity,
      habits,
      previous: this.pose,
      rng,
      out: this.pose,
      flags: this.flags,
    });
    const lead = this.leadHabit(habits);
    mind.notePose(this.pose, lead);
    if (this.pose.punishTake && (this.pose.pose === 'PUNISH' || this.pose.pose === 'FINISH')) {
      const delay = 48 + (1 - mind.personality.reactionQuality) * 170 + rng() * 40;
      this.sense.openCounter(now, delay);
    }
    if (this.pose.swing === 'hold' && (this.pose.pose === 'BAIT' || this.pose.pose === 'DISENGAGE' || this.pose.pose === 'RESET')) {
      this.sense.openSpace(now, 220 + rng() * 120);
    }
  }

  private fillSample(
    now: number,
    body: NinjaBody,
    foe: NinjaBody,
    situation: ReturnType<TacticalMind['situationView']>,
    foeAllies: number,
  ): void {
    const dx = body.x - foe.x;
    const dy = body.y - foe.y;
    const dist = Math.hypot(dx, dy) || 1;
    const vx = foe.body?.velocity.x ?? 0;
    const vy = foe.body?.velocity.y ?? 0;
    const speed = Math.hypot(vx, vy);
    const closing = speed < 16 ? 0 : (vx * dx + vy * dy) / (speed * dist);
    const swingAt = foe.status.lastAttackAt;
    const since = swingAt > 0 ? now - swingAt : 9999;
    const recovery = foe.status.remainingRecoveryMs(now);
    const react = foe.status.remainingHitReactionMs(now);
    const sample = this.sample;
    sample.dist = dist;
    sample.selfRange = body.stats.attackRange;
    sample.foeRange = foe.stats.attackRange;
    sample.closing = closing;
    sample.foeAttacking = since < 280;
    sample.foeStartup = since >= 0 && since < 100 && recovery < 24 && react < 24;
    sample.foeActive = since >= 36 && since < 220 && recovery < 28;
    sample.foeRecoveryMs = recovery;
    sample.foeHitReactMs = react;
    sample.foeBlocking = foe.blocking;
    sample.foeShield = foe.blockShield / Math.max(1, foe.maxBlockShield);
    sample.foeStamina = foe.stamina / Math.max(1, foe.stats.maxStamina);
    sample.foeDash = foe.kitDashCharges;
    sample.foeRecentDash = speed > 320 && since < 420;
    sample.foeRecentAbility = !foe.kitAbilityReady && since < 900;
    sample.foeWhiff = this.sense.whiffOpen(now, foe);
    sample.foeRecentHit = now - foe.lastAttackerAt < 420;
    sample.foeHp = foe.health / Math.max(1, foe.stats.maxHealth);
    sample.foeAlliesNear = foeAllies;
    sample.foePressured = foe.status.remainingSlowMs(now) > 40 && (foe.blocking || sample.foeShield < 0.9);
    sample.selfHp = body.health / Math.max(1, body.stats.maxHealth);
    sample.selfStamina = body.stamina / Math.max(1, body.stats.maxStamina);
    sample.selfBlocking = body.blocking;
    sample.selfDash = body.kitDashCharges;
    sample.selfAbilityReady = body.kitAbilityReady;
    sample.selfRecovering = body.status.isHitReacting(now);
    let allies = 0;
    let allyDanger = false;
    let allyCritical = false;
    for (const ally of situation.allies) {
      if (ally.kind !== 'hero' || Math.hypot(ally.x - body.x, ally.y - body.y) > 280) {
        continue;
      }
      allies += 1;
      const hurt = ally.hpRatio < 0.46 && (ally.recentlyHit || ally.hpRatio < 0.32);
      if (hurt) {
        allyDanger = true;
        if (ally.heroId === 'mender' || ally.role === 'support' || ally.hpRatio < 0.28) {
          allyCritical = true;
        }
      }
    }
    sample.alliesNear = allies;
    sample.enemiesNear = foeAllies + 1;
    sample.allyDanger = allyDanger;
    sample.allyCritical = allyCritical;
    sample.knock = now < 1 ? 'none' : this.sense.knock;
  }

  private watchWhiff(
    now: number,
    body: NinjaBody,
    foe: NinjaBody,
    situation: ReturnType<TacticalMind['situationView']>,
  ): void {
    const swingAt = foe.status.lastAttackAt;
    const recovery = foe.status.remainingRecoveryMs(now);
    if (swingAt <= 0 || swingAt === this.lastWhiffSwing || recovery < 48 || now - swingAt > 720) {
      return;
    }
    const hitSelf = body.lastAttacker === foe && now - body.lastAttackerAt < 200;
    const foeId = situation.enemies.find((enemy) => enemy.heroId === foe.heroId && Math.hypot(enemy.x - foe.x, enemy.y - foe.y) < 8)?.id;
    let hitAlly = false;
    if (foeId !== undefined) {
      for (const ally of situation.allies) {
        if (ally.lastAttackerId === foeId && ally.recentlyHit) {
          hitAlly = true;
          break;
        }
      }
    }
    const dist = Math.hypot(foe.x - body.x, foe.y - body.y);
    const outside = dist > foe.stats.attackRange * 1.06;
    this.lastWhiffSwing = swingAt;
    if (!hitSelf && !hitAlly && (outside || recovery > 70)) {
      this.sense.noteWhiff(now, foe, recovery);
    }
  }

  private watchHabits(now: number, body: NinjaBody, foe: NinjaBody): void {
    const dist = Math.hypot(foe.x - body.x, foe.y - body.y);
    const closing = this.sense.closingOn(body, foe);
    const attacked = now - foe.status.lastAttackAt < 260 && foe.status.lastAttackAt > 0;
    if (closing && dist < body.stats.attackRange * 1.6) {
      if (!this.approachSeen) {
        this.approachSeen = true;
        this.approachSeenAt = now;
      }
    }
    if (this.approachSeen && (attacked || now - this.approachSeenAt > 680)) {
      this.sense.noteHabit(now, foe, 'attack-on-approach', attacked && now - this.approachSeenAt < 460);
      this.approachSeen = false;
    }
    const recovery = foe.status.remainingRecoveryMs(now);
    if (recovery > 145 && foe.status.lastAttackAt !== this.lastFinisherAt) {
      this.lastFinisherAt = foe.status.lastAttackAt;
      this.sense.noteHabit(now, foe, 'finisher', true);
    }
    if (foe.lastAttackerAt > 0 && foe.lastAttackerAt !== this.lastShieldCheck && now - foe.lastAttackerAt > 340 && now - foe.lastAttackerAt < 760) {
      this.lastShieldCheck = foe.lastAttackerAt;
      this.sense.noteHabit(now, foe, 'shield-after-hit', foe.blocking);
      if (foe.health / Math.max(1, foe.stats.maxHealth) < 0.4) {
        this.sense.noteHabit(now, foe, 'shield-low-hp', foe.blocking);
      }
    }
    const vx = foe.body?.velocity.x ?? 0;
    const vy = foe.body?.velocity.y ?? 0;
    const speed = Math.hypot(vx, vy);
    if (speed > 300) {
      const away = vx * (foe.x - body.x) + vy * (foe.y - body.y);
      this.sense.noteHabit(now, foe, 'dash-back', away > 0);
    }
    if (this.foeAbilityWas && !foe.kitAbilityReady) {
      this.sense.noteHabit(now, foe, 'same-ability', true);
    }
    this.foeAbilityWas = foe.kitAbilityReady;
  }

  private watchAlternate(
    now: number,
    body: NinjaBody,
    mind: TacticalMind,
    foes: NinjaBody[],
    situation: ReturnType<TacticalMind['situationView']>,
  ): void {
    const current = mind.target;
    let best: NinjaBody | undefined;
    let bestScore = 0;
    let punish = false;
    let finish = false;
    let peel = false;
    for (const enemy of foes) {
      if (enemy.down || enemy === current) {
        continue;
      }
      const d = Math.hypot(enemy.x - body.x, enemy.y - body.y);
      if (d > body.stats.attackRange * 2.8) {
        continue;
      }
      let score = 10;
      const recovery = enemy.status.remainingRecoveryMs(now);
      const react = enemy.status.remainingHitReactionMs(now);
      const hp = enemy.health / Math.max(1, enemy.stats.maxHealth);
      const enemyPunish = recovery > 80 || react > 100;
      const enemyFinish = hp < 0.2;
      if (enemyPunish) {
        score += 18;
      }
      if (hp < 0.25) {
        score += 14;
      }
      let guards = 0;
      for (const other of foes) {
        if (other !== enemy && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 150) {
          guards += 1;
        }
      }
      if (guards > 0) {
        score -= 8;
      }
      let enemyPeel = false;
      for (const ally of situation.allies) {
        if (ally.kind !== 'hero' || ally.hpRatio > 0.42 || !ally.recentlyHit) {
          continue;
        }
        if (Math.hypot(ally.x - enemy.x, ally.y - enemy.y) < 150) {
          score += ally.heroId === 'mender' || ally.role === 'support' ? 16 : 8;
          enemyPeel = true;
        }
      }
      score -= d * 0.02;
      if (score > bestScore) {
        bestScore = score;
        best = enemy;
        punish = enemyPunish;
        finish = enemyFinish;
        peel = enemyPeel;
      }
    }
    if (best && bestScore > 22) {
      mind.offerTarget(now, best, bestScore, peel ? 'peel' : finish ? 'finish' : 'punish-switch', {
        punish,
        finish,
        peel,
      });
    }
  }

  private leadHabit(habits: ReturnType<FightSense['habitRead']>): string {
    const pairs: Array<[string, number]> = [
      ['approach', habits.attackOnApproach],
      ['finisher', habits.finisher],
      ['shield', habits.shieldAfterHit],
      ['dash-back', habits.dashBack],
      ['ability', habits.sameAbility],
    ];
    let name = '';
    let best = 0.38;
    for (const [label, value] of pairs) {
      if (value > best) {
        best = value;
        name = label;
      }
    }
    if (!name) {
      return '';
    }
    return `${name} ${habitBand(best)} ${best.toFixed(2)}`;
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
