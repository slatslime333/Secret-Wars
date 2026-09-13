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
import type { TacticalMind } from './tactical/mind';
import { dodgeDirFor, scanProjectileThreat } from './tactical/shots';

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
  private lastSwingSeen = -9999;
  private pending?: PendingReact;
  private readonly strafe = new Phaser.Math.Vector2();
  private strafeUntil = 0;
  private deathDashIndex = 0;
  private readonly dashDir = new Phaser.Math.Vector2();
  readonly reactions = { block: 0, dash: 0, strafe: 0 };
  private pattern = emptyPattern();

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

    if (abilities && abilityCtx) {
      abilities.update(abilityCtx);
      const busy = abilities.isBusy();
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
      this.dashDir.set((goal?.x ?? mind.homeX) - body.x, (goal?.y ?? mind.homeY) - body.y);
      if (this.dashDir.lengthSq() > 4 && dash.tryStart(now, this.dashDir, body.aim, body)) {
        this.noteDeathDash(now, body, dash, world, scene, foes);
        this.blockUntil = 0;
        this.nextDashAt = now + 480 + p.thinkJitterMs;
        block.setHeld(now, body, false);
        return { blocking: false, usedAbility };
      }
    }

    this.noticeSwing(now, body, mind, dash, foes, rng);
    this.noticeShot(now, body, mind, dash, rng);
    this.resolvePending(now, body, mind, dash, world, scene, foes, rng);

    const holding = now < this.blockUntil && body.canRaiseBlock() && !dash.isActive(now) && !abilities?.control.block;
    if (!holding) {
      this.blockUntil = 0;
    }
    block.setHeld(now, body, holding);
    return { blocking: holding, usedAbility };
  }

  strafeDir(now: number): Phaser.Math.Vector2 | undefined {
    return now < this.strafeUntil ? this.strafe : undefined;
  }

  private tryAbility(
    now: number,
    _body: NinjaBody,
    mind: TacticalMind,
    abilities: AbilityController,
    ctx: AbilityContext,
    rng: () => number,
  ): boolean {
    const situation = mind.situationView();
    if (!situation) {
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
    const fired = abilities.tryActivate(bestSlot, ctx);
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
    const staminaOk = body.stamina > 14;
    const familiar = this.lightFamiliarity();
    const dirFamiliar = this.dirFamiliarity(threat);
    const hp = body.health / Math.max(1, body.stats.maxHealth);
    const notice = 0.42 + p.reactionQuality * 0.4 + familiar * 0.12;
    if (rng() > notice) {
      return;
    }
    const dodgeChance =
      (0.18 + p.caution * 0.16 + (disruptor ? 0.14 : 0) + (staminaOk ? 0.06 : -0.08)) *
      (this.reactions.dash + this.reactions.strafe > this.reactions.block ? 0.5 : 1);
    const blockChance = Math.min(
      0.7,
      0.16 + p.blockTendency * 0.28 + familiar * 0.2 + dirFamiliar * 0.12 + p.caution * 0.08 + (hp < 0.32 ? 0.1 : 0),
    );
    const roll = rng();
    let kind: PendingReact['kind'] = 'block';
    if (roll < dodgeChance * 0.4 && dash.chargeCount > 0) {
      kind = 'dash';
    } else if (roll < dodgeChance) {
      kind = 'strafe';
    } else if (roll < dodgeChance + blockChance && staminaOk) {
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
    _mind: TacticalMind,
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
      if (body.stamina > 14) {
        this.blockUntil = now + 260 + rng() * 220;
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
