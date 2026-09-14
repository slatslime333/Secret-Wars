import type Phaser from 'phaser';
import type { BlockController } from '../../combat/BlockController';
import type { NinjaBody } from '../NinjaBody';
import type { AbilityWorld } from './AbilityWorld';

/** Every hero kit exposes these three slots. Effects stay on the hero. */
export type AbilitySlot = 'ability1' | 'ability2' | 'ultimate';

/**
 * `cooldown` is the live ultimate rule (shared recharge).
 * `once` remains for kits that should stay single-use.
 * `meter` is the future minion/combat charge path — same slot, different fill.
 */
export type AbilityChargeMode = 'cooldown' | 'once' | 'meter';

/** How the CPU should think about a kit slot. Inspected from the def, not hero name. */
export type AbilityRole =
  | 'damage'
  | 'burst'
  | 'aoe'
  | 'knockback'
  | 'cc'
  | 'mobility'
  | 'escape'
  | 'defense'
  | 'disruption'
  | 'initiate'
  | 'finish'
  | 'space'
  | 'peel'
  | 'setup'
  | 'heal'
  | 'shield'
  | 'buff';

export const ALLY_SUPPORT_ROLES: readonly AbilityRole[] = ['heal', 'shield', 'buff'];

export const defHasAllySupport = (def: { tactics?: AbilityTactics }): boolean =>
  Boolean(def.tactics?.roles.some((role) => ALLY_SUPPORT_ROLES.includes(role)));

export const kitHasAllySupport = (kit: {
  ability1: { tactics?: AbilityTactics };
  ability2: { tactics?: AbilityTactics };
  ultimate: { tactics?: AbilityTactics };
}): boolean =>
  defHasAllySupport(kit.ability1) || defHasAllySupport(kit.ability2) || defHasAllySupport(kit.ultimate);

export type AbilityTactics = {
  roles: readonly AbilityRole[];
  range: number;
  /** Caster also receives the ally effect (Hex self-shield, Second Wind field). */
  includesSelf?: boolean;
};

export type AbilityControlFlags = {
  move: boolean;
  attack: boolean;
  dash: boolean;
  block: boolean;
  abilities: boolean;
};

export type AbilityContext = {
  scene: Phaser.Scene;
  now: number;
  delta: number;
  caster: NinjaBody;
  enemies: NinjaBody[];
  allies?: NinjaBody[];
  world: AbilityWorld;
  interruptCombat: () => void;
  rivalBlock?: BlockController;
  aimOverride?: { x: number; y: number };
  /** Keep a slot unavailable after the active instance ends (Guardian Angel shield). */
  holdAbilitySlot?: (slot: AbilitySlot) => void;
  releaseAbilitySlot?: (slot: AbilitySlot, now: number, startCooldown: boolean) => void;
};

export type ActiveAbility = {
  readonly id: string;
  readonly control: AbilityControlFlags;
  /** When `deferCooldown` is set, false skips the cooldown (missed Rope Grab). */
  consumeDeferred?: boolean;
  /** Same-slot press while this instance is live (Soul Dash exit). */
  allowRecast?: boolean;
  update(ctx: AbilityContext): boolean;
  destroy(): void;
};

export type AbilityDef = {
  id: string;
  name: string;
  slot: AbilitySlot;
  cooldownMs: number;
  chargeMode: AbilityChargeMode;
  startingCharges: number;
  maxCharges: number;
  iconKey: string;
  accent: number;
  /** Hold to aim on mobile. On PC, click the ability then left-click to fire. */
  aimOnRelease?: boolean;
  /** Short label on the mobile aim pad. */
  padLabel?: string;
  /** Start the cooldown when the active instance ends, not when the button is pressed. */
  deferCooldown?: boolean;
  /** CPU reads this instead of hard-coding per-hero trees. */
  tactics?: AbilityTactics;
  canActivate(ctx: AbilityContext): boolean;
  activate(ctx: AbilityContext): ActiveAbility | void;
};

export type HeroAbilityKit = {
  heroId: string;
  ability1: AbilityDef;
  ability2: AbilityDef;
  ultimate: AbilityDef;
};

export type AbilitySlotState = {
  def: AbilityDef;
  ready: boolean;
  cooldownRemainingMs: number;
  cooldownRatio: number;
  charges: number;
  maxCharges: number;
  /** Ultimate consumed for the rest of the match (`once` mode). */
  consumed: boolean;
  /** Reserved for a future fill-from-gameplay meter. */
  meter: number;
};

export const SLOT_ORDER: AbilitySlot[] = ['ability1', 'ability2', 'ultimate'];

/** True when another fighter has locked this caster out of acting. */
export const isEnemyActionLocked = (ctx: AbilityContext): boolean =>
  ctx.caster.status.isEnemyActionLocked(ctx.now);

/**
 * Abilities stay usable through slows and other debuffs. Only paralyze,
 * stun, and the caster's own animation / control lock block a new cast.
 */
export const canStartAbility = (ctx: AbilityContext): boolean => {
  const { caster, now } = ctx;
  return (
    !caster.down &&
    caster.isPresent &&
    !caster.status.isEnemyActionLocked(now) &&
    !caster.status.isControlLocked(now)
  );
};

export const defForSlot = (kit: HeroAbilityKit, slot: AbilitySlot): AbilityDef => {
  if (slot === 'ability1') {
    return kit.ability1;
  }
  if (slot === 'ability2') {
    return kit.ability2;
  }
  return kit.ultimate;
};
