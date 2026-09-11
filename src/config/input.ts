/**
 * Demo 1 input tunables.
 *
 * Right stick / mouse aim owns the hit marker whenever it is active.
 * Movement may update facing only when the aim stick is idle.
 */
export const INPUT = {
  leftDeadzone: 0.18,
  rightDeadzone: 0.18,
  stickRadius: 70,
  keyboard: {
    up: 'W',
    down: 'S',
    left: 'A',
    right: 'D',
    attack: 'J',
    block: 'K',
    dash: 'L',
  },
} as const;
