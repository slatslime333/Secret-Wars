import { COLE } from './cole';
import { CRATE } from './crate';

/**
 * Living-city tunables. Sparse landmarks, restrained destruction, no rubble piles.
 */
export const ENV_WORLD = {
  wallHp: Math.round(COLE.attackDamage * 4.5),
  treeHp: Math.round(COLE.attackDamage * 5.4),
  fenceHp: Math.round(COLE.attackDamage * 3.6),
  barricadeHp: Math.round(COLE.attackDamage * 6.2),
  sandbagHp: Math.round(COLE.attackDamage * 4.4),
  barrelHp: Math.round(COLE.attackDamage * 2.8),
  lampHp: Math.round(COLE.attackDamage * 2.6),
  carHp: Math.round(COLE.attackDamage * 9.5 * 0.85),
  truckHp: Math.round(COLE.attackDamage * 14),
  buildingCosmeticHp: Math.round(COLE.attackDamage * 18),

  walkPush: 42,
  lightPush: 118,
  heavyPush: 210,
  abilityPush: 260,
  dashPush: 240,
  dashHit: 9,
  explosionPush: 780,
  treeMass: 1.15,
  treeDrag: 3.4,
  treeAngularDrag: 2.8,
  treeWalkSlow: 0.62,
  smokeGapMs: 380,

  barrelRadius: 142,
  barrelDamage: 78,
  barrelKnockback: 920,
  barrelChainRadius: 80,

  carRadius: 128,
  carDamage: 56,
  carKnockback: 680,
  carFlashCount: 3,
  carFlashMs: 220,

  crateRespawnMs: 28_000,
  crateOccupiedPad: 28,
  maxCrates: 18,

  maxBarrels: 3,
  maxLamps: 18,
  maxExtraTrees: 16,
  maxExtraFences: 14,
  maxEnterable: 2,
  maxFx: 36,
  fxLifeMs: 520,
  houseDoor: 72,
  houseWall: 14,

  roofFadeMs: 180,
  roofInsideAlpha: 0.16,
  roofOutsideAlpha: 1,
  roofDepth: 11,

  snapshotRadius: 340,
  debug: false,
} as const;

export const crateRespawnMs = (): number => ENV_WORLD.crateRespawnMs;

export { CRATE };
