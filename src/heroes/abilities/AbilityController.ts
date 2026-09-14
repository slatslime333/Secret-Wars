import {
  AbilityContext,
  AbilityControlFlags,
  AbilitySlot,
  AbilitySlotState,
  ActiveAbility,
  HeroAbilityKit,
  SLOT_ORDER,
  canStartAbility,
  defForSlot,
} from './types';
import { moveAbilityAudio, startAbilityAudio, stopAbilityAudio } from '../../audio';
import { tryAutoDemonRage } from './demon/rage';
import { DEV_CHEATS } from '../../debug/devCheats';

const OPEN_CONTROL: AbilityControlFlags = {
  move: false,
  attack: false,
  dash: false,
  block: false,
  abilities: false,
};

type SlotRuntime = {
  readyAt: number;
  charges: number;
  meter: number;
};

/**
 * Per-fighter loadout. Cooldowns, charge modes, and one active ability
 * instance. Hero-specific effects live on the kit, not here.
 */
export class AbilityController {
  private readonly slots: Record<AbilitySlot, SlotRuntime>;
  private active?: ActiveAbility;
  private deferredSlot?: AbilitySlot;
  private readonly heldSlots = new Set<AbilitySlot>();
  private loopKey?: string;

  constructor(readonly kit: HeroAbilityKit) {
    this.slots = {
      ability1: makeRuntime(kit.ability1),
      ability2: makeRuntime(kit.ability2),
      ultimate: makeRuntime(kit.ultimate),
    };
  }

  get control(): AbilityControlFlags {
    return this.active?.control ?? OPEN_CONTROL;
  }

  isBusy(): boolean {
    return Boolean(this.active);
  }

  holdAbilitySlot(slot: AbilitySlot): void {
    this.heldSlots.add(slot);
  }

  releaseAbilitySlot(slot: AbilitySlot, now: number, startCooldown: boolean): void {
    const wasHeld = this.heldSlots.delete(slot);
    if (wasHeld && startCooldown && !DEV_CHEATS.noCooldowns) {
      const def = defForSlot(this.kit, slot);
      this.slots[slot].readyAt = now + def.cooldownMs;
    }
  }

  tryActivate(slot: AbilitySlot, ctx: AbilityContext): boolean {
    const def = defForSlot(this.kit, slot);
    if (this.active && this.active.id === def.id) {
      if (!this.active.allowRecast || !canStartAbility(ctx)) {
        return false;
      }
      ctx.interruptCombat();
      def.activate(ctx);
      return true;
    }
    if (this.heldSlots.has(slot)) {
      return false;
    }
    if (this.active?.control.abilities) {
      return false;
    }
    if (!canStartAbility(ctx)) {
      return false;
    }
    const runtime = this.slots[slot];
    if (ctx.caster.down) {
      return false;
    }
    this.tickChargePools(ctx.now);
    if (def.chargeMode === 'once' && runtime.charges <= 0 && !DEV_CHEATS.noCooldowns) {
      return false;
    }
    if (def.chargeMode === 'cooldown' && !DEV_CHEATS.noCooldowns) {
      if (usesChargePool(def) ? runtime.charges <= 0 : ctx.now < runtime.readyAt) {
        return false;
      }
    }
    if (def.chargeMode === 'meter' && runtime.meter < 1 && runtime.charges <= 0) {
      return false;
    }
    if (!def.canActivate(ctx)) {
      return false;
    }

    ctx.interruptCombat();
    const instance = def.activate(ctx);
    if (DEV_CHEATS.noCooldowns) {
      /* keep charges and skip readyAt so the kit can be re-fired */
    } else if (def.chargeMode === 'once') {
      runtime.charges = Math.max(0, runtime.charges - 1);
      runtime.meter = 0;
    } else if (def.chargeMode === 'meter') {
      if (def.id !== 'demon-rage') {
        runtime.charges = Math.max(0, runtime.charges - 1);
        runtime.meter = 0;
      }
    } else if (def.deferCooldown) {
      this.deferredSlot = slot;
    } else if (usesChargePool(def)) {
      runtime.charges = Math.max(0, runtime.charges - 1);
      if (runtime.readyAt <= ctx.now) {
        runtime.readyAt = ctx.now + def.cooldownMs;
      }
    } else {
      runtime.readyAt = ctx.now + def.cooldownMs;
    }
    if (instance) {
      this.active?.destroy();
      stopAbilityAudio(this.loopKey);
      this.loopKey = undefined;
      this.active = instance;
    }
    this.loopKey = startAbilityAudio(def.id, ctx.caster) ?? this.loopKey;
    return true;
  }

  update(ctx: AbilityContext): void {
    if (this.kit.heroId === 'demon') {
      this.slots.ultimate.meter = ctx.caster.demonRage;
      tryAutoDemonRage(ctx, () => this.tryActivate('ultimate', ctx));
    }
    this.tickChargePools(ctx.now);
    if (!this.active) {
      return;
    }
    const keep = this.active.update(ctx);
    moveAbilityAudio(this.loopKey, ctx.caster);
    if (!keep) {
      const consume = this.active.consumeDeferred !== false;
      if (this.deferredSlot && consume && !DEV_CHEATS.noCooldowns) {
        const def = defForSlot(this.kit, this.deferredSlot);
        this.slots[this.deferredSlot].readyAt = ctx.now + def.cooldownMs;
      }
      this.deferredSlot = undefined;
      this.active.destroy();
      this.active = undefined;
      stopAbilityAudio(this.loopKey);
      this.loopKey = undefined;
    }
  }

  slotState(slot: AbilitySlot, now: number): AbilitySlotState {
    this.tickChargePools(now);
    const def = defForSlot(this.kit, slot);
    const runtime = this.slots[slot];
    const remaining = DEV_CHEATS.noCooldowns ? 0 : Math.max(0, runtime.readyAt - now);
    const consumed = def.chargeMode === 'once' && runtime.charges <= 0 && !DEV_CHEATS.noCooldowns;
    const pooled = usesChargePool(def);
    const recastable = Boolean(this.active?.allowRecast && this.active.id === def.id);
    const channeling =
      !recastable && (this.heldSlots.has(slot) || (this.deferredSlot === slot && Boolean(this.active)));
    const meterReady = def.chargeMode === 'meter' && (runtime.charges > 0 || runtime.meter >= 1);
    const ready =
      DEV_CHEATS.noCooldowns ||
      recastable ||
      (!consumed &&
        !channeling &&
        (pooled
          ? runtime.charges > 0
          : def.chargeMode === 'cooldown'
            ? remaining <= 0
            : meterReady));
    const showRecharge = pooled && runtime.charges < def.maxCharges;
    return {
      def,
      ready,
      cooldownRemainingMs: showRecharge || !pooled ? remaining : 0,
      cooldownRatio: def.cooldownMs > 0 && (showRecharge || !pooled) ? remaining / def.cooldownMs : 0,
      charges: runtime.charges,
      maxCharges: def.maxCharges,
      consumed,
      meter: runtime.meter,
    };
  }

  allStates(now: number): AbilitySlotState[] {
    return SLOT_ORDER.map((slot) => this.slotState(slot, now));
  }

  resetCooldowns(): void {
    this.heldSlots.clear();
    this.deferredSlot = undefined;
    for (const slot of SLOT_ORDER) {
      const def = defForSlot(this.kit, slot);
      this.slots[slot].readyAt = 0;
      this.slots[slot].charges = def.startingCharges;
      this.slots[slot].meter = def.startingCharges > 0 ? 1 : 0;
    }
  }

  silence(): void {
    stopAbilityAudio(this.loopKey);
    this.loopKey = undefined;
  }

  /** Drop the active instance without starting a deferred cooldown (death / interrupt). */
  interruptActive(): void {
    this.active?.destroy();
    this.active = undefined;
    this.deferredSlot = undefined;
    this.silence();
  }

  destroy(): void {
    this.active?.destroy();
    this.active = undefined;
    this.heldSlots.clear();
    this.silence();
  }

  private tickChargePools(now: number): void {
    for (const slot of SLOT_ORDER) {
      const def = defForSlot(this.kit, slot);
      if (!usesChargePool(def)) {
        continue;
      }
      const runtime = this.slots[slot];
      if (DEV_CHEATS.noCooldowns) {
        runtime.charges = def.maxCharges;
        runtime.readyAt = 0;
        continue;
      }
      while (runtime.charges < def.maxCharges && runtime.readyAt > 0 && now >= runtime.readyAt) {
        runtime.charges += 1;
        runtime.readyAt = runtime.charges < def.maxCharges ? runtime.readyAt + def.cooldownMs : 0;
      }
    }
  }
}

const usesChargePool = (def: { chargeMode: string; maxCharges: number }): boolean =>
  def.chargeMode === 'cooldown' && def.maxCharges > 1;

const makeRuntime = (def: { startingCharges: number }): SlotRuntime => ({
  readyAt: 0,
  charges: def.startingCharges,
  meter: def.startingCharges > 0 ? 1 : 0,
});
