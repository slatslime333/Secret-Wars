/** Perpendicular to aim. Positive sign is left → right across the facing. */
export const sweepKnockback = (
  aimX: number,
  aimY: number,
  sign: number,
): { x: number; y: number } => {
  const length = Math.hypot(aimX, aimY) || 1;
  const nx = aimX / length;
  const ny = aimY / length;
  return {
    x: -ny * sign * 0.88 + nx * 0.18,
    y: nx * sign * 0.88 + ny * 0.18,
  };
};

/** +1 = left → right, -1 = right → left. Hit 2 and even dashes flip. */
export const swingSignFor = (step: 1 | 2 | 3 | 'dash-a' | 'dash-b'): number => {
  if (step === 2 || step === 'dash-b') {
    return -1;
  }
  return 1;
};
