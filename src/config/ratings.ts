/**
 * Unified 0–99 ratings. 50 is baseline. 99 is reserved for genuinely extreme
 * values. Conversion is piecewise around 50 so current Ninja / Cole / Death
 * handling stays the source of truth while future heroes share one language.
 *
 * Displayed ratings describe gameplay. They do not overwrite it.
 */

export const RATING_CAP = 99;
export const BASELINE_RATING = 50;

export type CoreStatId =
  | 'health'
  | 'stamina'
  | 'damage'
  | 'defense'
  | 'speed'
  | 'attackSpeed'
  | 'attackRange'
  | 'knockback';

export type CoreRatings = Record<CoreStatId, number>;

export type StatCurve = {
  /** Gameplay value at rating 0. */
  at0: number;
  /** Gameplay value at rating 50 (baseline). */
  at50: number;
  /** Gameplay value at rating 99 (maximum / massive). */
  at99: number;
};

export const CORE_STAT_ORDER: readonly CoreStatId[] = [
  'health',
  'stamina',
  'damage',
  'defense',
  'speed',
  'attackSpeed',
  'attackRange',
  'knockback',
] as const;

export const CORE_STAT_LABEL: Record<CoreStatId, string> = {
  health: 'Health',
  stamina: 'Stamina',
  damage: 'Damage',
  defense: 'Defense',
  speed: 'Speed',
  attackSpeed: 'Attack Speed',
  attackRange: 'Range',
  knockback: 'Knockback',
};

/**
 * Piecewise gameplay curves. Anchors were fit so converting the foundational
 * ratings reproduces the live Ninja / Cole / Death numbers.
 *
 * Attack Speed is stored as swing cooldown milliseconds: higher rating = faster
 * (lower ms). Range 50 is the shared melee baseline (106px).
 */
export const CORE_CURVES: Record<CoreStatId, StatCurve> = {
  health: { at0: 80, at50: 150, at99: 240 },
  stamina: { at0: 60, at50: 116, at99: 175 },
  damage: { at0: 8, at50: 13, at99: 21 },
  defense: { at0: 10, at50: 28, at99: 50 },
  speed: { at0: 116, at50: 170, at99: 227 },
  attackSpeed: { at0: 660, at50: 340, at99: 140 },
  attackRange: { at0: 40, at50: 106, at99: 280 },
  knockback: { at0: 120, at50: 205, at99: 330 },
};

/** Shared melee geometry. Rating 50 range. Keep this stable — abilities scale from it. */
export const MELEE_BASE_RANGE = CORE_CURVES.attackRange.at50;

/**
 * Ability damage uses the same 50 = baseline language, with a higher physical
 * baseline than a light attack. 99 is heavy, not a one-shot (~24% of Ninja HP
 * after his current defense).
 */
export const ABILITY_DAMAGE_CURVE: StatCurve = { at0: 2, at50: 16, at99: 44 };

export const clampRating = (rating: number): number => Math.max(0, Math.min(RATING_CAP, rating));

export const fromStatRating = (rating: number, curve: StatCurve): number => {
  const r = clampRating(rating);
  if (r <= BASELINE_RATING) {
    return curve.at0 + (curve.at50 - curve.at0) * (r / BASELINE_RATING);
  }
  return curve.at50 + (curve.at99 - curve.at50) * ((r - BASELINE_RATING) / (RATING_CAP - BASELINE_RATING));
};

export const coreStatValue = (stat: CoreStatId, rating: number): number =>
  Math.round(fromStatRating(rating, CORE_CURVES[stat]));

export const abilityDamage = (rating: number): number => fromStatRating(rating, ABILITY_DAMAGE_CURVE);

export const gameplayFromRatings = (ratings: CoreRatings) => ({
  maxHealth: coreStatValue('health', ratings.health),
  maxStamina: coreStatValue('stamina', ratings.stamina),
  moveSpeed: coreStatValue('speed', ratings.speed),
  attackDamage: coreStatValue('damage', ratings.damage),
  defense: coreStatValue('defense', ratings.defense),
  knockbackPower: coreStatValue('knockback', ratings.knockback),
  attackCooldownMs: coreStatValue('attackSpeed', ratings.attackSpeed),
  attackRange: coreStatValue('attackRange', ratings.attackRange),
});

export type GameplayCoreStats = ReturnType<typeof gameplayFromRatings>;

/**
 * Inverse of `fromStatRating`. Select cards show these so live overrides
 * (Death range, Ninja kick radius, etc.) match the bars the player reads.
 */
export const ratingFromStatValue = (value: number, curve: StatCurve): number => {
  const lo = Math.min(curve.at0, curve.at99);
  const hi = Math.max(curve.at0, curve.at99);
  const clamped = Math.min(hi, Math.max(lo, value));
  if (clamped === curve.at50) {
    return BASELINE_RATING;
  }
  if ((curve.at50 >= curve.at0 && clamped <= curve.at50) || (curve.at50 <= curve.at0 && clamped >= curve.at50)) {
    const span = curve.at50 - curve.at0;
    if (span === 0) {
      return BASELINE_RATING;
    }
    return clampRating(Math.round(BASELINE_RATING * ((clamped - curve.at0) / span)));
  }
  const span = curve.at99 - curve.at50;
  if (span === 0) {
    return RATING_CAP;
  }
  return clampRating(
    Math.round(BASELINE_RATING + ((RATING_CAP - BASELINE_RATING) * (clamped - curve.at50)) / span),
  );
};

export const ratingsFromGameplay = (stats: GameplayCoreStats): CoreRatings => ({
  health: ratingFromStatValue(stats.maxHealth, CORE_CURVES.health),
  stamina: ratingFromStatValue(stats.maxStamina, CORE_CURVES.stamina),
  damage: ratingFromStatValue(stats.attackDamage, CORE_CURVES.damage),
  defense: ratingFromStatValue(stats.defense, CORE_CURVES.defense),
  speed: ratingFromStatValue(stats.moveSpeed, CORE_CURVES.speed),
  attackSpeed: ratingFromStatValue(stats.attackCooldownMs, CORE_CURVES.attackSpeed),
  attackRange: ratingFromStatValue(stats.attackRange, CORE_CURVES.attackRange),
  knockback: ratingFromStatValue(stats.knockbackPower, CORE_CURVES.knockback),
});

export const formatRating = (rating: number): string => `${clampRating(Math.round(rating))}/${RATING_CAP}`;
