import type Phaser from 'phaser';
import type { BlockController } from '../../combat/BlockController';
import type { NinjaBody } from '../NinjaBody';
import type { AbilityWorld } from './AbilityWorld';

/** Every hero kit exposes these three slots. Effects stay on the hero. */
export type AbilitySlot = 'ability1' | 'ability2' | 'ultimate';

/**
 * `once` is the current ultimate rule (one use per match).
 * `meter` is the future minion/combat charge path — same slot, different fill.
 */
export type AbilityChargeMode = 'cooldown' | 'once' | 'meter';

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
  world: AbilityWorld;
  interruptCombat: () => void;
  rivalBlock?: BlockController;
  aimOverride?: { x: number; y: number };
};

export type ActiveAbility = {
  readonly id: string;
  readonly control: AbilityControlFlags;
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
  /** Mobile: hold and drag the button, fire on release. PC still uses current aim. */
  aimOnRelease?: boolean;
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

export const defForSlot = (kit: HeroAbilityKit, slot: AbilitySlot): AbilityDef => {
  if (slot === 'ability1') {
    return kit.ability1;
  }
  if (slot === 'ability2') {
    return kit.ability2;
  }
  return kit.ultimate;
};
