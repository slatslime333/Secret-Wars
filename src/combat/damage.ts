/** Incoming hit after defense. Always at least 1 so tanky fights still register. */
export const applyDefense = (rawDamage: number, defense: number): number =>
  Math.max(1, Math.round(rawDamage * (100 / (100 + defense))));
