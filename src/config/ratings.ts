/**
 * Design ratings are 0–99. Ninja is the 70/99 baseline.
 * Gameplay uses converted units (pixels, ms, HP) — never the raw 70.
 */
export const RATING_CAP = 99;
export const NINJA_RATING = 70;

export const fromRating = (rating: number, atZero: number, atCap: number): number =>
  atZero + (atCap - atZero) * (rating / RATING_CAP);
