import {
  AbilityContext,
  AbilityControlFlags,
  AbilitySlot,
  AbilitySlotState,
  ActiveAbility,
  HeroAbilityKit,
  SLOT_ORDER,
  defForSlot,
} from './types';

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
 * Per-fighter loadout. Cooldowns, once-per-match ultimates, and one active
 * ability instance. Hero-specific effects live on the kit, not here.
 */
export class AbilityController {
  private readonly slots: Record<AbilitySlot, SlotRuntime>;
  private active?: ActiveAbility;

  constructor(private readonly kit: HeroAbilityKit) {
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

  tryActivate(slot: AbilitySlot, ctx: AbilityContext): boolean {
    if (this.active?.control.abilities) {
      return false;
    }
    const def = defForSlot(this.kit, slot);
    const runtime = this.slots[slot];
    if (ctx.caster.down) {
      return false;
    }
    if (def.chargeMode === 'once' && runtime.charges <= 0) {
      return false;
    }
    if (def.chargeMode === 'cooldown' && ctx.now < runtime.readyAt) {
      return false;
    }
    if (def.chargeMode === 'meter' && runtime.meter < 1 && runtime.charges <= 0) {
      return false;
    }
    if (!def.canActivate(ctx)) {
      return false;
    }

    ctx.interruptCombat();
    const instance = def.activate(ctx);
    if (def.chargeMode === 'once') {
      runtime.charges = Math.max(0, runtime.charges - 1);
      runtime.meter = 0;
    } else if (def.chargeMode === 'meter') {
      runtime.charges = Math.max(0, runtime.charges - 1);
      runtime.meter = 0;
    } else {
      runtime.readyAt = ctx.now + def.cooldownMs;
    }
    if (instance) {
      this.active?.destroy();
      this.active = instance;
    }
    return true;
  }

  update(ctx: AbilityContext): void {
    if (!this.active) {
      return;
    }
    const keep = this.active.update(ctx);
    if (!keep) {
      this.active.destroy();
      this.active = undefined;
    }
  }

  slotState(slot: AbilitySlot, now: number): AbilitySlotState {
    const def = defForSlot(this.kit, slot);
    const runtime = this.slots[slot];
    const remaining = Math.max(0, runtime.readyAt - now);
    const consumed = def.chargeMode === 'once' && runtime.charges <= 0;
    const ready =
      !consumed &&
      (def.chargeMode === 'cooldown' ? remaining <= 0 : runtime.charges > 0 || runtime.meter >= 1);
    return {
      def,
      ready,
      cooldownRemainingMs: remaining,
      cooldownRatio: def.cooldownMs > 0 ? remaining / def.cooldownMs : 0,
      charges: runtime.charges,
      maxCharges: def.maxCharges,
      consumed,
      meter: runtime.meter,
    };
  }

  allStates(now: number): AbilitySlotState[] {
    return SLOT_ORDER.map((slot) => this.slotState(slot, now));
  }

  destroy(): void {
    this.active?.destroy();
    this.active = undefined;
  }
}

const makeRuntime = (def: { startingCharges: number }): SlotRuntime => ({
  readyAt: 0,
  charges: def.startingCharges,
  meter: def.startingCharges > 0 ? 1 : 0,
});
